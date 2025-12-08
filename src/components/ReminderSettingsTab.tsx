import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Save, Loader2, Bell, Clock, Mail, X, Plus, Send, Pencil, AlertTriangle } from 'lucide-react';

interface EmailSettings {
  mo_reminder_days: { days: number[] };
  mo_reminder_schedule: { day_of_week: number; hour: number; minute: number; timezone: string };
  mo_reminder_recipients: { emails: string[] };
  mo_overdue_escalation: { daily_count: number; then_weekly: boolean };
  email_sender: { name: string; email: string };
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

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

const ReminderSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSender, setSavingSender] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [senderDialogOpen, setSenderDialogOpen] = useState(false);
  const [editSenderName, setEditSenderName] = useState('');
  const [editSenderEmail, setEditSenderEmail] = useState('');

  const [settings, setSettings] = useState<EmailSettings>({
    mo_reminder_days: { days: [7, 3] },
    mo_reminder_schedule: { day_of_week: 4, hour: 17, minute: 0, timezone: 'Europe/Istanbul' },
    mo_reminder_recipients: { emails: [] },
    mo_overdue_escalation: { daily_count: 3, then_weekly: true },
    email_sender: { name: 'LotAstro', email: 'info@lotastro.com' },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*');

      if (error) throw error;

      const newSettings = { ...settings };
      data?.forEach((row: any) => {
        if (row.setting_key in newSettings) {
          newSettings[row.setting_key as keyof EmailSettings] = row.setting_value;
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
    try {
      const { error } = await supabase
        .from('email_settings')
        .update({ setting_value: value, updated_by: user?.id })
        .eq('setting_key', key);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting('mo_reminder_days', settings.mo_reminder_days),
        saveSetting('mo_reminder_schedule', settings.mo_reminder_schedule),
        saveSetting('mo_reminder_recipients', settings.mo_reminder_recipients),
        saveSetting('mo_overdue_escalation', settings.mo_overdue_escalation),
        saveSetting('email_sender', settings.email_sender),
      ]);

      toast({
        title: t('success') as string,
        description: t('emailSettings.settingsSaved') as string,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: t('error') as string,
        description: t('emailSettings.settingsSaveFailed') as string,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
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
        description: 'Invalid email address',
        variant: 'destructive'
      });
      return;
    }
    
    setSavingSender(true);
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
        description: 'Sender configuration saved successfully.',
      });
    } catch (error) {
      console.error('Error saving sender settings:', error);
      toast({
        title: t('error') as string,
        description: 'Failed to save sender configuration.',
        variant: 'destructive'
      });
    } finally {
      setSavingSender(false);
    }
  };

  const addEmail = () => {
    if (!newEmail || !newEmail.includes('@')) return;
    if (settings.mo_reminder_recipients.emails.includes(newEmail)) return;

    setSettings({
      ...settings,
      mo_reminder_recipients: {
        emails: [...settings.mo_reminder_recipients.emails, newEmail]
      }
    });
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    setSettings({
      ...settings,
      mo_reminder_recipients: {
        emails: settings.mo_reminder_recipients.emails.filter(e => e !== email)
      }
    });
  };

  const toggleReminderDay = (day: number) => {
    const currentDays = settings.mo_reminder_days.days;
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort((a, b) => b - a);

    setSettings({
      ...settings,
      mo_reminder_days: { days: newDays }
    });
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
            {t('emailSettings.senderConfiguration') || 'Sender Configuration'}
          </CardTitle>
          <CardDescription>
            {t('emailSettings.senderDescription') || 'Configure the email address used to send notifications'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Sender Name:</Label>
                  <span className="font-medium">{settings.email_sender.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Email:</Label>
                  <span className="font-mono text-sm">{maskEmail(settings.email_sender.email)}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={openSenderDialog}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t('emailSettings.senderWarning') || 'The sender email must be verified in Resend. If you change domains, update this setting and verify the new domain at resend.com/domains.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sender Edit Dialog */}
      <Dialog open={senderDialogOpen} onOpenChange={setSenderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('emailSettings.editSender') || 'Edit Email Sender'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="senderName">{t('emailSettings.senderName') || 'Sender Name'}</Label>
              <Input
                id="senderName"
                value={editSenderName}
                onChange={(e) => setEditSenderName(e.target.value)}
                placeholder="LotAstro"
              />
              <p className="text-xs text-muted-foreground">
                This name appears in the "From" field of emails
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderEmail">{t('emailSettings.senderEmail') || 'Sender Email'}</Label>
              <Input
                id="senderEmail"
                type="email"
                value={editSenderEmail}
                onChange={(e) => setEditSenderEmail(e.target.value)}
                placeholder="info@lotastro.com"
              />
              <p className="text-xs text-muted-foreground">
                Must be a verified email address in Resend
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenderDialogOpen(false)} disabled={savingSender}>
              Cancel
            </Button>
            <Button onClick={saveSenderSettings} disabled={savingSender}>
              {savingSender && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Days */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('emailSettings.reminderDays')}
          </CardTitle>
          <CardDescription>Configure how many days before ETA to send reminders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[1, 3, 5, 7, 14, 21, 30].map((day) => (
              <Badge
                key={day}
                variant={settings.mo_reminder_days.days.includes(day) ? 'default' : 'outline'}
                className="cursor-pointer text-sm px-3 py-1"
                onClick={() => toggleReminderDay(day)}
              >
                {day} days before
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Selected: {settings.mo_reminder_days.days.join(', ')} days before ETA
          </p>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('emailSettings.reminderSchedule')}
          </CardTitle>
          <CardDescription>Configure when reminder emails are sent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('emailSettings.dayOfWeek')}</Label>
              <Select
                value={String(settings.mo_reminder_schedule.day_of_week)}
                onValueChange={(v) => setSettings({
                  ...settings,
                  mo_reminder_schedule: { ...settings.mo_reminder_schedule, day_of_week: parseInt(v) }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={String(day.value)}>
                      {t(`emailSettings.${day.label.toLowerCase()}`) || day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('emailSettings.timeOfDay')}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={settings.mo_reminder_schedule.hour}
                  onChange={(e) => setSettings({
                    ...settings,
                    mo_reminder_schedule: { ...settings.mo_reminder_schedule, hour: parseInt(e.target.value) || 0 }
                  })}
                  className="w-20"
                />
                <span className="self-center">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={settings.mo_reminder_schedule.minute}
                  onChange={(e) => setSettings({
                    ...settings,
                    mo_reminder_schedule: { ...settings.mo_reminder_schedule, minute: parseInt(e.target.value) || 0 }
                  })}
                  className="w-20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.timezone')}</Label>
              <Input
                value={settings.mo_reminder_schedule.timezone}
                onChange={(e) => setSettings({
                  ...settings,
                  mo_reminder_schedule: { ...settings.mo_reminder_schedule, timezone: e.target.value }
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('emailSettings.recipients')}
          </CardTitle>
          <CardDescription>Email addresses that will receive reminder notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
              />
              <Button onClick={addEmail} variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                {t('emailSettings.addEmail')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.mo_reminder_recipients.emails.map((email) => (
                <Badge key={email} variant="secondary" className="pr-1">
                  {email}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                    onClick={() => removeEmail(email)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {settings.mo_reminder_recipients.emails.length === 0 && (
                <span className="text-sm text-muted-foreground">No recipients configured</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Escalation */}
      <Card>
        <CardHeader>
          <CardTitle>{t('emailSettings.overdueEscalation')}</CardTitle>
          <CardDescription>Configure how overdue orders are escalated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>Daily reminders for first X days</Label>
              <Input
                type="number"
                min="1"
                max="7"
                value={settings.mo_overdue_escalation.daily_count}
                onChange={(e) => setSettings({
                  ...settings,
                  mo_overdue_escalation: { ...settings.mo_overdue_escalation, daily_count: parseInt(e.target.value) || 3 }
                })}
                className="w-20"
              />
            </div>
            <p className="text-sm text-muted-foreground pt-6">
              {t('emailSettings.dailyForDays')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          {t('emailSettings.saveAll')}
        </Button>
      </div>
    </div>
  );
};

export default ReminderSettingsTab;