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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Clock, 
  Calendar, 
  Users, 
  Settings2, 
  Play, 
  Pause, 
  RefreshCw,
  Plus,
  Trash2,
  Save,
  FileText,
  Mail,
  Edit,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Globe,
  SendHorizontal
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ScheduleConfig {
  hour?: number;
  minute?: number;
  timezone?: string;
  day_of_week?: number;
  day_of_month?: number;
}

interface EmailSchedule {
  id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  schedule_type: string;
  schedule_config: ScheduleConfig;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
  created_by: string | null;
}

interface EmailRecipient {
  id: string;
  schedule_id: string;
  recipient_type: string;
  recipient_value: string;
  is_active: boolean;
}

interface ReportConfig {
  id: string;
  name: string;
  report_type: string;
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

const ScheduledReportsTab: React.FC = () => {
  const { t, language } = useLanguage();
  const [schedules, setSchedules] = useState<EmailSchedule[]>([]);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [reportConfigs, setReportConfigs] = useState<ReportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingScheduleId, setSendingScheduleId] = useState<string | null>(null);
  
  // Edit dialog state
  const [editingSchedule, setEditingSchedule] = useState<EmailSchedule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    template_id: string;
    is_active: boolean;
    schedule_type: string;
    hour: number;
    minute: number;
    timezone: string;
    day_of_week: number;
    day_of_month: number;
    roles: string[];
    emails: string[];
    newEmail: string;
  }>({
    name: '',
    description: '',
    template_id: '',
    is_active: true,
    schedule_type: 'daily',
    hour: 8,
    minute: 0,
    timezone: 'Europe/Istanbul',
    day_of_week: 1,
    day_of_month: 1,
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
      // Fetch schedules
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('email_schedules')
        .select('*')
        .order('name');
      
      if (scheduleError) throw scheduleError;
      
      const typedSchedules = (scheduleData || []).map(s => ({
        ...s,
        schedule_config: s.schedule_config as ScheduleConfig,
      }));
      setSchedules(typedSchedules);

      // Fetch recipients
      const { data: recipientData, error: recipientError } = await supabase
        .from('email_recipients')
        .select('*')
        .not('schedule_id', 'is', null);
      
      if (recipientError) throw recipientError;
      setRecipients(recipientData || []);

      // Fetch report configs for linking
      const { data: configData, error: configError } = await supabase
        .from('email_report_configs')
        .select('id, name, report_type')
        .order('name');
      
      if (configError) throw configError;
      setReportConfigs(configData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(String(t('scheduledReports.loadError')));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (schedule: EmailSchedule) => {
    try {
      const { error } = await supabase
        .from('email_schedules')
        .update({ 
          is_active: !schedule.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', schedule.id);

      if (error) throw error;

      setSchedules(prev => prev.map(s => 
        s.id === schedule.id ? { ...s, is_active: !s.is_active } : s
      ));

      toast.success(
        !schedule.is_active 
          ? String(t('scheduledReports.enabled'))
          : String(t('scheduledReports.disabled'))
      );
    } catch (error) {
      console.error('Error toggling schedule:', error);
      toast.error(String(t('scheduledReports.updateError')));
    }
  };

  const openCreateDialog = () => {
    setIsCreating(true);
    setEditingSchedule(null);
    setFormData({
      name: '',
      description: '',
      template_id: '',
      is_active: true,
      schedule_type: 'daily',
      hour: 8,
      minute: 0,
      timezone: 'Europe/Istanbul',
      day_of_week: 1,
      day_of_month: 1,
      roles: ['admin', 'senior_manager'],
      emails: [],
      newEmail: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (schedule: EmailSchedule) => {
    setIsCreating(false);
    setEditingSchedule(schedule);
    const config = schedule.schedule_config || {};
    
    // Get recipients for this schedule
    const scheduleRecipients = recipients.filter(r => r.schedule_id === schedule.id);
    const roleRecipients = scheduleRecipients.filter(r => r.recipient_type === 'role').map(r => r.recipient_value);
    const emailRecipients = scheduleRecipients.filter(r => r.recipient_type === 'email').map(r => r.recipient_value);
    
    setFormData({
      name: schedule.name,
      description: schedule.description || '',
      template_id: schedule.template_id || '',
      is_active: schedule.is_active,
      schedule_type: schedule.schedule_type || 'daily',
      hour: config.hour ?? 8,
      minute: config.minute ?? 0,
      timezone: config.timezone || 'Europe/Istanbul',
      day_of_week: config.day_of_week ?? 1,
      day_of_month: config.day_of_month ?? 1,
      roles: roleRecipients,
      emails: emailRecipients,
      newEmail: '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error(String(t('scheduledReports.nameRequired')));
      return;
    }
    
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const scheduleConfig = {
        hour: formData.hour,
        minute: formData.minute,
        timezone: formData.timezone,
        day_of_week: formData.schedule_type === 'weekly' ? formData.day_of_week : undefined,
        day_of_month: formData.schedule_type === 'monthly' ? formData.day_of_month : undefined,
      };

      let scheduleId: string;

      if (isCreating) {
        // Create new schedule
        const { data, error } = await supabase
          .from('email_schedules')
          .insert({
            name: formData.name,
            description: formData.description || null,
            template_id: formData.template_id || null,
            schedule_type: formData.schedule_type,
            schedule_config: scheduleConfig as Json,
            is_active: formData.is_active,
            created_by: user.user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        scheduleId = data.id;
      } else {
        // Update existing schedule
        const { error } = await supabase
          .from('email_schedules')
          .update({
            name: formData.name,
            description: formData.description || null,
            template_id: formData.template_id || null,
            schedule_type: formData.schedule_type,
            schedule_config: scheduleConfig as Json,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSchedule!.id);

        if (error) throw error;
        scheduleId = editingSchedule!.id;
      }

      // Update recipients
      // First delete existing recipients for this schedule
      await supabase
        .from('email_recipients')
        .delete()
        .eq('schedule_id', scheduleId);

      // Insert new recipients
      const newRecipients = [
        ...formData.roles.map(role => ({
          schedule_id: scheduleId,
          recipient_type: 'role',
          recipient_value: role,
          is_active: true,
        })),
        ...formData.emails.map(email => ({
          schedule_id: scheduleId,
          recipient_type: 'email',
          recipient_value: email,
          is_active: true,
        })),
      ];

      if (newRecipients.length > 0) {
        const { error: recipientError } = await supabase
          .from('email_recipients')
          .insert(newRecipients);

        if (recipientError) throw recipientError;
      }

      toast.success(String(t('scheduledReports.saveSuccess')));
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error(String(t('scheduledReports.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (schedule: EmailSchedule) => {
    if (!confirm(String(t('scheduledReports.deleteConfirm')))) return;

    try {
      // Delete recipients first
      await supabase
        .from('email_recipients')
        .delete()
        .eq('schedule_id', schedule.id);

      // Delete schedule
      const { error } = await supabase
        .from('email_schedules')
        .delete()
        .eq('id', schedule.id);

      if (error) throw error;

      toast.success(String(t('scheduledReports.deleteSuccess')));
      fetchData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error(String(t('scheduledReports.deleteError')));
    }
  };

  const handleSendNow = async (schedule: EmailSchedule) => {
    if (!schedule.template_id) {
      toast.error(String(t('scheduledReports.noTemplateLinked')));
      return;
    }
    
    const recipientCounts = getRecipientsCount(schedule.id);
    if (recipientCounts.total === 0) {
      toast.error(String(t('scheduledReports.noRecipientsToSend')));
      return;
    }

    setSendingScheduleId(schedule.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-scheduled-report', {
        body: { 
          scheduleId: schedule.id,
          manual: true 
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(
          String(t('scheduledReports.sendSuccess')).replace('{count}', String(data.emailsSent || 0))
        );
        fetchData(); // Refresh to update last_run_at
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Error sending report:', error);
      toast.error(String(t('scheduledReports.sendError')));
    } finally {
      setSendingScheduleId(null);
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

  const formatScheduleDescription = (schedule: EmailSchedule) => {
    const config = schedule.schedule_config || {};
    const time = `${String(config.hour ?? 8).padStart(2, '0')}:${String(config.minute ?? 0).padStart(2, '0')}`;
    const tz = config.timezone || 'Europe/Istanbul';
    
    switch (schedule.schedule_type) {
      case 'daily':
        return `${t('daily')} ${time} (${tz})`;
      case 'weekly':
        const day = DAYS_OF_WEEK.find(d => d.value === config.day_of_week)?.label || 'Monday';
        return `${t('weekly')} ${day} ${time} (${tz})`;
      case 'monthly':
        return `${t('monthly')} ${config.day_of_month || 1}. ${t('day')} ${time} (${tz})`;
      default:
        return `${time} (${tz})`;
    }
  };

  const getRecipientsCount = (scheduleId: string) => {
    const scheduleRecipients = recipients.filter(r => r.schedule_id === scheduleId && r.is_active);
    const roles = scheduleRecipients.filter(r => r.recipient_type === 'role').length;
    const emails = scheduleRecipients.filter(r => r.recipient_type === 'email').length;
    return { roles, emails, total: roles + emails };
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case 'success':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t('success')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            {t('failed')}
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            {t('partial')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  const getLinkedTemplateName = (templateId: string | null) => {
    if (!templateId) return null;
    const config = reportConfigs.find(c => c.id === templateId);
    return config?.name;
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('scheduledReports.title')}
              </CardTitle>
              <CardDescription>
                {t('scheduledReports.description')}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('refresh')}
              </Button>
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                {t('scheduledReports.create')}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Schedules Table */}
      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('scheduledReports.noSchedules')}</h3>
            <p className="text-muted-foreground mb-4">{t('scheduledReports.noSchedulesDescription')}</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('scheduledReports.createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">{t('active')}</TableHead>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('schedule')}</TableHead>
                  <TableHead>{t('recipients')}</TableHead>
                  <TableHead>{t('reportTemplate')}</TableHead>
                  <TableHead>{t('lastRun')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => {
                  const recipientCounts = getRecipientsCount(schedule.id);
                  const templateName = getLinkedTemplateName(schedule.template_id);
                  
                  return (
                    <TableRow key={schedule.id} className={!schedule.is_active ? 'opacity-60' : ''}>
                      <TableCell>
                        <Switch
                          checked={schedule.is_active}
                          onCheckedChange={() => handleToggleSchedule(schedule)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{schedule.name}</div>
                          {schedule.description && (
                            <div className="text-xs text-muted-foreground">{schedule.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{formatScheduleDescription(schedule)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {recipientCounts.roles > 0 && `${recipientCounts.roles} ${t('scheduledReports.rolesCount')}`}
                            {recipientCounts.roles > 0 && recipientCounts.emails > 0 && ', '}
                            {recipientCounts.emails > 0 && `${recipientCounts.emails} ${t('scheduledReports.emailsCount')}`}
                            {recipientCounts.total === 0 && t('scheduledReports.noRecipients')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {templateName ? (
                          <Badge variant="outline" className="bg-primary/10">
                            <FileText className="h-3 w-3 mr-1" />
                            {templateName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {schedule.last_run_at ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(schedule.last_run_at), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(schedule.last_run_status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSendNow(schedule)}
                            disabled={sendingScheduleId === schedule.id || !schedule.template_id}
                            title={String(t('scheduledReports.sendNow'))}
                          >
                            {sendingScheduleId === schedule.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <SendHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(schedule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(schedule)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {isCreating ? t('scheduledReports.createNew') : t('scheduledReports.editSchedule')}
            </DialogTitle>
            <DialogDescription>
              {isCreating ? t('scheduledReports.createDescription') : t('scheduledReports.editDescription')}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="general">{t('general')}</TabsTrigger>
                <TabsTrigger value="schedule">{t('schedule')}</TabsTrigger>
                <TabsTrigger value="recipients">{t('recipients')}</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">{t('name')} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={String(t('scheduledReports.namePlaceholder'))}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">{t('description')}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={String(t('scheduledReports.descriptionPlaceholder'))}
                    rows={2}
                  />
                </div>

                {/* Report Template */}
                <div className="space-y-2">
                  <Label>{t('reportTemplate')}</Label>
                  <Select
                    value={formData.template_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, template_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={String(t('scheduledReports.selectTemplate'))} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('scheduledReports.noTemplate')}</SelectItem>
                      {reportConfigs.map(config => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('scheduledReports.templateHelp')}
                  </p>
                </div>

                {/* Active */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <Label>{t('active')}</Label>
                    <p className="text-xs text-muted-foreground">{t('scheduledReports.activeHelp')}</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                {/* Schedule Type */}
                <div className="space-y-2">
                  <Label>{t('scheduleType')}</Label>
                  <Select
                    value={formData.schedule_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, schedule_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('daily')}</SelectItem>
                      <SelectItem value="weekly">{t('weekly')}</SelectItem>
                      <SelectItem value="monthly">{t('monthly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Day of Week (for weekly) */}
                {formData.schedule_type === 'weekly' && (
                  <div className="space-y-2">
                    <Label>{t('dayOfWeek')}</Label>
                    <Select
                      value={String(formData.day_of_week)}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, day_of_week: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map(day => (
                          <SelectItem key={day.value} value={String(day.value)}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Day of Month (for monthly) */}
                {formData.schedule_type === 'monthly' && (
                  <div className="space-y-2">
                    <Label>{t('dayOfMonth')}</Label>
                    <Select
                      value={String(formData.day_of_month)}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, day_of_month: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
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
                    <Label>{t('hour')}</Label>
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
                    <Label>{t('minute')}</Label>
                    <Select
                      value={String(formData.minute)}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, minute: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45].map(min => (
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
                    {t('timezone')}
                  </Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="recipients" className="space-y-4">
                {/* Role Recipients */}
                <div className="space-y-3">
                  <Label>{t('scheduledReports.roleRecipients')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(role => (
                      <div key={role.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`role-${role.value}`}
                          checked={formData.roles.includes(role.value)}
                          onCheckedChange={() => toggleRole(role.value)}
                        />
                        <Label htmlFor={`role-${role.value}`} className="font-normal cursor-pointer">
                          {role.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('scheduledReports.roleRecipientsHelp')}
                  </p>
                </div>

                <Separator />

                {/* Email Recipients */}
                <div className="space-y-3">
                  <Label>{t('scheduledReports.emailRecipients')}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.newEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, newEmail: e.target.value }))}
                      placeholder="email@example.com"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                    />
                    <Button type="button" variant="outline" onClick={addEmail}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {formData.emails.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.emails.map(email => (
                        <Badge key={email} variant="secondary" className="gap-1">
                          <Mail className="h-3 w-3" />
                          {email}
                          <button
                            type="button"
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
              </TabsContent>
            </Tabs>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('save')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduledReportsTab;
