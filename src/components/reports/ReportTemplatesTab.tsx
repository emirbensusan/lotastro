import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  FileText, Plus, Edit, Trash2, Copy, 
  FileSpreadsheet, Mail, Database
} from 'lucide-react';
import { ReportBuilder } from './ReportBuilder';

interface ReportConfig {
  id: string;
  name: string;
  report_type: string;
  data_source: string | null;
  selected_joins: string[];
  columns_config: any[];
  columns: string[];
  filters: Record<string, any>;
  include_charts: boolean;
  output_formats: string[];
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
  priority: number;
}

interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: {
    id: string;
    column: string;
    operator: string;
    value: string;
    value2?: string;
  }[];
}

interface ReportStyling {
  headerBackgroundColor: string;
  headerTextColor: string;
  headerFontWeight: 'normal' | 'bold';
  alternateRowColors: boolean;
  evenRowColor: string;
  oddRowColor: string;
  borderStyle: 'none' | 'light' | 'medium' | 'heavy';
  fontSize: 'small' | 'medium' | 'large';
  conditionalRules: any[];
}

interface ScheduleConfig {
  enabled: boolean;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  hour: number;
  minute: number;
  timezone: string;
  day_of_week?: number;
  day_of_month?: number;
  recipients: {
    roles: string[];
    emails: string[];
  };
}

interface ReportBuilderConfig {
  id?: string;
  name: string;
  data_source: string;
  selected_joins: string[];
  columns_config: any[];
  calculated_fields?: any[];
  sorting: SortConfig[];
  filters: FilterGroup[];
  styling?: ReportStyling;
  output_formats: string[];
  include_charts: boolean;
  schedule_id?: string | null;
  schedule_config?: ScheduleConfig;
}

const OUTPUT_FORMATS = [
  { key: 'html', labelEn: 'HTML Email', labelTr: 'HTML E-posta', icon: Mail },
  { key: 'csv', labelEn: 'CSV File', labelTr: 'CSV Dosyası', icon: FileSpreadsheet },
  { key: 'excel', labelEn: 'Excel File', labelTr: 'Excel Dosyası', icon: FileSpreadsheet },
];

const ReportTemplatesTab: React.FC = () => {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ReportBuilderConfig | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('email_report_configs')
        .select('*')
        .order('name');

      if (error) throw error;
      
      setConfigs((data || []).map(d => ({
        ...d,
        columns: Array.isArray(d.columns) ? d.columns as string[] : [],
        columns_config: Array.isArray(d.columns_config) ? d.columns_config : [],
        selected_joins: Array.isArray(d.selected_joins) ? d.selected_joins as string[] : [],
        filters: typeof d.filters === 'object' ? d.filters as Record<string, any> : {},
        output_formats: d.output_formats || ['html'],
        include_charts: d.include_charts ?? false,
      })));
    } catch (error) {
      console.error('Error fetching report configs:', error);
      toast({
        title: String(t('error')),
        description: String(t('reportTemplates.loadError')),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingConfig(null);
    setBuilderOpen(true);
  };

  const handleEdit = (config: ReportConfig) => {
    // Convert to ReportBuilderConfig format
    const builderConfig: ReportBuilderConfig = {
      id: config.id,
      name: config.name,
      data_source: config.data_source || config.report_type || '',
      selected_joins: config.selected_joins || [],
      columns_config: config.columns_config || [],
      sorting: [],
      filters: Array.isArray(config.filters) ? config.filters as FilterGroup[] : [],
      output_formats: config.output_formats || ['html'],
      include_charts: config.include_charts || false,
    };
    setEditingConfig(builderConfig);
    setBuilderOpen(true);
  };

  const handleDuplicate = (config: ReportConfig) => {
    const builderConfig: ReportBuilderConfig = {
      name: `${config.name} (${String(t('copy'))})`,
      data_source: config.data_source || config.report_type || '',
      selected_joins: config.selected_joins || [],
      columns_config: config.columns_config || [],
      sorting: [],
      filters: Array.isArray(config.filters) ? config.filters as FilterGroup[] : [],
      output_formats: config.output_formats || ['html'],
      include_charts: config.include_charts || false,
    };
    setEditingConfig(builderConfig);
    setBuilderOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(String(t('reportTemplates.deleteConfirm')))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_report_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: String(t('deleted')),
        description: String(t('reportTemplates.deleteSuccess')),
      });
      fetchConfigs();
    } catch (error) {
      console.error('Error deleting config:', error);
      toast({
        title: String(t('error')),
        description: String(t('reportTemplates.deleteError')),
        variant: 'destructive',
      });
    }
  };

  const handleSaveReport = async (config: ReportBuilderConfig) => {
    const { data: user } = await supabase.auth.getUser();
    
    // Build the payload for the new schema (Phase 9 refinements)
    const payload: Record<string, unknown> = {
      name: config.name,
      report_type: config.data_source, // Keep for backward compatibility
      data_source: config.data_source,
      selected_joins: config.selected_joins,
      columns_config: config.columns_config,
      calculated_fields: config.calculated_fields || [],
      columns: config.columns_config.map(c => c.key), // Keep for backward compatibility
      filters: config.filters || [],
      sorting: config.sorting || [], // New in Phase 9
      styling: config.styling || null,
      schedule_config: config.schedule_config || null, // New in Phase 9
      include_charts: config.include_charts || false,
      output_formats: config.output_formats || ['html'],
      is_system: false,
      created_by: user.user?.id || null,
    };

    let reportConfigId: string | undefined = config.id;

    if (config.id) {
      const { error } = await supabase
        .from('email_report_configs')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', config.id);

      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('email_report_configs')
        .insert(payload as any)
        .select('id')
        .single();

      if (error) throw error;
      reportConfigId = data?.id;
    }

    // Handle schedule creation/update if enabled
    if (config.schedule_config?.enabled && reportConfigId) {
      const schedulePayload = {
        name: `${config.name} - Scheduled Report`,
        description: `Auto-generated schedule for report: ${config.name}`,
        schedule_type: config.schedule_config.schedule_type,
        schedule_config: {
          hour: config.schedule_config.hour,
          minute: config.schedule_config.minute,
          timezone: config.schedule_config.timezone,
          day_of_week: config.schedule_config.day_of_week,
          day_of_month: config.schedule_config.day_of_month,
        },
        is_active: true,
        created_by: user.user?.id || null,
      };

      // Check if there's an existing schedule linked to this report config
      // Use report_config_id for bidirectional linking (Phase 9)
      // Note: report_config_id is a new column added in Phase 9 migration
      const scheduleQuery = supabase
        .from('email_schedules')
        .select('id');
      
      // Use dynamic column access for the new report_config_id column
      const { data: existingSchedule } = await (scheduleQuery as any)
        .eq('report_config_id', reportConfigId)
        .maybeSingle();

      let scheduleId: string | undefined;

      if (existingSchedule) {
        // Update existing schedule
        const { error: updateError } = await supabase
          .from('email_schedules')
          .update({
            ...schedulePayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSchedule.id);

        if (updateError) {
          console.error('Error updating schedule:', updateError);
        } else {
          scheduleId = existingSchedule.id;
        }
      } else {
        // Create new schedule and link it bidirectionally
        const { data: newSchedule, error: insertError } = await supabase
          .from('email_schedules')
          .insert({
            ...schedulePayload,
            report_config_id: reportConfigId,
          } as any)
          .select('id')
          .single();

        if (insertError) {
          console.error('Error creating schedule:', insertError);
        } else {
          scheduleId = newSchedule?.id;
          
          // Update report config with schedule_id for bidirectional link
          await supabase
            .from('email_report_configs')
            .update({ schedule_id: scheduleId } as any)
            .eq('id', reportConfigId as string);
        }
      }

      // Handle recipients if schedule was created/updated
      if (scheduleId && config.schedule_config.recipients) {
        // Delete existing recipients
        await supabase
          .from('email_recipients')
          .delete()
          .eq('schedule_id', scheduleId);

        // Insert new recipients
        const newRecipients = [
          ...config.schedule_config.recipients.roles.map(role => ({
            schedule_id: scheduleId,
            recipient_type: 'role',
            recipient_value: role,
            is_active: true,
          })),
          ...config.schedule_config.recipients.emails.map(email => ({
            schedule_id: scheduleId,
            recipient_type: 'email',
            recipient_value: email,
            is_active: true,
          })),
        ];

        if (newRecipients.length > 0) {
          await supabase.from('email_recipients').insert(newRecipients);
        }
      }
    }

    toast({
      title: String(t('saved')),
      description: String(t('reportTemplates.saveSuccess')),
    });
    
    fetchConfigs();
  };

  const getDataSourceLabel = (config: ReportConfig) => {
    return config.data_source || config.report_type || '-';
  };

  const getColumnsCount = (config: ReportConfig) => {
    if (config.columns_config && config.columns_config.length > 0) {
      return config.columns_config.length;
    }
    return config.columns?.length || 0;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('reportTemplates.title')}
            </CardTitle>
            <CardDescription>
              {t('reportTemplates.description')}
            </CardDescription>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t('reportTemplates.newReport')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('reportTemplates.noTemplates')}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t('reportTemplates.reportName')}</TableHead>
                  <TableHead>{t('reportBuilder.dataSource')}</TableHead>
                  <TableHead>{t('reportTemplates.columns')}</TableHead>
                  <TableHead>{t('reportTemplates.outputFormats')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(config => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.name}</span>
                        {config.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            {t('system')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">{getDataSourceLabel(config)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getColumnsCount(config)} {t('reportTemplates.columnsCount')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {config.output_formats?.map(fmt => {
                          const format = OUTPUT_FORMATS.find(f => f.key === fmt);
                          if (!format) return null;
                          const Icon = format.icon;
                          return (
                            <TooltipProvider key={fmt}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="secondary" className="h-6 w-6 p-0 flex items-center justify-center">
                                    <Icon className="h-3 w-3" />
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {language === 'tr' ? format.labelTr : format.labelEn}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(config)}>
                          <Edit className="h-3 w-3 mr-1" />
                          {t('edit')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(config)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        {!config.is_system && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(config.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Report Builder Dialog */}
      <ReportBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={handleSaveReport}
        editingConfig={editingConfig}
      />
    </Card>
  );
};

export default ReportTemplatesTab;
