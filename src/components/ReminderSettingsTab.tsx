import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Save, Loader2, Bell, Clock, Mail, X, Plus } from 'lucide-react';

interface EmailSettings {
  mo_reminder_days: { days: number[] };
  mo_reminder_schedule: { day_of_week: number; hour: number; minute: number; timezone: string };
  mo_reminder_recipients: { emails: string[] };
  mo_overdue_escalation: { daily_count: number; then_weekly: boolean };
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

const ReminderSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const [settings, setSettings] = useState<EmailSettings>({
    mo_reminder_days: { days: [7, 3] },
    mo_reminder_schedule: { day_of_week: 4, hour: 17, minute: 0, timezone: 'Europe/Istanbul' },
    mo_reminder_recipients: { emails: [] },
    mo_overdue_escalation: { daily_count: 3, then_weekly: true },
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
      ]);

      toast({
        title: t('success') as string,
        description: t('settings.saved') as string,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: t('error') as string,
        description: t('settings.saveError') as string,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
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
      {/* Reminder Days */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('settings.reminderDays')}
          </CardTitle>
          <CardDescription>{t('settings.reminderDaysDesc')}</CardDescription>
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
                {day} {t('settings.daysBeforeEta')}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {t('settings.selectedDays')}: {settings.mo_reminder_days.days.join(', ')} {t('settings.daysBeforeEta')}
          </p>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('settings.reminderSchedule')}
          </CardTitle>
          <CardDescription>{t('settings.reminderScheduleDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.dayOfWeek')}</Label>
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
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.time')}</Label>
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
            {t('settings.reminderRecipients')}
          </CardTitle>
          <CardDescription>{t('settings.reminderRecipientsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={t('settings.enterEmail') as string}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
              />
              <Button onClick={addEmail} variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                {t('settings.add')}
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
                <span className="text-sm text-muted-foreground">{t('settings.noRecipients')}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Escalation */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.overdueEscalation')}</CardTitle>
          <CardDescription>{t('settings.overdueEscalationDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>{t('settings.dailyRemindersCount')}</Label>
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
              {t('settings.thenWeekly')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          {t('settings.saveAll')}
        </Button>
      </div>
    </div>
  );
};

export default ReminderSettingsTab;