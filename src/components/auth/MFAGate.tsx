import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MFAEnroll from './MFAEnroll';
import { markPerformance } from '@/hooks/usePerformanceMetrics';

interface MfaRequiredRoles {
  admin: boolean;
  senior_manager: boolean;
  accounting: boolean;
  warehouse_staff: boolean;
}

interface MFAGateProps {
  children: React.ReactNode;
}

// Session storage key for caching MFA status
const MFA_STATUS_CACHE_KEY = 'lotastro_mfa_status';
const MFA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface MFACacheEntry {
  hasMFA: boolean;
  roleRequiresMfa: boolean;
  timestamp: number;
  userId: string;
}

/**
 * MFAGate - Checks MFA requirements without blocking initial render.
 * Optimizations:
 * - Reduced timeout from 10s to 3s
 * - Parallel fetching of settings + MFA status
 * - Session-level caching to avoid re-checks on navigation
 * - Timing instrumentation for performance monitoring
 */
const MFAGate: React.FC<MFAGateProps> = ({ children }) => {
  const { profile, signOut, loading: authLoading, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasMFA, setHasMFA] = useState<boolean | null>(null);
  const [roleRequiresMfa, setRoleRequiresMfa] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const startTimeRef = useRef<number>(performance.now());
  const hasCheckedRef = useRef(false);

  // Try to load cached MFA status
  const loadCachedStatus = useCallback((): MFACacheEntry | null => {
    try {
      const cached = sessionStorage.getItem(MFA_STATUS_CACHE_KEY);
      if (!cached) return null;
      
      const entry: MFACacheEntry = JSON.parse(cached);
      const now = Date.now();
      
      // Validate cache: same user and not expired
      if (entry.userId === user?.id && (now - entry.timestamp) < MFA_CACHE_TTL_MS) {
        return entry;
      }
      
      // Cache expired or different user
      sessionStorage.removeItem(MFA_STATUS_CACHE_KEY);
      return null;
    } catch {
      return null;
    }
  }, [user?.id]);

  // Save MFA status to cache
  const saveCachedStatus = useCallback((hasMFA: boolean, roleRequiresMfa: boolean) => {
    if (!user?.id) return;
    
    try {
      const entry: MFACacheEntry = {
        hasMFA,
        roleRequiresMfa,
        timestamp: Date.now(),
        userId: user.id,
      };
      sessionStorage.setItem(MFA_STATUS_CACHE_KEY, JSON.stringify(entry));
    } catch {
      // Ignore storage errors
    }
  }, [user?.id]);

  // Main effect: check MFA requirements when profile is available
  useEffect(() => {
    if (hasCheckedRef.current) return;
    
    if (profile?.role && user?.id) {
      hasCheckedRef.current = true;
      
      // Check cache first
      const cached = loadCachedStatus();
      if (cached) {
        console.info(`[MFAGate] Using cached status (age: ${Date.now() - cached.timestamp}ms)`);
        setHasMFA(cached.hasMFA);
        setRoleRequiresMfa(cached.roleRequiresMfa);
        setLoading(false);
        const elapsed = performance.now() - startTimeRef.current;
        console.info(`[MFAGate] Check completed in ${elapsed.toFixed(0)}ms (cached)`);
        return;
      }
      
      // No cache, perform fresh check
      checkMfaRequirements();
    } else if (!authLoading && !profile?.role) {
      // Auth finished loading but no role - fail open to avoid blocking UI
      console.warn('[MFAGate] No profile role found after auth loaded, allowing access');
      setLoading(false);
      setHasMFA(true);
    }
  }, [profile?.role, authLoading, user?.id, loadCachedStatus]);

  // Safety timeout: reduced from 10s to 3s
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[MFAGate] Timeout reached (3s), failing open');
        setLoading(false);
        setHasMFA(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [loading]);

  const checkMfaRequirements = async () => {
    const checkStart = performance.now();
    
    try {
      // Parallel fetch: system settings AND MFA factors at the same time
      const [settingsResult, factorsResult] = await Promise.all([
        supabase
          .from('system_settings' as any)
          .select('setting_value')
          .eq('setting_key', 'session_config')
          .maybeSingle() as unknown as Promise<{ data: { setting_value: { mfa_required_roles?: MfaRequiredRoles } } | null; error: any }>,
        supabase.auth.mfa.listFactors(),
      ]);
      
      // Process settings
      const mfaRoles = settingsResult.data?.setting_value?.mfa_required_roles || {
        admin: true,
        senior_manager: true,
        accounting: true,
        warehouse_staff: false,
      };
      
      const userRole = profile?.role as keyof MfaRequiredRoles;
      const requiresMfa = userRole ? mfaRoles[userRole] ?? false : false;
      setRoleRequiresMfa(requiresMfa);
      
      // Process MFA factors
      let userHasMFA = true; // Default to true (fail open)
      
      if (requiresMfa) {
        if (factorsResult.error) {
          console.error('[MFAGate] Error checking MFA status:', factorsResult.error);
        } else {
          const verifiedFactors = factorsResult.data?.totp?.filter(f => f.status === 'verified') || [];
          userHasMFA = verifiedFactors.length > 0;
        }
      }
      
      setHasMFA(userHasMFA);
      
      // Cache the result
      saveCachedStatus(userHasMFA, requiresMfa);
      
      const elapsed = performance.now() - checkStart;
      console.info(`[MFAGate] Check completed in ${elapsed.toFixed(0)}ms (role: ${userRole}, requiresMfa: ${requiresMfa}, hasMFA: ${userHasMFA})`);
      
    } catch (error) {
      console.error('[MFAGate] Error checking MFA requirements:', error);
      // On error, allow access (fail open for availability)
      setHasMFA(true);
    } finally {
      setLoading(false);
      const totalElapsed = performance.now() - startTimeRef.current;
      console.info(`[MFAGate] Total gate time: ${totalElapsed.toFixed(0)}ms`);
      markPerformance('mfa_check_complete');
    }
  };

  const handleEnrollmentComplete = () => {
    setShowEnrollDialog(false);
    setHasMFA(true);
    // Update cache with new MFA status
    saveCachedStatus(true, roleRequiresMfa);
    // Clear the cached status to force re-check on next navigation
    sessionStorage.removeItem(MFA_STATUS_CACHE_KEY);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    // Clear MFA cache on sign out
    sessionStorage.removeItem(MFA_STATUS_CACHE_KEY);
    await signOut();
  };

  // NON-BLOCKING loading state: render children immediately with corner indicator
  if (loading) {
    return (
      <>
        {children}
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-card border rounded-lg px-3 py-2 shadow-lg pointer-events-none">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Verifying security...</span>
        </div>
      </>
    );
  }

  // If role requires MFA but user hasn't enrolled, BLOCK access
  if (roleRequiresMfa && hasMFA === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-destructive/10">
                <Shield className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl">Two-Factor Authentication Required</CardTitle>
            <CardDescription className="text-base mt-2">
              Your role ({profile?.role?.replace('_', ' ')}) requires Two-Factor Authentication (MFA) to access the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You must set up MFA before you can access the application. This is a security requirement for your role.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => setShowEnrollDialog(true)}
              >
                <Shield className="h-5 w-5 mr-2" />
                Set Up MFA Now
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                Sign Out
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground text-center mt-4">
              MFA adds an extra layer of security by requiring a code from your authenticator app in addition to your password.
            </p>
          </CardContent>
        </Card>

        <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
          {showEnrollDialog && (
            <DialogContent className="max-w-md" data-owner="mfa-enroll">
              <MFAEnroll 
                onEnrollmentComplete={handleEnrollmentComplete}
                onCancel={() => setShowEnrollDialog(false)}
              />
            </DialogContent>
          )}
        </Dialog>
      </div>
    );
  }

  // User has MFA enrolled or role doesn't require it - allow access
  return <>{children}</>;
};

export default MFAGate;
