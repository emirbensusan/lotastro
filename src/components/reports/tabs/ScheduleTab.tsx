import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Calendar, Users, Globe, Plus, X, Mail } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ScheduleConfig, TIMEZONES, DAYS_OF_WEEK, ROLES } from '../reportBuilderTypes';

interface ScheduleTabProps {
  scheduleConfig: ScheduleConfig;
  onScheduleConfigChange: (config: ScheduleConfig) => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  scheduleConfig,
  onScheduleConfigChange,
}) => {
  const { language } = useLanguage();
  const [newRecipientEmail, setNewRecipientEmail] = useState('');

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

  return (
    <ScrollArea className="h-[450px]">
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
          </>
        )}
      </div>
    </ScrollArea>
  );
};
