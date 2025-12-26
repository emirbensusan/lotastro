import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield, Key, Save } from 'lucide-react';

export interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_special: boolean;
  password_expiry_days: number | null;
  prevent_reuse_count: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  min_length: 8,
  require_uppercase: true,
  require_lowercase: true,
  require_number: true,
  require_special: true,
  password_expiry_days: null,
  prevent_reuse_count: 0,
};

// Hook to get password policy settings
export const usePasswordPolicy = () => {
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        const { data, error } = await (supabase
          .from('system_settings' as any)
          .select('setting_value')
          .eq('setting_key', 'password_policy')
          .maybeSingle() as unknown as Promise<{ data: { setting_value: PasswordPolicy } | null; error: any }>);

        if (error) throw error;

        if (data?.setting_value) {
          setPolicy({
            ...DEFAULT_PASSWORD_POLICY,
            ...data.setting_value,
          });
        }
      } catch (error) {
        console.error('Error loading password policy:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPolicy();
  }, []);

  return { policy, loading };
};

// Function to check if password meets policy
export const checkPasswordAgainstPolicy = (password: string, policy: PasswordPolicy) => {
  return {
    minLength: password.length >= policy.min_length,
    hasUppercase: !policy.require_uppercase || /[A-Z]/.test(password),
    hasLowercase: !policy.require_lowercase || /[a-z]/.test(password),
    hasNumber: !policy.require_number || /[0-9]/.test(password),
    hasSpecial: !policy.require_special || /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
};

export const isPasswordValidAgainstPolicy = (password: string, policy: PasswordPolicy): boolean => {
  const checks = checkPasswordAgainstPolicy(password, policy);
  return Object.values(checks).every(Boolean);
};

const PasswordPolicyTab: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPolicy();
  }, []);

  const loadPolicy = async () => {
    try {
      const { data, error } = await (supabase
        .from('system_settings' as any)
        .select('setting_value')
        .eq('setting_key', 'password_policy')
        .maybeSingle() as unknown as Promise<{ data: { setting_value: PasswordPolicy } | null; error: any }>);

      if (error) throw error;

      if (data?.setting_value) {
        setPolicy({
          ...DEFAULT_PASSWORD_POLICY,
          ...data.setting_value,
        });
      }
    } catch (error) {
      console.error('Error loading password policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePolicy = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase
        .from('system_settings' as any)
        .upsert({
          setting_key: 'password_policy',
          setting_value: policy,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key',
        }) as unknown as Promise<{ error: any }>);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: t('passwordPolicySaved') as string,
      });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving password policy:', error);
      toast({
        title: t('error') as string,
        description: error.message || t('failedToSaveSettings') as string,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePolicy = <K extends keyof PasswordPolicy>(key: K, value: PasswordPolicy[K]) => {
    setPolicy(prev => ({ ...prev, [key]: value }));
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
            <Key className="h-5 w-5" />
            {t('passwordRequirements')}
          </CardTitle>
          <CardDescription>
            {t('passwordRequirementsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Minimum Length */}
          <div className="space-y-2">
            <Label htmlFor="minLength">{t('minimumPasswordLength')}</Label>
            <Select
              value={policy.min_length.toString()}
              onValueChange={(value) => updatePolicy('min_length', parseInt(value))}
            >
              <SelectTrigger id="minLength" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 {t('characters')}</SelectItem>
                <SelectItem value="8">8 {t('characters')}</SelectItem>
                <SelectItem value="10">10 {t('characters')}</SelectItem>
                <SelectItem value="12">12 {t('characters')}</SelectItem>
                <SelectItem value="16">16 {t('characters')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Character Requirements */}
          <div className="space-y-4">
            <Label>{t('characterRequirements')}</Label>
            
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{t('requireUppercase')}</span>
              <Switch
                checked={policy.require_uppercase}
                onCheckedChange={(checked) => updatePolicy('require_uppercase', checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{t('requireLowercase')}</span>
              <Switch
                checked={policy.require_lowercase}
                onCheckedChange={(checked) => updatePolicy('require_lowercase', checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{t('requireNumber')}</span>
              <Switch
                checked={policy.require_number}
                onCheckedChange={(checked) => updatePolicy('require_number', checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{t('requireSpecialCharacter')}</span>
              <Switch
                checked={policy.require_special}
                onCheckedChange={(checked) => updatePolicy('require_special', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('passwordExpiry')}
          </CardTitle>
          <CardDescription>
            {t('passwordExpiryDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Expiry */}
          <div className="space-y-2">
            <Label htmlFor="expiry">{t('passwordExpiryDays')}</Label>
            <Select
              value={policy.password_expiry_days?.toString() || 'never'}
              onValueChange={(value) => updatePolicy('password_expiry_days', value === 'never' ? null : parseInt(value))}
            >
              <SelectTrigger id="expiry" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">{t('never')}</SelectItem>
                <SelectItem value="30">30 {t('days')}</SelectItem>
                <SelectItem value="60">60 {t('days')}</SelectItem>
                <SelectItem value="90">90 {t('days')}</SelectItem>
                <SelectItem value="180">180 {t('days')}</SelectItem>
                <SelectItem value="365">365 {t('days')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('passwordExpiryHelp')}
            </p>
          </div>

          {/* Prevent Reuse */}
          <div className="space-y-2">
            <Label htmlFor="reuse">{t('preventPasswordReuse')}</Label>
            <Select
              value={policy.prevent_reuse_count.toString()}
              onValueChange={(value) => updatePolicy('prevent_reuse_count', parseInt(value))}
            >
              <SelectTrigger id="reuse" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('disabled')}</SelectItem>
                <SelectItem value="3">{t('last')} 3 {t('passwords')}</SelectItem>
                <SelectItem value="5">{t('last')} 5 {t('passwords')}</SelectItem>
                <SelectItem value="10">{t('last')} 10 {t('passwords')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('preventPasswordReuseHelp')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={savePolicy} 
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

export default PasswordPolicyTab;
