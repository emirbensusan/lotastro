import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Save, Loader2, Send, Pencil, AlertTriangle, Settings, Clock } from 'lucide-react';

interface ReportEmailSettings {
  email_sender: { name: string; email: string };
  report_delivery_defaults: {
    default_format: 'excel' | 'pdf' | 'csv';
    include_summary: boolean;
    compress_attachments: boolean;
  };
  report_branding: {
    company_name: string;
    logo_url: string;
    footer_text: string;
  };
}

const DEFAULT_SETTINGS: ReportEmailSettings = {
  email_sender: { name: 'LotAstro Reports', email: 'reports@lotastro.com' },
  report_delivery_defaults: {
    default_format: 'excel',
    include_summary: true,
    compress_attachments: false,
  },
  report_branding: {
    company_name: 'LotAstro',
    logo_url: '',
    footer_text: 'This is an automated report from LotAstro Inventory Management System.',
  },
};

const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 2 ? local[0] + '***' : local.slice(0, 2) + '***';
  const domainParts = domain.split('.');
  const maskedDomain = domainParts[0].length <= 3 
    ? domainParts[0][0] + '***' 
    : domainParts[0].slice(0, 3) + '***';
  return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join('.')}`;
};

const ReportSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [senderDialogOpen, setSenderDialogOpen] = useState(false);
  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false);
  const [editSenderName, setEditSenderName] = useState('');
  const [editSenderEmail, setEditSenderEmail] = useState('');
  
  const [settings, setSettings] = useState<ReportEmailSettings>(DEFAULT_SETTINGS);
  const [editBranding, setEditBranding] = useState(DEFAULT_SETTINGS.report_branding);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .in('setting_key', ['email_sender', 'report_delivery_defaults', 'report_branding']);

      if (error) throw error;

      const newSettings = { ...DEFAULT_SETTINGS };
      data?.forEach((row: any) => {
        if (row.setting_key === 'email_sender' && row.setting_value) {
          newSettings.email_sender = row.setting_value;
        } else if (row.setting_key === 'report_delivery_defaults' && row.setting_value) {
          newSettings.report_delivery_defaults = { ...DEFAULT_SETTINGS.report_delivery_defaults, ...row.setting_value };
        } else if (row.setting_key === 'report_branding' && row.setting_value) {
          newSettings.report_branding = { ...DEFAULT_SETTINGS.report_branding, ...row.setting_value };
        }
      });
      setSettings(newSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: any) => {
    // First check if setting exists
    const { data: existing } = await supabase
      .from('email_settings')
      .select('id')
      .eq('setting_key', key)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('email_settings')
        .update({ setting_value: value, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq('setting_key', key);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('email_settings')
        .insert([{ setting_key: key, setting_value: value, updated_by: user?.id }]);
      if (error) throw error;
    }
  };

  const openSenderDialog = () => {
    setEditSenderName(settings.email_sender.name);
    setEditSenderEmail(settings.email_sender.email);
    setSenderDialogOpen(true);
  };

  const saveSenderSettings = async () => {
    if (!editSenderEmail.includes('@')) {
      toast({
        title: t('error') as string,
        description: t('reportSettings.invalidEmail') as string,
        variant: 'destructive'
      });
      return;
    }
    
    setSaving(true);
    try {
      const newSenderValue = { name: editSenderName, email: editSenderEmail };
      await saveSetting('email_sender', newSenderValue);
      
      setSettings({
        ...settings,
        email_sender: newSenderValue
      });
      setSenderDialogOpen(false);
      toast({
        title: t('success') as string,
        description: t('reportSettings.senderSaved') as string,
      });
    } catch (error) {
      console.error('Error saving sender settings:', error);
      toast({
        title: t('error') as string,
        description: t('reportSettings.settingsSaveFailed') as string,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const openBrandingDialog = () => {
    setEditBranding({ ...settings.report_branding });
    setBrandingDialogOpen(true);
  };

  const saveBrandingSettings = async () => {
    setSaving(true);
    try {
      await saveSetting('report_branding', editBranding);
      setSettings({
        ...settings,
        report_branding: editBranding
      });
      setBrandingDialogOpen(false);
      toast({
        title: t('success') as string,
        description: t('reportSettings.brandingSaved') as string,
      });
    } catch (error) {
      console.error('Error saving branding settings:', error);
      toast({
        title: t('error') as string,
        description: t('reportSettings.settingsSaveFailed') as string,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeliveryDefaultsChange = async (key: keyof typeof settings.report_delivery_defaults, value: any) => {
    const newDefaults = { ...settings.report_delivery_defaults, [key]: value };
    setSettings({ ...settings, report_delivery_defaults: newDefaults });
    
    try {
      await saveSetting('report_delivery_defaults', newDefaults);
      toast({
        title: t('success') as string,
        description: t('reportSettings.settingsSaved') as string,
      });
    } catch (error) {
      console.error('Error saving delivery defaults:', error);
      toast({
        title: t('error') as string,
        description: t('reportSettings.settingsSaveFailed') as string,
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sender Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t('reportSettings.senderConfiguration')}
          </CardTitle>
          <CardDescription>
            {t('reportSettings.senderDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">{t('reportSettings.senderNameLabel')}</Label>
                  <span className="font-medium">{settings.email_sender.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">{t('reportSettings.emailLabel')}</Label>
                  <span className="font-mono text-sm">{maskEmail(settings.email_sender.email)}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={openSenderDialog}>
                <Pencil className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t('reportSettings.senderWarning')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sender Edit Dialog */}
      <Dialog open={senderDialogOpen} onOpenChange={setSenderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reportSettings.editSender')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="senderName">{t('reportSettings.senderName')}</Label>
              <Input
                id="senderName"
                value={editSenderName}
                onChange={(e) => setEditSenderName(e.target.value)}
                placeholder="LotAstro Reports"
              />
              <p className="text-xs text-muted-foreground">
                {t('reportSettings.senderNameHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderEmail">{t('reportSettings.senderEmail')}</Label>
              <Input
                id="senderEmail"
                type="email"
                value={editSenderEmail}
                onChange={(e) => setEditSenderEmail(e.target.value)}
                placeholder="reports@lotastro.com"
              />
              <p className="text-xs text-muted-foreground">
                {t('reportSettings.senderEmailHint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenderDialogOpen(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button onClick={saveSenderSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('reportSettings.deliveryDefaults')}
          </CardTitle>
          <CardDescription>
            {t('reportSettings.deliveryDefaultsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('reportSettings.defaultFormat')}</Label>
              <p className="text-sm text-muted-foreground">{t('reportSettings.defaultFormatHint')}</p>
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={settings.report_delivery_defaults.default_format}
              onChange={(e) => handleDeliveryDefaultsChange('default_format', e.target.value)}
            >
              <option value="excel">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('reportSettings.includeSummary')}</Label>
              <p className="text-sm text-muted-foreground">{t('reportSettings.includeSummaryHint')}</p>
            </div>
            <Switch
              checked={settings.report_delivery_defaults.include_summary}
              onCheckedChange={(checked) => handleDeliveryDefaultsChange('include_summary', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('reportSettings.compressAttachments')}</Label>
              <p className="text-sm text-muted-foreground">{t('reportSettings.compressAttachmentsHint')}</p>
            </div>
            <Switch
              checked={settings.report_delivery_defaults.compress_attachments}
              onCheckedChange={(checked) => handleDeliveryDefaultsChange('compress_attachments', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Report Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('reportSettings.reportBranding')}
          </CardTitle>
          <CardDescription>
            {t('reportSettings.reportBrandingDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">{t('reportSettings.companyName')}</Label>
                <span className="font-medium">{settings.report_branding.company_name || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">{t('reportSettings.footerText')}</Label>
                <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                  {settings.report_branding.footer_text || '-'}
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={openBrandingDialog}>
              <Pencil className="h-4 w-4 mr-1" />
              {t('edit')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Branding Edit Dialog */}
      <Dialog open={brandingDialogOpen} onOpenChange={setBrandingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reportSettings.editBranding')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">{t('reportSettings.companyName')}</Label>
              <Input
                id="companyName"
                value={editBranding.company_name}
                onChange={(e) => setEditBranding({ ...editBranding, company_name: e.target.value })}
                placeholder="LotAstro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">{t('reportSettings.logoUrl')}</Label>
              <Input
                id="logoUrl"
                value={editBranding.logo_url}
                onChange={(e) => setEditBranding({ ...editBranding, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                {t('reportSettings.logoUrlHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="footerText">{t('reportSettings.footerText')}</Label>
              <Input
                id="footerText"
                value={editBranding.footer_text}
                onChange={(e) => setEditBranding({ ...editBranding, footer_text: e.target.value })}
                placeholder="This is an automated report..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrandingDialogOpen(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button onClick={saveBrandingSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportSettingsTab;
