import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Calendar, Users, Globe, Plus, X, Mail, Send, Loader2, CheckCircle, FileText, CalendarClock, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScheduleConfig, TIMEZONES, DAYS_OF_WEEK, ROLES } from '../reportBuilderTypes';

export interface EmailConfig {
  subject: string;
  introText: string;
  includeAttachments: boolean;
  attachmentFormats: string[];
}

interface ScheduleTabProps {
  scheduleConfig: ScheduleConfig;
  onScheduleConfigChange: (config: ScheduleConfig) => void;
  emailConfig?: EmailConfig;
  onEmailConfigChange?: (config: EmailConfig) => void;
  reportName?: string;
  reportId?: string;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  scheduleConfig,
  onScheduleConfigChange,
  emailConfig,
  onEmailConfigChange,
  reportName = '',
  reportId,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const defaultEmailConfig: EmailConfig = {
    subject: '',
    introText: '',
    includeAttachments: true,
    attachmentFormats: ['excel'],
  };

  const updateConfig = (updates: Partial<ScheduleConfig>) => {
    onScheduleConfigChange({ ...scheduleConfig, ...updates });
  };

  const addEmail = () => {
    const email = newRecipientEmail.trim();
    if (email && email.includes('@') && !scheduleConfig.recipients.emails.includes(email)) {
      onScheduleConfigChange({
        ...scheduleConfig,
        recipients: {
          ...scheduleConfig.recipients,
          emails: [...scheduleConfig.recipients.emails, email]
        }
      });
      setNewRecipientEmail('');
    }
  };

  const removeEmail = (email: string) => {
    onScheduleConfigChange({
      ...scheduleConfig,
      recipients: {
        ...scheduleConfig.recipients,
        emails: scheduleConfig.recipients.emails.filter(e => e !== email)
      }
    });
  };

  const toggleRole = (roleValue: string) => {
    const isSelected = scheduleConfig.recipients.roles.includes(roleValue);
    const newRoles = isSelected
      ? scheduleConfig.recipients.roles.filter(r => r !== roleValue)
      : [...scheduleConfig.recipients.roles, roleValue];
    onScheduleConfigChange({
      ...scheduleConfig,
      recipients: { ...scheduleConfig.recipients, roles: newRoles }
    });
  };

  const currentEmailConfig = emailConfig || defaultEmailConfig;

  const updateEmailConfig = (updates: Partial<EmailConfig>) => {
    if (onEmailConfigChange) {
      onEmailConfigChange({ ...currentEmailConfig, ...updates });
    }
  };

  // Calculate next run time
  const getNextRunTime = useMemo(() => {
    if (!scheduleConfig.enabled) return null;

    const now = new Date();
    let nextRun = new Date();
    nextRun.setHours(scheduleConfig.hour, scheduleConfig.minute, 0, 0);

    if (scheduleConfig.schedule_type === 'daily') {
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    } else if (scheduleConfig.schedule_type === 'weekly') {
      const targetDay = scheduleConfig.day_of_week || 1;
      const currentDay = now.getDay();
      let daysUntilNext = targetDay - currentDay;
      if (daysUntilNext < 0 || (daysUntilNext === 0 && nextRun <= now)) {
        daysUntilNext += 7;
      }
      nextRun.setDate(now.getDate() + daysUntilNext);
    } else if (scheduleConfig.schedule_type === 'monthly') {
      const targetDay = scheduleConfig.day_of_month || 1;
      nextRun.setDate(targetDay);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
    }

    return nextRun;
  }, [scheduleConfig]);

  const formatNextRun = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({
        title: language === 'tr' ? 'E-posta gerekli' : 'Email required',
        description: language === 'tr' ? 'Lütfen bir e-posta adresi girin' : 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-scheduled-report', {
        body: {
          testMode: true,
          testRecipient: testEmail.trim(),
          reportId: reportId,
          reportName: reportName,
        },
      });

      if (error) throw error;

      toast({
        title: language === 'tr' ? 'Test e-postası gönderildi' : 'Test email sent',
        description: language === 'tr' ? `E-posta ${testEmail} adresine gönderildi` : `Email sent to ${testEmail}`,
      });
      setTestEmail('');
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: language === 'tr' ? 'Gönderilemedi' : 'Failed to send',
        description: error.message || (language === 'tr' ? 'Test e-postası gönderilemedi' : 'Could not send test email'),
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-6 pr-4">
        {/* Enable/Disable Scheduling */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">
              {language === 'tr' ? 'Otomatik Zamanlama' : 'Automatic Scheduling'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {language === 'tr'
                ? 'Bu raporu belirli zamanlarda otomatik olarak gönder'
                : 'Automatically send this report at scheduled times'}
            </p>
          </div>
          <Switch
            checked={scheduleConfig.enabled}
            onCheckedChange={(enabled) => updateConfig({ enabled })}
          />
        </div>

        {scheduleConfig.enabled && (
          <>
            <Separator />

            {/* Schedule Frequency */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-medium">
                  {language === 'tr' ? 'Sıklık' : 'Frequency'}
                </Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Zamanlama Tipi' : 'Schedule Type'}</Label>
                  <Select
                    value={scheduleConfig.schedule_type}
                    onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                      updateConfig({ schedule_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">
                        {language === 'tr' ? 'Günlük' : 'Daily'}
                      </SelectItem>
                      <SelectItem value="weekly">
                        {language === 'tr' ? 'Haftalık' : 'Weekly'}
                      </SelectItem>
                      <SelectItem value="monthly">
                        {language === 'tr' ? 'Aylık' : 'Monthly'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scheduleConfig.schedule_type === 'weekly' && (
                  <div className="space-y-2">
                    <Label>{language === 'tr' ? 'Gün' : 'Day'}</Label>
                    <Select
                      value={String(scheduleConfig.day_of_week || 1)}
                      onValueChange={(value) =>
                        updateConfig({ day_of_week: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day.value} value={String(day.value)}>
                            {language === 'tr' ? day.labelTr : day.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {scheduleConfig.schedule_type === 'monthly' && (
                  <div className="space-y-2">
                    <Label>{language === 'tr' ? 'Ayın Günü' : 'Day of Month'}</Label>
                    <Select
                      value={String(scheduleConfig.day_of_month || 1)}
                      onValueChange={(value) =>
                        updateConfig({ day_of_month: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Saat' : 'Hour'}</Label>
                  <Select
                    value={String(scheduleConfig.hour)}
                    onValueChange={(value) =>
                      updateConfig({ hour: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                        <SelectItem key={hour} value={String(hour)}>
                          {String(hour).padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Dakika' : 'Minute'}</Label>
                  <Select
                    value={String(scheduleConfig.minute)}
                    onValueChange={(value) =>
                      updateConfig({ minute: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 15, 30, 45].map((minute) => (
                        <SelectItem key={minute} value={String(minute)}>
                          :{String(minute).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    {language === 'tr' ? 'Saat Dilimi' : 'Timezone'}
                  </Label>
                  <Select
                    value={scheduleConfig.timezone}
                    onValueChange={(value) =>
                      updateConfig({ timezone: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Recipients */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-medium">
                  {language === 'tr' ? 'Alıcılar' : 'Recipients'}
                </Label>
              </div>

              {/* Role Recipients */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {language === 'tr' ? 'Role Göre' : 'By Role'}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((role) => {
                    const isSelected = scheduleConfig.recipients.roles.includes(role.value);
                    return (
                      <div
                        key={role.value}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleRole(role.value)}
                      >
                        <Checkbox checked={isSelected} />
                        <span className="text-sm">
                          {language === 'tr' ? role.labelTr : role.labelEn}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Email Recipients */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {language === 'tr' ? 'E-posta Adresleri' : 'Email Addresses'}
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={newRecipientEmail}
                    onChange={(e) => setNewRecipientEmail(e.target.value)}
                    placeholder={language === 'tr' ? 'E-posta ekle...' : 'Add email...'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addEmail}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {scheduleConfig.recipients.emails.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {scheduleConfig.recipients.emails.map((email) => (
                      <Badge
                        key={email}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        <Mail className="h-3 w-3" />
                        {email}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-destructive/20"
                          onClick={() => removeEmail(email)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Recipients Summary */}
              {(scheduleConfig.recipients.roles.length > 0 || scheduleConfig.recipients.emails.length > 0) && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  {language === 'tr'
                    ? `${scheduleConfig.recipients.roles.length} rol ve ${scheduleConfig.recipients.emails.length} e-posta adresi seçildi`
                    : `${scheduleConfig.recipients.roles.length} role(s) and ${scheduleConfig.recipients.emails.length} email address(es) selected`}
                </div>
              )}
            </div>

            <Separator />

            {/* Email Content Configuration */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-medium">
                  {language === 'tr' ? 'E-posta İçeriği' : 'Email Content'}
                </Label>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'E-posta Konusu' : 'Email Subject'}</Label>
                  <Input
                    value={currentEmailConfig.subject}
                    onChange={(e) => updateEmailConfig({ subject: e.target.value })}
                    placeholder={language === 'tr' 
                      ? `${reportName || 'Rapor'} - {{date}}` 
                      : `${reportName || 'Report'} - {{date}}`
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'tr' 
                      ? 'Kullanılabilir değişkenler: {{date}}, {{report_name}}, {{period}}'
                      : 'Available variables: {{date}}, {{report_name}}, {{period}}'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Giriş Metni' : 'Introduction Text'}</Label>
                  <Textarea
                    value={currentEmailConfig.introText}
                    onChange={(e) => updateEmailConfig({ introText: e.target.value })}
                    placeholder={language === 'tr' 
                      ? 'Bu e-posta otomatik olarak oluşturulmuştur...'
                      : 'This email was automatically generated...'}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{language === 'tr' ? 'Ekleri Dahil Et' : 'Include Attachments'}</Label>
                    <Switch
                      checked={currentEmailConfig.includeAttachments}
                      onCheckedChange={(checked) => updateEmailConfig({ includeAttachments: checked })}
                    />
                  </div>
                  
                  {currentEmailConfig.includeAttachments && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['excel', 'csv', 'pdf'].map((format) => {
                        const isSelected = currentEmailConfig.attachmentFormats.includes(format);
                        return (
                          <div
                            key={format}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => {
                              const newFormats = isSelected
                                ? currentEmailConfig.attachmentFormats.filter(f => f !== format)
                                : [...currentEmailConfig.attachmentFormats, format];
                              updateEmailConfig({ attachmentFormats: newFormats });
                            }}
                          >
                            <Checkbox checked={isSelected} />
                            <span className="text-sm uppercase">{format}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Next Run Preview */}
            {scheduleConfig.enabled && getNextRunTime && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    {language === 'tr' ? 'Sonraki Çalıştırma' : 'Next Run'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-medium">{formatNextRun(getNextRunTime)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'tr' ? `Saat dilimi: ${scheduleConfig.timezone}` : `Timezone: ${scheduleConfig.timezone}`}
                  </p>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Test Email */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-medium">
                  {language === 'tr' ? 'Test E-postası' : 'Test Email'}
                </Label>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder={language === 'tr' ? 'test@ornek.com' : 'test@example.com'}
                      disabled={sendingTest}
                    />
                    <Button
                      variant="outline"
                      onClick={handleSendTestEmail}
                      disabled={sendingTest || !testEmail.trim()}
                    >
                      {sendingTest ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          {language === 'tr' ? 'Gönder' : 'Send'}
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {language === 'tr' 
                      ? 'Mevcut yapılandırmayla bir test e-postası gönderin'
                      : 'Send a test email with the current configuration'}
                  </p>
                </CardContent>
              </Card>

              {!reportId && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    {language === 'tr' 
                      ? 'Test e-postası göndermek için önce raporu kaydedin'
                      : 'Save the report first to send test emails'}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
};
