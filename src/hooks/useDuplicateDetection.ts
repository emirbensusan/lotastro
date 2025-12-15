import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType: 'exact' | 'perceptual' | 'data_match' | null;
  matchedRollId: string | null;
  matchedRoll: {
    id: string;
    session_id: string;
    capture_sequence: number;
    counter_quality: string;
    counter_color: string;
    counter_lot_number: string;
    counter_meters: number;
  } | null;
  confidence: number;
}

export const useDuplicateDetection = () => {
  // Check for duplicates by SHA256 hash (exact match)
  const checkExactDuplicate = useCallback(async (
    sha256Hash: string,
    excludeRollId?: string
  ): Promise<DuplicateCheckResult> => {
    try {
      let query = supabase
        .from('count_rolls')
        .select('id, session_id, capture_sequence, counter_quality, counter_color, counter_lot_number, counter_meters')
        .eq('photo_hash_sha256', sha256Hash);

      if (excludeRollId) {
        query = query.neq('id', excludeRollId);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        console.error('[useDuplicateDetection] SHA256 check error:', error);
        return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
      }

      if (data && data.length > 0) {
        return {
          isDuplicate: true,
          duplicateType: 'exact',
          matchedRollId: data[0].id,
          matchedRoll: data[0],
          confidence: 100,
        };
      }

      return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
    } catch (err) {
      console.error('[useDuplicateDetection] Exact check exception:', err);
      return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
    }
  }, []);

  // Check for similar images by perceptual hash (near-duplicate)
  const checkPerceptualDuplicate = useCallback(async (
    perceptualHash: string,
    sessionId: string,
    excludeRollId?: string
  ): Promise<DuplicateCheckResult> => {
    if (!perceptualHash) {
      return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
    }

    try {
      // Fetch all perceptual hashes from current session for comparison
      let query = supabase
        .from('count_rolls')
        .select('id, session_id, capture_sequence, counter_quality, counter_color, counter_lot_number, counter_meters, photo_hash_perceptual')
        .eq('session_id', sessionId)
        .not('photo_hash_perceptual', 'is', null);

      if (excludeRollId) {
        query = query.neq('id', excludeRollId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useDuplicateDetection] Perceptual check error:', error);
        return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
      }

      if (!data || data.length === 0) {
        return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
      }

      // Compare perceptual hashes - find closest match
      let bestMatch: typeof data[0] | null = null;
      let bestSimilarity = 0;

      for (const roll of data) {
        if (roll.photo_hash_perceptual) {
          const similarity = calculateHashSimilarity(perceptualHash, roll.photo_hash_perceptual);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = roll;
          }
        }
      }

      // Threshold: 85% similarity is considered a potential duplicate
      if (bestMatch && bestSimilarity >= 85) {
        return {
          isDuplicate: true,
          duplicateType: 'perceptual',
          matchedRollId: bestMatch.id,
          matchedRoll: {
            id: bestMatch.id,
            session_id: bestMatch.session_id,
            capture_sequence: bestMatch.capture_sequence,
            counter_quality: bestMatch.counter_quality,
            counter_color: bestMatch.counter_color,
            counter_lot_number: bestMatch.counter_lot_number,
            counter_meters: bestMatch.counter_meters,
          },
          confidence: bestSimilarity,
        };
      }

      return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
    } catch (err) {
      console.error('[useDuplicateDetection] Perceptual check exception:', err);
      return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
    }
  }, []);

  // Check for data-level duplicates (same quality + color + lot + meters)
  const checkDataDuplicate = useCallback(async (
    sessionId: string,
    quality: string,
    color: string,
    lotNumber: string,
    meters: number,
    excludeRollId?: string
  ): Promise<DuplicateCheckResult> => {
    try {
      let query = supabase
        .from('count_rolls')
        .select('id, session_id, capture_sequence, counter_quality, counter_color, counter_lot_number, counter_meters')
        .eq('session_id', sessionId)
        .ilike('counter_quality', quality)
        .ilike('counter_color', color)
        .ilike('counter_lot_number', lotNumber)
        .eq('counter_meters', meters);

      if (excludeRollId) {
        query = query.neq('id', excludeRollId);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        console.error('[useDuplicateDetection] Data check error:', error);
        return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
      }

      if (data && data.length > 0) {
        return {
          isDuplicate: true,
          duplicateType: 'data_match',
          matchedRollId: data[0].id,
          matchedRoll: data[0],
          confidence: 95,
        };
      }

      return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
    } catch (err) {
      console.error('[useDuplicateDetection] Data check exception:', err);
      return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
    }
  }, []);

  // Full duplicate check pipeline
  const checkForDuplicates = useCallback(async (
    sessionId: string,
    sha256Hash: string,
    perceptualHash: string | null,
    quality?: string,
    color?: string,
    lotNumber?: string,
    meters?: number,
    excludeRollId?: string
  ): Promise<DuplicateCheckResult> => {
    // 1. Check exact SHA256 match first (highest priority)
    const exactResult = await checkExactDuplicate(sha256Hash, excludeRollId);
    if (exactResult.isDuplicate) {
      return exactResult;
    }

    // 2. Check perceptual hash similarity
    if (perceptualHash) {
      const perceptualResult = await checkPerceptualDuplicate(perceptualHash, sessionId, excludeRollId);
      if (perceptualResult.isDuplicate) {
        return perceptualResult;
      }
    }

    // 3. Check data-level duplicates
    if (quality && color && lotNumber && meters !== undefined) {
      const dataResult = await checkDataDuplicate(sessionId, quality, color, lotNumber, meters, excludeRollId);
      if (dataResult.isDuplicate) {
        return dataResult;
      }
    }

    return { isDuplicate: false, duplicateType: null, matchedRollId: null, matchedRoll: null, confidence: 0 };
  }, [checkExactDuplicate, checkPerceptualDuplicate, checkDataDuplicate]);

  return {
    checkForDuplicates,
    checkExactDuplicate,
    checkPerceptualDuplicate,
    checkDataDuplicate,
  };
};

// Calculate similarity between two hex hash strings (Hamming distance based)
function calculateHashSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return 0;
  }

  let matchingChars = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) {
      matchingChars++;
    }
  }

  return Math.round((matchingChars / hash1.length) * 100);
}
