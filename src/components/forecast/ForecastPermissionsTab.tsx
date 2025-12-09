import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Save, Loader2 } from 'lucide-react';

interface Props {
  settings: any;
  onSettingsChange: (settings: any) => void;
  onRefresh: () => void;
  readOnly: boolean;
}

const ROLES = ['warehouse_staff', 'accounting', 'senior_manager', 'admin'];
const ROLE_LABELS: Record<string, string> = {
  warehouse_staff: 'Warehouse Staff',
  accounting: 'Accounting',
  senior_manager: 'Senior Manager',
  admin: 'Admin',
};

const PERMISSIONS = [
  { key: 'view_forecasts', label: 'View Forecasts', description: 'Access forecast page and view recommendations' },
  { key: 'run_forecasts', label: 'Run Forecasts', description: 'Manually trigger forecast calculations' },
  { key: 'modify_settings', label: 'Modify Settings', description: 'Change global and per-quality settings' },
  { key: 'import_data', label: 'Import Data', description: 'Upload historical demand data' },
];

const ForecastPermissionsTab: React.FC<Props> = ({ settings, onSettingsChange, onRefresh, readOnly }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  
  const [permissions, setPermissions] = useState<Record<string, string[]>>(
    settings?.permissions || {
      view_forecasts: ['admin', 'senior_manager'],
      run_forecasts: ['admin', 'senior_manager'],
      modify_settings: ['admin'],
      import_data: ['admin', 'senior_manager'],
    }
  );

  const togglePermission = (permKey: string, role: string) => {
    setPermissions(prev => {
      const current = prev[permKey] || [];
      const updated = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role];
      return { ...prev, [permKey]: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Log audit
      await supabase.from('forecast_settings_audit_log').insert({
        changed_by: user?.id,
        scope: 'global',
        parameter_name: 'permissions',
        old_value: settings?.permissions,
        new_value: permissions,
      });

      const { error } = await supabase
        .from('forecast_settings_global')
        .update({ 
          permissions,
          updated_by: user?.id 
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: t('forecast.permissionsSaved') as string || 'Permissions saved successfully',
      });
      onRefresh();
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('forecast.permissionsConfiguration') || 'Permissions Configuration'}</CardTitle>
        <CardDescription>
          {t('forecast.permissionsConfigurationDesc') || 'Control which roles can access different forecast features'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium">{t('permission') || 'Permission'}</th>
                {ROLES.map(role => (
                  <th key={role} className="text-center py-3 px-4 font-medium">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(perm => (
                <tr key={perm.key} className="border-b">
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium">{t(`forecast.perm.${perm.key}`) || perm.label}</div>
                      <div className="text-sm text-muted-foreground">{perm.description}</div>
                    </div>
                  </td>
                  {ROLES.map(role => (
                    <td key={role} className="text-center py-4 px-4">
                      <Checkbox
                        checked={(permissions[perm.key] || []).includes(role)}
                        onCheckedChange={() => togglePermission(perm.key, role)}
                        disabled={readOnly || (perm.key === 'modify_settings' && role === 'admin')}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground">
          {t('forecast.adminAlwaysHasAccess') || 'Note: Admin always has access to all features.'}
        </p>

        {!readOnly && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t('savePermissions') || 'Save Permissions'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ForecastPermissionsTab;