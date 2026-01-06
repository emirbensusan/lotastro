import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInquiries, useStockTakeSessions, Inquiry } from '@/hooks/useInquiries';

type UserRole = 'warehouse_staff' | 'accounting' | 'admin' | 'senior_manager';

interface GatingState {
  isLoading: boolean;
  canAccessStock: boolean;
  requiresInquiry: boolean;
  bypassReason: string | null;
  activeInquiry: Inquiry | null;
  hasActiveStockTakeSession: boolean;
}

interface UseInquiryGatingReturn extends GatingState {
  checkAccess: () => Promise<void>;
  logStockView: (params: {
    qualities_viewed?: string[];
    colors_viewed?: string[];
    meters_visible?: number;
    filters_used?: Record<string, any>;
  }) => Promise<void>;
  setActiveInquiry: (inquiry: Inquiry | null) => void;
}

// Roles that can bypass inquiry requirement
const BYPASS_ROLES: UserRole[] = ['senior_manager', 'admin'];

export function useInquiryGating(): UseInquiryGatingReturn {
  const { user, profile } = useAuth();
  const { fetchInquiries, logInquiryView } = useInquiries();
  const { hasActiveSession } = useStockTakeSessions();
  
  const [state, setState] = useState<GatingState>({
    isLoading: true,
    canAccessStock: false,
    requiresInquiry: true,
    bypassReason: null,
    activeInquiry: null,
    hasActiveStockTakeSession: false,
  });

  // Check if user's role can bypass inquiry requirement
  const canBypass = useMemo(() => {
    if (!profile?.role) return false;
    return BYPASS_ROLES.includes(profile.role as UserRole);
  }, [profile?.role]);

  // Check access on mount and when user changes
  const checkAccess = useCallback(async () => {
    if (!user || !profile) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        canAccessStock: false,
        requiresInquiry: true,
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // 1. Check if user has bypass role
      if (canBypass) {
        setState({
          isLoading: false,
          canAccessStock: true,
          requiresInquiry: false,
          bypassReason: 'management_review',
          activeInquiry: null,
          hasActiveStockTakeSession: false,
        });
        
        // Log bypass access for audit trail
        await logInquiryView({
          action: 'bypass_access',
          is_bypass: true,
          bypass_reason: 'management_review',
        });
        
        return;
      }

      // 2. Check if user has an active stock take session
      const hasStockTake = await hasActiveSession();
      if (hasStockTake) {
        setState({
          isLoading: false,
          canAccessStock: true,
          requiresInquiry: false,
          bypassReason: 'stock_take',
          activeInquiry: null,
          hasActiveStockTakeSession: true,
        });
        
        // Log stock take access
        await logInquiryView({
          action: 'stock_take_access',
          is_bypass: true,
          bypass_reason: 'stock_take',
        });
        
        return;
      }

      // 3. Check for active inquiry
      const inquiries = await fetchInquiries({ status: 'active' });
      const userActiveInquiry = inquiries.find(
        inq => inq.created_by === user.id && 
        inq.status === 'active' &&
        (!inq.expires_at || new Date(inq.expires_at) > new Date())
      );

      if (userActiveInquiry) {
        setState({
          isLoading: false,
          canAccessStock: true,
          requiresInquiry: false,
          bypassReason: null,
          activeInquiry: userActiveInquiry,
          hasActiveStockTakeSession: false,
        });
        return;
      }

      // 4. No access - requires inquiry
      setState({
        isLoading: false,
        canAccessStock: false,
        requiresInquiry: true,
        bypassReason: null,
        activeInquiry: null,
        hasActiveStockTakeSession: false,
      });
    } catch (error) {
      console.error('Error checking inquiry gating:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        canAccessStock: canBypass, // Fallback to role-based bypass on error
        requiresInquiry: !canBypass,
      }));
    }
  }, [user, profile, canBypass, fetchInquiries, hasActiveSession, logInquiryView]);

  // Log a stock view with details
  const logStockView = useCallback(async (params: {
    qualities_viewed?: string[];
    colors_viewed?: string[];
    meters_visible?: number;
    filters_used?: Record<string, any>;
  }) => {
    await logInquiryView({
      inquiry_id: state.activeInquiry?.id,
      action: 'view_inventory',
      is_bypass: !!state.bypassReason,
      bypass_reason: state.bypassReason || undefined,
      ...params,
    });
  }, [logInquiryView, state.activeInquiry?.id, state.bypassReason]);

  // Allow setting active inquiry from UI (after creation)
  const setActiveInquiry = useCallback((inquiry: Inquiry | null) => {
    setState(prev => ({
      ...prev,
      activeInquiry: inquiry,
      canAccessStock: inquiry ? true : prev.canAccessStock,
      requiresInquiry: inquiry ? false : prev.requiresInquiry,
    }));
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return {
    ...state,
    checkAccess,
    logStockView,
    setActiveInquiry,
  };
}

// Simple hook to check if user can bypass without full gating
export function useCanBypassInquiry(): boolean {
  const { profile } = useAuth();
  return useMemo(() => {
    if (!profile?.role) return false;
    return BYPASS_ROLES.includes(profile.role as UserRole);
  }, [profile?.role]);
}
