import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Clock, Shield, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MfaRequiredRoles {
  admin: boolean;
  senior_manager: boolean;
  accounting: boolean;
  warehouse_staff: boolean;
}

interface SessionSettings {
  timeout_minutes: number;
  warning_minutes: number;
  strict_timeout: boolean;
  mfa_required_roles: MfaRequiredRoles;
}

const DEFAULT_MFA_ROLES: MfaRequiredRoles = {
  admin: true,
  senior_manager: true,
  accounting: true,
  warehouse_staff: false,
};

const DEFAULT_SETTINGS: SessionSettings = {
  timeout_minutes: 30,
  warning_minutes: 5,
  strict_timeout: false,
  mfa_required_roles: DEFAULT_MFA_ROLES,
};

const SessionSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await (supabase
        .from('system_settings' as any)
        .select('setting_value')
        .eq('setting_key', 'session_config')
        .maybeSingle() as unknown as Promise<{ data: { setting_value: SessionSettings } | null; error: any }>);

      if (error) throw error;

      if (data?.setting_value) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data.setting_value,
        });
      }
    } catch (error) {
      console.error('Error loading session settings:', error);
      // Use defaults if table doesn't exist or other error
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase
        .from('system_settings' as any)
        .upsert({
          setting_key: 'session_config',
          setting_value: settings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key',
        }) as unknown as Promise<{ error: any }>);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: t('sessionSettingsSaved') as string,
      });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving session settings:', error);
      toast({
        title: t('error') as string,
        description: error.message || t('failedToSaveSettings') as string,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('sessionTimeoutSettings')}
          </CardTitle>
          <CardDescription>
            {t('sessionTimeoutDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timeout Duration */}
          <div className="space-y-2">
            <Label htmlFor="timeout">{t('sessionTimeoutDuration')}</Label>
            <Select
              value={settings.timeout_minutes.toString()}
              onValueChange={(value) => updateSetting('timeout_minutes', parseInt(value))}
            >
              <SelectTrigger id="timeout" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 {t('minutes')}</SelectItem>
                <SelectItem value="30">30 {t('minutes')}</SelectItem>
                <SelectItem value="60">60 {t('minutes')}</SelectItem>
                <SelectItem value="120">120 {t('minutes')}</SelectItem>
                <SelectItem value="240">240 {t('minutes')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('sessionTimeoutDurationHelp')}
            </p>
          </div>

          {/* Warning Period */}
          <div className="space-y-2">
            <Label htmlFor="warning">{t('sessionWarningPeriod')}</Label>
            <Select
              value={settings.warning_minutes.toString()}
              onValueChange={(value) => updateSetting('warning_minutes', parseInt(value))}
            >
              <SelectTrigger id="warning" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 {t('minutes')}</SelectItem>
                <SelectItem value="5">5 {t('minutes')}</SelectItem>
                <SelectItem value="10">10 {t('minutes')}</SelectItem>
                <SelectItem value="15">15 {t('minutes')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('sessionWarningPeriodHelp')}
            </p>
          </div>

          {/* Strict Timeout Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>{t('strictTimeout')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('strictTimeoutDescription')}
              </p>
            </div>
            <Switch
              checked={settings.strict_timeout}
              onCheckedChange={(checked) => updateSetting('strict_timeout', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('mfaRequirementsByRole')}
          </CardTitle>
          <CardDescription>
            {t('mfaRequirementsByRoleDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Admin */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>{t('admin')}</Label>
                <Badge variant="destructive" className="text-xs">{t('fullAccess')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('adminMfaDescription')}
              </p>
            </div>
            <Switch
              checked={settings.mfa_required_roles.admin}
              onCheckedChange={(checked) => updateSetting('mfa_required_roles', { ...settings.mfa_required_roles, admin: checked })}
            />
          </div>

          {/* Senior Manager */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>{t('seniorManager')}</Label>
                <Badge variant="secondary" className="text-xs">{t('approvalAccess')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('seniorManagerMfaDescription')}
              </p>
            </div>
            <Switch
              checked={settings.mfa_required_roles.senior_manager}
              onCheckedChange={(checked) => updateSetting('mfa_required_roles', { ...settings.mfa_required_roles, senior_manager: checked })}
            />
          </div>

          {/* Accounting */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>{t('accounting')}</Label>
                <Badge variant="secondary" className="text-xs">{t('financialAccess')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('accountingMfaDescription')}
              </p>
            </div>
            <Switch
              checked={settings.mfa_required_roles.accounting}
              onCheckedChange={(checked) => updateSetting('mfa_required_roles', { ...settings.mfa_required_roles, accounting: checked })}
            />
          </div>

          {/* Warehouse Staff */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>{t('warehouseStaff')}</Label>
                <Badge variant="outline" className="text-xs">{t('limitedAccess')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('warehouseStaffMfaDescription')}
              </p>
            </div>
            <Switch
              checked={settings.mfa_required_roles.warehouse_staff}
              onCheckedChange={(checked) => updateSetting('mfa_required_roles', { ...settings.mfa_required_roles, warehouse_staff: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={saveSettings} 
          disabled={saving || !hasChanges}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('saveSettings')}
        </Button>
      </div>
    </div>
  );
};

export default SessionSettingsTab;
