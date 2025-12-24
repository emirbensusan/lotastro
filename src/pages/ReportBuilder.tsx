import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, Columns, ArrowUpDown, Palette, Save, FileSpreadsheet,
  Loader2, Calculator, Filter, Eye, EyeOff, Clock, ArrowLeft, ChevronDown, ChevronUp
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CalculatedField } from '@/components/reports/CalculatedFieldBuilder';
import { FilterGroup, FilterBuilder } from '@/components/reports/FilterBuilder';
import { ReportStyling, StyleBuilder } from '@/components/reports/StyleBuilder';
import { ReportPreview } from '@/components/reports/ReportPreview';
import {
  DataSourceTab,
  ColumnsTab,
  CalculatedFieldsTab,
  SortingTab,
  OutputTab,
  ScheduleTab,
} from '@/components/reports/tabs';
import {
  ColumnDefinition,
  SelectedColumn,
  DataSource,
  JoinDefinition,
  SortConfig,
  ScheduleConfig,
  ReportConfig,
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_REPORT_STYLING,
} from '@/components/reports/reportBuilderTypes';

const ReportBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get('duplicate');
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('datasource');
  const [showPreview, setShowPreview] = useState(true);

  // Loading state
  const [loading, setLoading] = useState(false);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Data source state
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [availableColumns, setAvailableColumns] = useState<ColumnDefinition[]>([]);
  const [availableJoins, setAvailableJoins] = useState<JoinDefinition[]>([]);
  const [selectedJoins, setSelectedJoins] = useState<string[]>([]);

  // Column configuration state
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
  const [columnSearch, setColumnSearch] = useState('');

  // Report configuration state
  const [reportName, setReportName] = useState('');
  const [outputFormats, setOutputFormats] = useState<string[]>(['html']);
  const [includeCharts, setIncludeCharts] = useState(false);

  // Calculated fields state
  const [calculatedFields, setCalculatedFields] = useState<CalculatedField[]>([]);

  // Filter state
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);

  // Sort configuration state
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);

  // Styling state
  const [reportStyling, setReportStyling] = useState<ReportStyling>(DEFAULT_REPORT_STYLING);

  // Schedule state
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);

  // Track if editing or duplicating
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  // Fetch data sources on mount
  useEffect(() => {
    fetchDataSources();
  }, []);

  // Load existing report if editing or duplicating
  useEffect(() => {
    const loadId = id || duplicateId;
    if (loadId) {
      loadReportById(loadId, !!duplicateId);
    } else {
      setInitialLoading(false);
    }
  }, [id, duplicateId]);

  const fetchDataSources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-report-schema');
      if (error) throw error;
      setDataSources(data.dataSources || []);
    } catch (error) {
      console.error('Error fetching data sources:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to load data sources',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDataSourceColumns = async (dataSourceKey: string, includeJoins: boolean = false) => {
    setColumnsLoading(true);
    try {
      console.log('[ReportBuilder] Fetching columns for:', dataSourceKey, 'includeJoins:', includeJoins);
      
      const { data, error } = await supabase.functions.invoke('get-report-schema', {
        body: { dataSource: dataSourceKey, includeJoins },
      });
      
      console.log('[ReportBuilder] Raw response - data:', data, 'error:', error);
      
      if (error) {
        console.error('[ReportBuilder] Error from edge function:', error);
        throw new Error(error.message || 'Failed to fetch columns');
      }
      
      if (!data) {
        console.error('[ReportBuilder] No data returned from edge function');
        throw new Error('No data returned from edge function');
      }
      
      // Handle both direct response and wrapped response
      const responseData = data.data ? data.data : data;
      const columns: ColumnDefinition[] = responseData.columns || [];
      const joins: JoinDefinition[] = responseData.availableJoins || [];
      
      console.log('[ReportBuilder] Parsed columns:', columns.length, 'joins:', joins.length);
      console.log('[ReportBuilder] First column sample:', columns[0]);
      
      setAvailableColumns(columns);
      setAvailableJoins(joins);
    } catch (error) {
      console.error('[ReportBuilder] Error fetching columns:', error);
      toast({
        title: String(t('error')),
        description: language === 'tr' ? 'Sütunlar yüklenemedi' : 'Failed to load columns',
        variant: 'destructive',
      });
    } finally {
      setColumnsLoading(false);
    }
  };

  const loadReportById = async (reportId: string, isDuplicate: boolean) => {
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_report_configs')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Report not found');

      // Set state from loaded data
      setReportName(isDuplicate ? `${data.name} (${t('copy')})` : data.name);
      setSelectedDataSource(data.data_source || '');
      setSelectedJoins(Array.isArray(data.selected_joins) ? data.selected_joins as string[] : []);
      setSelectedColumns(Array.isArray(data.columns_config) ? (data.columns_config as unknown as SelectedColumn[]) : []);
      setCalculatedFields(Array.isArray(data.calculated_fields) ? (data.calculated_fields as unknown as CalculatedField[]) : []);
      setOutputFormats(data.output_formats || ['html']);
      setIncludeCharts(data.include_charts || false);
      setFilterGroups(Array.isArray(data.filters) ? (data.filters as unknown as FilterGroup[]) : []);
      setSortConfigs(Array.isArray(data.sorting) ? (data.sorting as unknown as SortConfig[]) : []);
      setReportStyling((data.styling as unknown as ReportStyling) || DEFAULT_REPORT_STYLING);
      setScheduleConfig((data.schedule_config as unknown as ScheduleConfig) || DEFAULT_SCHEDULE_CONFIG);

      // Only set editingId if not duplicating
      if (!isDuplicate) {
        setEditingId(data.id);
      }

      // Fetch columns for the loaded data source
      if (data.data_source) {
        await fetchDataSourceColumns(data.data_source, (data.selected_joins as string[] || []).length > 0);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to load report',
        variant: 'destructive',
      });
      navigate('/reports');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleDataSourceSelect = (key: string) => {
    setSelectedDataSource(key);
    setSelectedColumns([]);
    setSelectedJoins([]);
    fetchDataSourceColumns(key, false);
  };

  const handleJoinToggle = (joinTable: string) => {
    const newJoins = selectedJoins.includes(joinTable)
      ? selectedJoins.filter(j => j !== joinTable)
      : [...selectedJoins, joinTable];
    setSelectedJoins(newJoins);
    fetchDataSourceColumns(selectedDataSource, newJoins.length > 0);
  };

  const handleAddColumn = (column: ColumnDefinition) => {
    if (!selectedColumns.find(c => c.key === column.key)) {
      setSelectedColumns([...selectedColumns, { ...column }]);
    }
  };

  const handleRemoveColumn = (columnKey: string) => {
    setSelectedColumns(selectedColumns.filter(c => c.key !== columnKey));
  };

  const handleColumnSortToggle = (columnKey: string) => {
    setSelectedColumns(selectedColumns.map(col => {
      if (col.key === columnKey) {
        const nextSort = col.sortOrder === null ? 'asc' : col.sortOrder === 'asc' ? 'desc' : null;
        return { ...col, sortOrder: nextSort };
      }
      return col;
    }));
  };

  const handleReorderColumns = (newColumns: SelectedColumn[]) => {
    setSelectedColumns(newColumns);
  };

  const handleSave = async () => {
    if (!reportName.trim()) {
      toast({
        title: String(t('validationError')),
        description: language === 'tr' ? 'Rapor adı gerekli' : 'Report name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedDataSource) {
      toast({
        title: String(t('validationError')),
        description: language === 'tr' ? 'Lütfen bir veri kaynağı seçin' : 'Please select a data source',
        variant: 'destructive',
      });
      return;
    }

    if (selectedColumns.length === 0) {
      toast({
        title: String(t('validationError')),
        description: language === 'tr' ? 'En az bir sütun seçin' : 'Please select at least one column',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      const payload: Record<string, unknown> = {
        name: reportName,
        report_type: selectedDataSource,
        data_source: selectedDataSource,
        selected_joins: selectedJoins,
        columns_config: selectedColumns,
        calculated_fields: calculatedFields,
        columns: selectedColumns.map(c => c.key),
        filters: filterGroups,
        sorting: sortConfigs.length > 0
          ? sortConfigs
          : selectedColumns
              .filter(c => c.sortOrder)
              .map((c, index) => ({ column: c.key, direction: c.sortOrder!, priority: index })),
        styling: reportStyling,
        schedule_config: scheduleConfig.enabled ? scheduleConfig : null,
        include_charts: includeCharts,
        output_formats: outputFormats,
        is_system: false,
        created_by: user.user?.id || null,
      };

      let reportConfigId: string | undefined = editingId;

      if (editingId) {
        const { error } = await supabase
          .from('email_report_configs')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', editingId);

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
      if (scheduleConfig.enabled && reportConfigId) {
        const schedulePayload = {
          name: `${reportName} - Scheduled Report`,
          description: `Auto-generated schedule for report: ${reportName}`,
          schedule_type: scheduleConfig.schedule_type,
          schedule_config: {
            hour: scheduleConfig.hour,
            minute: scheduleConfig.minute,
            timezone: scheduleConfig.timezone,
            day_of_week: scheduleConfig.day_of_week,
            day_of_month: scheduleConfig.day_of_month,
          },
          is_active: true,
          created_by: user.user?.id || null,
        };

        const { data: existingSchedule } = await (supabase
          .from('email_schedules')
          .select('id') as any)
          .eq('report_config_id', reportConfigId)
          .maybeSingle();

        let scheduleId: string | undefined;

        if (existingSchedule) {
          const { error: updateError } = await supabase
            .from('email_schedules')
            .update({
              ...schedulePayload,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSchedule.id);

          if (!updateError) {
            scheduleId = existingSchedule.id;
          }
        } else {
          const { data: newSchedule, error: insertError } = await supabase
            .from('email_schedules')
            .insert({
              ...schedulePayload,
              report_config_id: reportConfigId,
            } as any)
            .select('id')
            .single();

          if (!insertError && newSchedule) {
            scheduleId = newSchedule.id;
            await supabase
              .from('email_report_configs')
              .update({ schedule_id: scheduleId } as any)
              .eq('id', reportConfigId as string);
          }
        }

        // Handle recipients
        if (scheduleId && scheduleConfig.recipients) {
          await supabase
            .from('email_recipients')
            .delete()
            .eq('schedule_id', scheduleId);

          const newRecipients = [
            ...scheduleConfig.recipients.roles.map(role => ({
              schedule_id: scheduleId,
              recipient_type: 'role',
              recipient_value: role,
              is_active: true,
            })),
            ...scheduleConfig.recipients.emails.map(email => ({
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
        description: language === 'tr' ? 'Rapor başarıyla kaydedildi' : 'Report saved successfully',
      });

      navigate('/reports');
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to save report',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredAvailableColumns = availableColumns.filter(col => {
    const searchLower = columnSearch.toLowerCase();
    const label = language === 'tr' ? col.labelTr : col.labelEn;
    return label.toLowerCase().includes(searchLower) || col.key.toLowerCase().includes(searchLower);
  });

  const isEditing = !!editingId;
  const pageTitle = isEditing 
    ? (language === 'tr' ? 'Raporu Düzenle' : 'Edit Report')
    : (language === 'tr' ? 'Yeni Rapor Oluştur' : 'Create New Report');

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-3 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'tr' ? 'Raporlara Dön' : 'Back to Reports'}
          </Button>
          <div className="h-6 border-r border-border" />
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <Input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder={language === 'tr' ? 'Rapor Adı' : 'Report Name'}
              className="w-64 font-medium"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                {language === 'tr' ? 'Önizlemeyi Gizle' : 'Hide Preview'}
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                {language === 'tr' ? 'Önizlemeyi Göster' : 'Show Preview'}
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {t('save')}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Configuration Panel */}
        <div className={`flex-1 flex flex-col overflow-hidden ${showPreview ? 'min-h-0' : ''}`}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b px-4">
              <TabsList className="h-12 bg-transparent p-0 gap-1">
                <TabsTrigger 
                  value="datasource" 
                  className="data-[state=active]:bg-muted rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  <Database className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Veri Kaynağı' : 'Data Source'}
                </TabsTrigger>
                <TabsTrigger 
                  value="columns" 
                  className="data-[state=active]:bg-muted rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={!selectedDataSource}
                >
                  <Columns className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Sütunlar' : 'Columns'}
                </TabsTrigger>
                <TabsTrigger 
                  value="calculated" 
                  className="data-[state=active]:bg-muted rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={selectedColumns.length === 0}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Hesaplanan' : 'Calculated'}
                </TabsTrigger>
                <TabsTrigger 
                  value="filters" 
                  className="data-[state=active]:bg-muted rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={selectedColumns.length === 0}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Filtreler' : 'Filters'}
                </TabsTrigger>
                <TabsTrigger 
                  value="sorting" 
                  className="data-[state=active]:bg-muted rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={selectedColumns.length === 0}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Sıralama' : 'Sorting'}
                </TabsTrigger>
                <TabsTrigger 
                  value="styling" 
                  className="data-[state=active]:bg-muted rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={selectedColumns.length === 0}
                >
                  <Palette className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Stil' : 'Styling'}
                </TabsTrigger>
                <TabsTrigger 
                  value="output" 
                  className="data-[state=active]:bg-muted rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={selectedColumns.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Çıktı' : 'Output'}
                </TabsTrigger>
                <TabsTrigger 
                  value="schedule" 
                  className="data-[state=active]:bg-muted rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={selectedColumns.length === 0}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Zamanlama' : 'Schedule'}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                <TabsContent value="datasource" className="m-0">
                  <DataSourceTab
                    loading={loading}
                    dataSources={dataSources}
                    selectedDataSource={selectedDataSource}
                    availableJoins={availableJoins}
                    selectedJoins={selectedJoins}
                    reportName={reportName}
                    onReportNameChange={setReportName}
                    onDataSourceSelect={handleDataSourceSelect}
                    onJoinToggle={handleJoinToggle}
                  />
                </TabsContent>

                <TabsContent value="columns" className="m-0">
                  <ColumnsTab
                    availableColumns={availableColumns}
                    filteredAvailableColumns={filteredAvailableColumns}
                    selectedColumns={selectedColumns}
                    columnSearch={columnSearch}
                    loading={columnsLoading}
                    onColumnSearchChange={setColumnSearch}
                    onAddColumn={handleAddColumn}
                    onRemoveColumn={handleRemoveColumn}
                    onColumnSortToggle={handleColumnSortToggle}
                    onReorderColumns={handleReorderColumns}
                  />
                </TabsContent>

                <TabsContent value="calculated" className="m-0">
                  <CalculatedFieldsTab
                    calculatedFields={calculatedFields}
                    availableColumns={availableColumns}
                    onFieldsChange={setCalculatedFields}
                  />
                </TabsContent>

                <TabsContent value="filters" className="m-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{language === 'tr' ? 'Filtreler' : 'Filters'}</h4>
                        <p className="text-sm text-muted-foreground">
                          {language === 'tr' ? 'Rapor verilerini filtrelemek için koşullar ekleyin' : 'Add conditions to filter report data'}
                        </p>
                      </div>
                    </div>
                    <FilterBuilder
                      filters={filterGroups}
                      onChange={setFilterGroups}
                      availableColumns={availableColumns}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="sorting" className="m-0">
                  <SortingTab
                    sortConfigs={sortConfigs}
                    selectedColumns={selectedColumns}
                    availableColumns={availableColumns}
                    onSortConfigsChange={setSortConfigs}
                  />
                </TabsContent>

                <TabsContent value="styling" className="m-0">
                  <StyleBuilder
                    styling={reportStyling}
                    onChange={setReportStyling}
                    availableColumns={availableColumns}
                  />
                </TabsContent>

                <TabsContent value="output" className="m-0">
                  <OutputTab
                    outputFormats={outputFormats}
                    includeCharts={includeCharts}
                    onOutputFormatsChange={setOutputFormats}
                    onIncludeChartsChange={setIncludeCharts}
                  />
                </TabsContent>

                <TabsContent value="schedule" className="m-0">
                  <ScheduleTab
                    scheduleConfig={scheduleConfig}
                    onScheduleConfigChange={setScheduleConfig}
                  />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Preview Panel - Below Configuration */}
        {showPreview && (
          <div className="h-80 border-t bg-muted/30 overflow-hidden flex flex-col shrink-0">
            <div className="p-3 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {language === 'tr' ? 'Önizleme' : 'Preview'}
                </span>
              </div>
              {selectedColumns.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {language === 'tr' ? 'Önizleme için sütun seçin' : 'Select columns to preview'}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              {selectedColumns.length > 0 ? (
                <ReportPreview
                  reportName={reportName}
                  selectedColumns={selectedColumns}
                  calculatedFields={calculatedFields}
                  styling={reportStyling}
                  sortConfigs={sortConfigs}
                  filterGroups={filterGroups}
                  includeCharts={includeCharts}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {language === 'tr' ? 'Önizleme için sütun seçin' : 'Select columns to see preview'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportBuilderPage;
