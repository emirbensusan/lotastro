import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Loader2, Save, Clock, Trash2 } from 'lucide-react';

const AuditRetentionSettings: React.FC = () => {
  const { t } = useLanguage();
  const [retentionDays, setRetentionDays] = useState<string>('365');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditLogCount, setAuditLogCount] = useState<number | null>(null);
  const [oldestLogDate, setOldestLogDate] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchAuditStats();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('email_settings')
        .select('setting_value')
        .eq('setting_key', 'audit_log_retention_days')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        // Handle both string and number values
        const value = typeof data.setting_value === 'string' 
          ? data.setting_value 
          : String(data.setting_value);
        setRetentionDays(value.replace(/"/g, ''));
      }
    } catch (error: any) {
      console.error('Error fetching retention settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditStats = async () => {
    try {
      // Get count
      const { count, error: countError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });

      if (!countError) {
        setAuditLogCount(count);
      }

      // Get oldest log
      const { data: oldestLog, error: oldestError } = await supabase
        .from('audit_logs')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!oldestError && oldestLog) {
        setOldestLogDate(oldestLog.created_at);
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  };

  const handleSave = async () => {
    const days = parseInt(retentionDays);
    if (isNaN(days) || days < 30) {
      toast.error(t('minRetentionDays') as string);
      return;
    }

    if (days > 3650) {
      toast.error(t('maxRetentionDays') as string);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('email_settings')
        .upsert({
          setting_key: 'audit_log_retention_days',
          setting_value: days.toString(),
          description: 'Number of days to retain audit logs before automatic cleanup',
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      toast.success(t('retentionSettingsSaved') as string);
    } catch (error: any) {
      toast.error(error.message || t('failedToSaveSettings') as string);
    } finally {
      setSaving(false);
    }
  };

  const calculateLogsToDelete = () => {
    if (!oldestLogDate || !auditLogCount) return null;
    
    const retentionMs = parseInt(retentionDays) * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs);
    const oldestDate = new Date(oldestLogDate);
    
    if (oldestDate >= cutoffDate) return 0;
    
    // This is an estimate - actual count would need a query
    return null; // We can't accurately estimate without a query
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t('auditLogRetention')}
        </CardTitle>
        <CardDescription>
          {t('auditLogRetentionDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">{t('totalAuditLogs')}</div>
            <div className="text-2xl font-bold">
              {auditLogCount !== null ? auditLogCount.toLocaleString() : '—'}
            </div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">{t('oldestLogDate')}</div>
            <div className="text-2xl font-bold">
              {oldestLogDate ? new Date(oldestLogDate).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>

        {/* Retention Setting */}
        <div className="space-y-2">
          <Label htmlFor="retention_days">{t('retentionPeriod')}</Label>
          <div className="flex gap-2">
            <Input
              id="retention_days"
              type="number"
              min="30"
              max="3650"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="max-w-32"
            />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('save')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('retentionHint')}
          </p>
        </div>

        {/* Preview */}
        <div className="p-4 border border-dashed rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            <span>
              {t('cleanupWillDelete')}{' '}
              <strong>{new Date(Date.now() - parseInt(retentionDays) * 24 * 60 * 60 * 1000).toLocaleDateString()}</strong>
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• {t('cleanupRunsDaily')}</p>
          <p>• {t('reversedLogsKept')}</p>
          <p>• {t('cleanupIrreversible')}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuditRetentionSettings;
