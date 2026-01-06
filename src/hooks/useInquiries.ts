import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { useLanguage } from '@/contexts/LanguageContext';

type InquiryStatus = Database['public']['Enums']['inquiry_status'];
type InquiryReason = Database['public']['Enums']['inquiry_reason'];

export interface InquiryLine {
  id?: string;
  quality: string;
  color: string;
  requested_meters: number;
  scope: 'quality_color' | 'lot';
  lot_id?: string | null;
  notes?: string | null;
}

export interface Inquiry {
  id: string;
  inquiry_number: string;
  reason: InquiryReason;
  status: InquiryStatus;
  customer_name: string | null;
  salesperson_id: string | null;
  notes: string | null;
  expires_at: string | null;
  converted_to_order_id: string | null;
  converted_at: string | null;
  converted_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  inquiry_lines?: InquiryLine[];
  profiles?: { full_name: string | null; email: string };
}

export interface CreateInquiryInput {
  reason: InquiryReason;
  customer_name?: string;
  salesperson_id?: string;
  notes?: string;
  expires_at?: string;
  lines: Omit<InquiryLine, 'id'>[];
}

export function useInquiries() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const fetchInquiries = useCallback(async (filters?: {
    status?: InquiryStatus;
    reason?: InquiryReason;
    search?: string;
  }) => {
    try {
      setLoading(true);
      let query = supabase
        .from('inquiries')
        .select(`
          *,
          inquiry_lines (*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.reason) {
        query = query.eq('reason', filters.reason);
      }
      if (filters?.search) {
        query = query.or(`inquiry_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profiles separately for the created_by users
      const userIds = [...new Set((data || []).map(d => d.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return (data || []).map(d => ({
        ...d,
        profiles: profileMap.get(d.created_by) || undefined,
      })) as Inquiry[];
    } catch (error: any) {
      toast.error(`${String(t('inquiry.fetchError'))}: ${error.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchInquiry = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inquiries')
        .select(`
          *,
          inquiry_lines (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Fetch profile for created_by
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('user_id', data.created_by)
        .single();
      
      return {
        ...data,
        profiles: profile || undefined,
      } as Inquiry;
    } catch (error: any) {
      toast.error(`${String(t('inquiry.fetchSingleError'))}: ${error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  const createInquiry = useCallback(async (input: CreateInquiryInput) => {
    if (!user) {
      toast.error(String(t('inquiry.loginRequired')));
      return null;
    }

    try {
      setLoading(true);

      // Generate inquiry number using database function
      const { data: numberData, error: numberError } = await supabase
        .rpc('generate_inquiry_number');
      
      if (numberError) throw numberError;

      // Create inquiry
      const { data: inquiry, error: inquiryError } = await supabase
        .from('inquiries')
        .insert({
          inquiry_number: numberData,
          reason: input.reason,
          customer_name: input.customer_name || null,
          salesperson_id: input.salesperson_id || null,
          notes: input.notes || null,
          expires_at: input.expires_at || null,
          status: 'active',
          created_by: user.id,
        })
        .select()
        .single();

      if (inquiryError) throw inquiryError;

      // Create inquiry lines
      if (input.lines.length > 0) {
        const lines = input.lines.map(line => ({
          inquiry_id: inquiry.id,
          quality: line.quality,
          color: line.color,
          requested_meters: line.requested_meters,
          scope: line.scope,
          lot_id: line.lot_id || null,
          notes: line.notes || null,
        }));

        const { error: linesError } = await supabase
          .from('inquiry_lines')
          .insert(lines);

        if (linesError) throw linesError;
      }

      toast.success(String(t('inquiry.createdSuccess', { number: inquiry.inquiry_number })));
      return inquiry;
    } catch (error: any) {
      toast.error(`${String(t('inquiry.createError'))}: ${error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const updateInquiryStatus = useCallback(async (id: string, status: InquiryStatus) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('inquiries')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(String(t('inquiry.statusUpdated')));
      return true;
    } catch (error: any) {
      toast.error(`${String(t('inquiry.updateError'))}: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [t]);

  const cancelInquiry = useCallback(async (id: string) => {
    return updateInquiryStatus(id, 'cancelled');
  }, [updateInquiryStatus]);

  const logInquiryView = useCallback(async (params: {
    inquiry_id?: string;
    action: string;
    is_bypass?: boolean;
    bypass_reason?: string;
    qualities_viewed?: string[];
    colors_viewed?: string[];
    meters_visible?: number;
    filters_used?: Record<string, any>;
  }) => {
    if (!user) return;

    try {
      await supabase.from('inquiry_view_logs').insert({
        inquiry_id: params.inquiry_id || null,
        user_id: user.id,
        action: params.action,
        is_bypass: params.is_bypass || false,
        bypass_reason: params.bypass_reason || null,
        qualities_viewed: params.qualities_viewed || null,
        colors_viewed: params.colors_viewed || null,
        meters_visible: params.meters_visible || null,
        filters_used: params.filters_used || null,
      });
    } catch (error) {
      console.error('Failed to log inquiry view:', error);
    }
  }, [user]);

  return {
    loading,
    fetchInquiries,
    fetchInquiry,
    createInquiry,
    updateInquiryStatus,
    cancelInquiry,
    logInquiryView,
  };
}

export function useStockTakeSessions() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const fetchActiveSessions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_take_sessions')
        .select('*')
        .eq('status', 'active')
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error: any) {
      toast.error(`${String(t('stockTakeSession.fetchError'))}: ${error.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [t]);

  const startSession = useCallback(async (input: {
    reason: string;
    notes?: string;
    expires_at?: string;
  }) => {
    if (!user) {
      toast.error(String(t('stockTakeSession.loginRequired')));
      return null;
    }

    try {
      setLoading(true);

      // Generate session number
      const { data: numberData, error: numberError } = await supabase
        .rpc('generate_stock_take_session_number');
      
      if (numberError) throw numberError;

      const { data, error } = await supabase
        .from('stock_take_sessions')
        .insert({
          session_number: numberData,
          started_by: user.id,
          reason: input.reason,
          notes: input.notes || null,
          expires_at: input.expires_at || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      toast.success(String(t('stockTakeSession.startedSuccess', { number: data.session_number })));
      return data;
    } catch (error: any) {
      toast.error(`${String(t('stockTakeSession.startError'))}: ${error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const endSession = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('stock_take_sessions')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(String(t('stockTakeSession.endedSuccess')));
      return true;
    } catch (error: any) {
      toast.error(`${String(t('stockTakeSession.endError'))}: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [t]);

  const hasActiveSession = useCallback(async () => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .rpc('has_active_stock_take_session', { p_user_id: user.id });
      
      if (error) throw error;
      return data as boolean;
    } catch {
      return false;
    }
  }, [user]);

  return {
    loading,
    fetchActiveSessions,
    startSession,
    endSession,
    hasActiveSession,
  };
}
