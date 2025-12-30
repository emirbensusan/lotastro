export interface ConflictInfo {
  field: string;
  localValue: unknown;
  serverValue: unknown;
  originalValue: unknown;
  resolution?: 'local' | 'server';
}

export interface ConflictAnalysis {
  hasConflicts: boolean;
  conflicts: ConflictInfo[];
  autoMergeable: ConflictInfo[];
}

/**
 * Three-way merge conflict detection
 * 
 * Rules:
 * 1. If local changed and server unchanged -> use local (auto-merge)
 * 2. If server changed and local unchanged -> use server (auto-merge)
 * 3. If both changed to same value -> no conflict (auto-merge)
 * 4. If both changed to different values -> CONFLICT (needs user resolution)
 */
export function analyzeConflicts(
  original: Record<string, unknown>,
  local: Record<string, unknown>,
  server: Record<string, unknown>
): ConflictAnalysis {
  const conflicts: ConflictInfo[] = [];
  const autoMergeable: ConflictInfo[] = [];
  
  // Get all unique keys
  const allKeys = new Set([
    ...Object.keys(original),
    ...Object.keys(local),
    ...Object.keys(server)
  ]);
  
  // Skip metadata fields
  const skipFields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
  
  for (const field of allKeys) {
    if (skipFields.includes(field)) continue;
    
    const originalValue = original[field];
    const localValue = local[field];
    const serverValue = server[field];
    
    const localChanged = !deepEqual(localValue, originalValue);
    const serverChanged = !deepEqual(serverValue, originalValue);
    
    if (!localChanged && !serverChanged) {
      // No changes
      continue;
    }
    
    if (localChanged && serverChanged) {
      if (deepEqual(localValue, serverValue)) {
        // Both changed to same value - auto-merge
        autoMergeable.push({
          field,
          localValue,
          serverValue,
          originalValue,
          resolution: 'local'
        });
      } else {
        // Both changed to different values - CONFLICT
        conflicts.push({
          field,
          localValue,
          serverValue,
          originalValue
        });
      }
    } else if (localChanged) {
      // Only local changed - use local
      autoMergeable.push({
        field,
        localValue,
        serverValue,
        originalValue,
        resolution: 'local'
      });
    } else if (serverChanged) {
      // Only server changed - use server
      autoMergeable.push({
        field,
        localValue,
        serverValue,
        originalValue,
        resolution: 'server'
      });
    }
  }
  
  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    autoMergeable
  };
}

/**
 * Apply conflict resolutions to create merged data
 */
export function applyResolutions(
  original: Record<string, unknown>,
  local: Record<string, unknown>,
  server: Record<string, unknown>,
  resolutions: Record<string, 'local' | 'server'>
): Record<string, unknown> {
  const analysis = analyzeConflicts(original, local, server);
  const merged = { ...server }; // Start with server as base
  
  // Apply auto-mergeable changes
  for (const item of analysis.autoMergeable) {
    if (item.resolution === 'local') {
      merged[item.field] = item.localValue;
    }
    // Server resolution is already in base
  }
  
  // Apply user resolutions for conflicts
  for (const conflict of analysis.conflicts) {
    const resolution = resolutions[conflict.field];
    if (resolution === 'local') {
      merged[conflict.field] = conflict.localValue;
    }
    // Server resolution keeps server value (already in base)
  }
  
  return merged;
}

/**
 * Deep equality check for values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    const aStr = JSON.stringify(a);
    const bStr = JSON.stringify(b);
    return aStr === bStr;
  }
  
  return false;
}

/**
 * Format a value for display in conflict resolution UI
 */
export function formatValueForDisplay(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return JSON.stringify(value, null, 2);
  }
  
  return String(value);
}
