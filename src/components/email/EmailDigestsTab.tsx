import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Clock, 
  Mail, 
  Calendar, 
  Users, 
  Settings2, 
  Play, 
  Pause, 
  RefreshCw,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Globe
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ScheduleConfig {
  hour?: number;
  minute?: number;
  timezone?: string;
  day_of_week?: number;
  day_of_month?: number;
  months?: number[];
}

interface RecipientsConfig {
  roles?: string[];
  emails?: string[];
}

interface DigestConfig {
  id: string;
  digest_type: string;
  is_enabled: boolean;
  schedule_type: string;
  schedule_config: ScheduleConfig | null;
  recipients: RecipientsConfig | null;
  cooldown_hours: number;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EmailSchedule {
  id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  schedule_type: string;
  schedule_config: {
    hour?: number;
    minute?: number;
    timezone?: string;
    day_of_week?: number;
    day_of_month?: number;
  };
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
}

interface EmailRecipient {
  id: string;
  template_id: string | null;
  schedule_id: string | null;
  recipient_type: string;
  recipient_value: string;
  is_active: boolean;
}

const TIMEZONES = [
  { value: 'Europe/Istanbul', label: 'Istanbul (GMT+3)' },
  { value: 'Europe/London', label: 'London (GMT+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1/+2)' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1/+2)' },
  { value: 'America/New_York', label: 'New York (GMT-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8/-7)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'senior_manager', label: 'Senior Manager' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'warehouse_staff', label: 'Warehouse Staff' },
];

const DIGEST_TYPE_INFO: Record<string, { icon: React.ReactNode; color: string; description: string }> = {
  stock_alerts: { 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    description: 'Low stock and overstock alerts for enabled qualities'
  },
  reservations_expiring: { 
    icon: <Clock className="h-4 w-4" />, 
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    description: 'Reservations expiring within configured days'
  },
  overdue_digest: { 
    icon: <XCircle className="h-4 w-4" />, 
    color: 'bg-red-500/10 text-red-600 border-red-500/20',
    description: 'Overdue manufacturing orders and customer orders'
  },
  pending_approvals: { 
    icon: <CheckCircle2 className="h-4 w-4" />, 
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    description: 'Pending catalog items and order approvals'
  },
  forecast_weekly: { 
    icon: <Calendar className="h-4 w-4" />, 
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    description: 'Weekly forecast summary and purchase recommendations'
  },
};

export function EmailDigestsTab() {
  const { t, language } = useLanguage();
  const [digestConfigs, setDigestConfigs] = useState<DigestConfig[]>([]);
  const [schedules, setSchedules] = useState<EmailSchedule[]>([]);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit dialog state
  const [editingDigest, setEditingDigest] = useState<DigestConfig | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<EmailSchedule> | null>(null);
  
  // Form state for editing
  const [formData, setFormData] = useState<{
    is_enabled: boolean;
    schedule_type: string;
    hour: number;
    minute: number;
    timezone: string;
    day_of_week: number;
    day_of_month: number;
    cooldown_hours: number;
    roles: string[];
    emails: string[];
    newEmail: string;
  }>({
    is_enabled: true,
    schedule_type: 'daily',
    hour: 8,
    minute: 0,
    timezone: 'Europe/Istanbul',
    day_of_week: 1,
    day_of_month: 1,
    cooldown_hours: 24,
    roles: [],
    emails: [],
    newEmail: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch digest configs
      const { data: digestData, error: digestError } = await supabase
        .from('email_digest_configs')
        .select('*')
        .order('digest_type');
      
      if (digestError) throw digestError;
      // Cast JSON fields to proper types
      const typedDigests = (digestData || []).map(d => ({
        ...d,
        schedule_config: d.schedule_config as ScheduleConfig | null,
        recipients: d.recipients as RecipientsConfig | null,
      }));
      setDigestConfigs(typedDigests);

      // Fetch schedules
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('email_schedules')
        .select('*')
        .order('name');
      
      if (scheduleError) throw scheduleError;
      // Cast JSON fields to proper types
      const typedSchedules = (scheduleData || []).map(s => ({
        ...s,
        schedule_config: s.schedule_config as EmailSchedule['schedule_config'],
      }));
      setSchedules(typedSchedules);

      // Fetch recipients
      const { data: recipientData, error: recipientError } = await supabase
        .from('email_recipients')
        .select('*');
      
      if (recipientError) throw recipientError;
      setRecipients(recipientData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(language === 'tr' ? 'Veriler yüklenirken hata oluştu' : 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDigest = async (digest: DigestConfig) => {
    try {
      const { error } = await supabase
        .from('email_digest_configs')
        .update({ 
          is_enabled: !digest.is_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', digest.id);

      if (error) throw error;

      setDigestConfigs(prev => prev.map(d => 
        d.id === digest.id ? { ...d, is_enabled: !d.is_enabled } : d
      ));

      toast.success(
        !digest.is_enabled 
          ? (language === 'tr' ? 'Digest etkinleştirildi' : 'Digest enabled')
          : (language === 'tr' ? 'Digest devre dışı bırakıldı' : 'Digest disabled')
      );
    } catch (error) {
      console.error('Error toggling digest:', error);
      toast.error(language === 'tr' ? 'Güncelleme hatası' : 'Update error');
    }
  };

  const openEditDialog = (digest: DigestConfig) => {
    setEditingDigest(digest);
    const config = digest.schedule_config || {};
    const recipients = digest.recipients || {};
    
    setFormData({
      is_enabled: digest.is_enabled,
      schedule_type: digest.schedule_type || 'daily',
      hour: config.hour ?? 8,
      minute: config.minute ?? 0,
      timezone: config.timezone || 'Europe/Istanbul',
      day_of_week: config.day_of_week ?? 1,
      day_of_month: config.day_of_month ?? 1,
      cooldown_hours: digest.cooldown_hours || 24,
      roles: recipients.roles || [],
      emails: recipients.emails || [],
      newEmail: '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveDigest = async () => {
    if (!editingDigest) return;
    
    setSaving(true);
    try {
      const scheduleConfig = {
        hour: formData.hour,
        minute: formData.minute,
        timezone: formData.timezone,
        day_of_week: formData.schedule_type === 'weekly' ? formData.day_of_week : undefined,
        day_of_month: (formData.schedule_type === 'monthly' || formData.schedule_type === 'quarterly') 
          ? formData.day_of_month : undefined,
      };

      const recipientsData = {
        roles: formData.roles,
        emails: formData.emails,
      };

      const { error } = await supabase
        .from('email_digest_configs')
        .update({
          is_enabled: formData.is_enabled,
          schedule_type: formData.schedule_type,
          schedule_config: scheduleConfig as Json,
          recipients: recipientsData as Json,
          cooldown_hours: formData.cooldown_hours,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingDigest.id);

      if (error) throw error;

      toast.success(language === 'tr' ? 'Digest ayarları kaydedildi' : 'Digest settings saved');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving digest:', error);
      toast.error(language === 'tr' ? 'Kaydetme hatası' : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    const email = formData.newEmail.trim();
    if (email && !formData.emails.includes(email) && email.includes('@')) {
      setFormData(prev => ({
        ...prev,
        emails: [...prev.emails, email],
        newEmail: '',
      }));
    }
  };

  const removeEmail = (email: string) => {
    setFormData(prev => ({
      ...prev,
      emails: prev.emails.filter(e => e !== email),
    }));
  };

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
    }));
  };

  const formatScheduleDescription = (digest: DigestConfig) => {
    const config = digest.schedule_config || {};
    const time = `${String(config.hour ?? 8).padStart(2, '0')}:${String(config.minute ?? 0).padStart(2, '0')}`;
    const tz = config.timezone || 'Europe/Istanbul';
    
    switch (digest.schedule_type) {
      case 'daily':
        return `${language === 'tr' ? 'Her gün' : 'Daily'} ${time} (${tz})`;
      case 'weekly':
        const day = DAYS_OF_WEEK.find(d => d.value === config.day_of_week)?.label || 'Monday';
        return `${language === 'tr' ? 'Her hafta' : 'Weekly'} ${day} ${time} (${tz})`;
      case 'monthly':
        return `${language === 'tr' ? 'Her ay' : 'Monthly'} ${config.day_of_month || 1}. ${language === 'tr' ? 'gün' : 'day'} ${time} (${tz})`;
      case 'quarterly':
        return `${language === 'tr' ? 'Her çeyrek' : 'Quarterly'} ${config.day_of_month || 1}. ${language === 'tr' ? 'gün' : 'day'} ${time} (${tz})`;
      default:
        return `${time} (${tz})`;
    }
  };

  const formatRecipients = (digest: DigestConfig) => {
    const recipients = digest.recipients || {};
    const parts: string[] = [];
    
    if (recipients.roles?.length) {
      parts.push(`${recipients.roles.length} ${language === 'tr' ? 'rol' : 'role(s)'}`);
    }
    if (recipients.emails?.length) {
      parts.push(`${recipients.emails.length} ${language === 'tr' ? 'e-posta' : 'email(s)'}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : (language === 'tr' ? 'Alıcı yok' : 'No recipients');
  };

  const getDigestTypeLabel = (type: string) => {
    const labels: Record<string, { en: string; tr: string }> = {
      stock_alerts: { en: 'Stock Alerts', tr: 'Stok Uyarıları' },
      reservations_expiring: { en: 'Expiring Reservations', tr: 'Süresi Dolan Rezervasyonlar' },
      overdue_digest: { en: 'Overdue Items', tr: 'Gecikmiş Kalemler' },
      pending_approvals: { en: 'Pending Approvals', tr: 'Bekleyen Onaylar' },
      forecast_weekly: { en: 'Weekly Forecast', tr: 'Haftalık Tahmin' },
    };
    return labels[type]?.[language] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {language === 'tr' ? 'E-posta Digest Yönetimi' : 'Email Digest Management'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === 'tr' 
              ? 'Digest e-postalarının zamanlamasını ve alıcılarını yapılandırın'
              : 'Configure scheduling and recipients for digest emails'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {language === 'tr' ? 'Yenile' : 'Refresh'}
        </Button>
      </div>

      {/* Digest Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {digestConfigs.map((digest) => {
          const typeInfo = DIGEST_TYPE_INFO[digest.digest_type] || {
            icon: <Mail className="h-4 w-4" />,
            color: 'bg-muted text-muted-foreground',
            description: '',
          };
          
          return (
            <Card key={digest.id} className={digest.is_enabled ? '' : 'opacity-60'}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={typeInfo.color}>
                      {typeInfo.icon}
                    </Badge>
                    <CardTitle className="text-base">
                      {getDigestTypeLabel(digest.digest_type)}
                    </CardTitle>
                  </div>
                  <Switch
                    checked={digest.is_enabled}
                    onCheckedChange={() => handleToggleDigest(digest)}
                  />
                </div>
                <CardDescription className="text-xs mt-1">
                  {typeInfo.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Schedule */}
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatScheduleDescription(digest)}
                  </span>
                </div>

                {/* Recipients */}
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatRecipients(digest)}
                  </span>
                </div>

                {/* Last Sent */}
                {digest.last_sent_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {language === 'tr' ? 'Son gönderim:' : 'Last sent:'}{' '}
                      {formatDistanceToNow(new Date(digest.last_sent_at), { addSuffix: true })}
                    </span>
                  </div>
                )}

                {/* Cooldown */}
                <div className="flex items-center gap-2 text-sm">
                  <Pause className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {language === 'tr' ? 'Bekleme süresi:' : 'Cooldown:'} {digest.cooldown_hours}h
                  </span>
                </div>

                <Separator />

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => openEditDialog(digest)}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Yapılandır' : 'Configure'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Template Schedules Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {language === 'tr' ? 'Şablon Zamanlamaları' : 'Template Schedules'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Bireysel e-posta şablonları için özel zamanlamalar'
              : 'Custom schedules for individual email templates'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{language === 'tr' ? 'Henüz zamanlama yok' : 'No schedules yet'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div 
                  key={schedule.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${schedule.is_active ? 'bg-green-500/10' : 'bg-muted'}`}>
                      {schedule.is_active ? (
                        <Play className="h-4 w-4 text-green-600" />
                      ) : (
                        <Pause className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{schedule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {schedule.schedule_type} • {schedule.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {schedule.last_run_status && (
                      <Badge variant={schedule.last_run_status === 'success' ? 'default' : 'destructive'}>
                        {schedule.last_run_status}
                      </Badge>
                    )}
                    {schedule.next_run_at && (
                      <span className="text-xs text-muted-foreground">
                        {language === 'tr' ? 'Sonraki:' : 'Next:'}{' '}
                        {format(new Date(schedule.next_run_at), 'MMM d, HH:mm')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Digest Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingDigest && getDigestTypeLabel(editingDigest.digest_type)} - {language === 'tr' ? 'Yapılandırma' : 'Configuration'}
            </DialogTitle>
            <DialogDescription>
              {language === 'tr' 
                ? 'Zamanlama ve alıcı ayarlarını düzenleyin'
                : 'Edit schedule and recipient settings'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="schedule" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="schedule">
                <Clock className="h-4 w-4 mr-2" />
                {language === 'tr' ? 'Zamanlama' : 'Schedule'}
              </TabsTrigger>
              <TabsTrigger value="recipients">
                <Users className="h-4 w-4 mr-2" />
                {language === 'tr' ? 'Alıcılar' : 'Recipients'}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="schedule" className="space-y-4 pr-4">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <Label>{language === 'tr' ? 'Etkin' : 'Enabled'}</Label>
                  <Switch
                    checked={formData.is_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
                  />
                </div>

                {/* Schedule Type */}
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Zamanlama Tipi' : 'Schedule Type'}</Label>
                  <Select
                    value={formData.schedule_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, schedule_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{language === 'tr' ? 'Günlük' : 'Daily'}</SelectItem>
                      <SelectItem value="weekly">{language === 'tr' ? 'Haftalık' : 'Weekly'}</SelectItem>
                      <SelectItem value="monthly">{language === 'tr' ? 'Aylık' : 'Monthly'}</SelectItem>
                      <SelectItem value="quarterly">{language === 'tr' ? 'Çeyreklik' : 'Quarterly'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Day of Week (for weekly) */}
                {formData.schedule_type === 'weekly' && (
                  <div className="space-y-2">
                    <Label>{language === 'tr' ? 'Gün' : 'Day of Week'}</Label>
                    <Select
                      value={String(formData.day_of_week)}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, day_of_week: parseInt(value) }))}
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
                )}

                {/* Day of Month (for monthly/quarterly) */}
                {(formData.schedule_type === 'monthly' || formData.schedule_type === 'quarterly') && (
                  <div className="space-y-2">
                    <Label>{language === 'tr' ? 'Ayın Günü' : 'Day of Month'}</Label>
                    <Select
                      value={String(formData.day_of_month)}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, day_of_month: parseInt(value) }))}
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

                {/* Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'tr' ? 'Saat' : 'Hour'}</Label>
                    <Select
                      value={String(formData.hour)}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hour: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String(i).padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'tr' ? 'Dakika' : 'Minute'}</Label>
                    <Select
                      value={String(formData.minute)}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, minute: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45].map((min) => (
                          <SelectItem key={min} value={String(min)}>
                            {String(min).padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Timezone */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {language === 'tr' ? 'Saat Dilimi' : 'Timezone'}
                  </Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
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

                {/* Cooldown */}
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Bekleme Süresi (saat)' : 'Cooldown (hours)'}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={formData.cooldown_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, cooldown_hours: parseInt(e.target.value) || 24 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'tr' 
                      ? 'Aynı digest için tekrar gönderim yapılmadan önce bekleme süresi'
                      : 'Minimum time before sending the same digest again'}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="recipients" className="space-y-4 pr-4">
                {/* Role-based Recipients */}
                <div className="space-y-3">
                  <Label>{language === 'tr' ? 'Rol Bazlı Alıcılar' : 'Role-based Recipients'}</Label>
                  <p className="text-xs text-muted-foreground">
                    {language === 'tr' 
                      ? 'Seçilen rollere sahip tüm kullanıcılar bu digest\'i alacak'
                      : 'All users with selected roles will receive this digest'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {ROLES.map((role) => (
                      <div key={role.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role.value}`}
                          checked={formData.roles.includes(role.value)}
                          onCheckedChange={() => toggleRole(role.value)}
                        />
                        <Label htmlFor={`role-${role.value}`} className="text-sm font-normal cursor-pointer">
                          {role.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Manual Email Recipients */}
                <div className="space-y-3">
                  <Label>{language === 'tr' ? 'Ek E-posta Adresleri' : 'Additional Email Addresses'}</Label>
                  <p className="text-xs text-muted-foreground">
                    {language === 'tr' 
                      ? 'Rol dışı alıcılar için manuel e-posta adresleri ekleyin'
                      : 'Add manual email addresses for non-role recipients'}
                  </p>
                  
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={formData.newEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, newEmail: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addEmail();
                        }
                      }}
                    />
                    <Button variant="outline" size="icon" onClick={addEmail}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {formData.emails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.emails.map((email) => (
                        <Badge key={email} variant="secondary" className="gap-1">
                          {email}
                          <button
                            onClick={() => removeEmail(email)}
                            className="ml-1 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <p className="text-sm font-medium mb-2">
                    {language === 'tr' ? 'Alıcı Özeti' : 'Recipient Summary'}
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      {language === 'tr' ? 'Roller:' : 'Roles:'}{' '}
                      {formData.roles.length > 0 
                        ? formData.roles.map(r => ROLES.find(role => role.value === r)?.label).join(', ')
                        : (language === 'tr' ? 'Seçilmedi' : 'None selected')}
                    </p>
                    <p>
                      {language === 'tr' ? 'E-postalar:' : 'Emails:'}{' '}
                      {formData.emails.length > 0 
                        ? `${formData.emails.length} ${language === 'tr' ? 'adres' : 'address(es)'}`
                        : (language === 'tr' ? 'Eklenmedi' : 'None added')}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {language === 'tr' ? 'İptal' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveDigest} disabled={saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {language === 'tr' ? 'Kaydet' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
