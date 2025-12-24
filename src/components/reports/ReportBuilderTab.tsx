import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Columns, Filter, ArrowUpDown, Palette, Save, Calculator, 
  Loader2, FileSpreadsheet, Clock, Play, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, X, Plus, GripVertical
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ColumnSelectorModal, ColumnDefinition as CSColumnDefinition, SelectedColumn as CSSelectedColumn } from './ColumnSelectorModal';
import { JoinPathDisplay, TableRelationship as JPTableRelationship } from './JoinPathDisplay';
import { TimePeriodComparison, ComparisonConfig } from './TimePeriodComparison';
import { FilterBuilder, FilterGroup } from './FilterBuilder';
import { StyleBuilder, ReportStyling } from './StyleBuilder';
import { ReportPreview } from './ReportPreview';
import { CalculatedFieldsTab, SortingTab, OutputTab, ScheduleTab } from './tabs';
import { CalculatedField } from './CalculatedFieldBuilder';
import { PageLayoutConfig, BrandingConfig, ChartConfig } from './tabs/OutputTab';
import {
  ColumnDefinition,
  SelectedColumn,
  SortConfig,
  ScheduleConfig,
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_REPORT_STYLING,
} from './reportBuilderTypes';
import { cn } from '@/lib/utils';

interface TableFromAPI {
  table: string;
  labelEn: string;
  labelTr: string;
  descriptionEn?: string;
  descriptionTr?: string;
  columns: ColumnDefinition[];
  columnCount: number;
}

interface SchemaResponse {
  tables: TableFromAPI[];
  relationships: JPTableRelationship[];
}

interface ValidationResult {
  isValid: boolean;
  joinPath: JPTableRelationship[];
  error?: string;
}

const ReportBuilderTab: React.FC = () => {
  const { language, t } = useLanguage();
  const { toast } = useToast();

  // UI State
  const [activeTab, setActiveTab] = useState('filters');
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [columnModalOpen, setColumnModalOpen] = useState(false);

  // Schema data
  const [allColumns, setAllColumns] = useState<ColumnDefinition[]>([]);
  const [relationships, setRelationships] = useState<JPTableRelationship[]>([]);
  const [tables, setTables] = useState<{ key: string; labelEn: string; labelTr: string; descriptionEn?: string; descriptionTr?: string }[]>([]);

  // Selected columns and validation
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, joinPath: [] });
  const [validating, setValidating] = useState(false);

  // Report configuration
  const [reportName, setReportName] = useState('');
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [calculatedFields, setCalculatedFields] = useState<CalculatedField[]>([]);
  const [reportStyling, setReportStyling] = useState<ReportStyling>(DEFAULT_REPORT_STYLING);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [outputFormats, setOutputFormats] = useState<string[]>(['html']);
  const [includeCharts, setIncludeCharts] = useState(false);
  const [pageLayout, setPageLayout] = useState<PageLayoutConfig>({
    orientation: 'portrait',
    pageSize: 'a4',
    margins: 'normal',
    showPageNumbers: true,
    showDate: true,
    showTotalRecords: true,
  });
  const [branding, setBranding] = useState<BrandingConfig>({
    showLogo: false,
    companyName: '',
    reportFooter: '',
    primaryColor: '#1e40af',
  });
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    chartType: 'bar',
    showLegend: true,
    showDataLabels: false,
  });

  // Time period comparison
  const [comparisonConfig, setComparisonConfig] = useState<ComparisonConfig>({
    enabled: false,
    type: 'month',
    dateColumn: '',
    displayOptions: {
      showAbsolute: true,
      showDifference: true,
      showPercentage: true,
    },
  });

  // Drag state for selected columns reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Fetch schema on mount
  useEffect(() => {
    fetchSchema();
  }, []);

  // Validate when columns change
  useEffect(() => {
    if (selectedColumns.length > 1) {
      validateColumns();
    } else if (selectedColumns.length <= 1) {
      setValidation({ isValid: true, joinPath: [] });
    }
  }, [selectedColumns]);

  const fetchSchema = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-report-schema', {
        body: { mode: 'getAllColumnsWithRelationships' },
      });

      if (error) throw error;

      const response = data as SchemaResponse;
      
      // Extract flat columns from nested table structure
      const flatColumns: ColumnDefinition[] = [];
      (response.tables || []).forEach((tableData: TableFromAPI) => {
        tableData.columns.forEach(col => {
          flatColumns.push({
            ...col,
            table: tableData.table,
          });
        });
      });
      
      // Transform tables to expected format with 'key' property
      const transformedTables = (response.tables || []).map((t: TableFromAPI) => ({
        key: t.table,
        labelEn: t.labelEn,
        labelTr: t.labelTr,
        descriptionEn: t.descriptionEn,
        descriptionTr: t.descriptionTr,
      }));

      setAllColumns(flatColumns);
      setRelationships(response.relationships || []);
      setTables(transformedTables);
    } catch (error) {
      console.error('Error fetching schema:', error);
      toast({
        title: String(t('error')),
        description: language === 'tr' ? 'Şema yüklenemedi' : 'Failed to load schema',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateColumns = async () => {
    if (selectedColumns.length < 2) {
      setValidation({ isValid: true, joinPath: [] });
      return;
    }

    setValidating(true);
    try {
      const selectedTables = [...new Set(selectedColumns.map(c => c.table))];
      
      const { data, error } = await supabase.functions.invoke('get-report-schema', {
        body: { 
          mode: 'validateColumnCompatibility',
          tables: selectedTables,
        },
      });

      if (error) throw error;

      setValidation({
        isValid: data.canJoin,
        joinPath: data.joinPath || [],
        error: data.error,
      });
    } catch (error) {
      console.error('Validation error:', error);
      setValidation({ isValid: false, joinPath: [], error: 'Validation failed' });
    } finally {
      setValidating(false);
    }
  };

  // Convert columns for ColumnSelectorModal
  const modalColumns = useMemo((): CSColumnDefinition[] => {
    return allColumns.map(col => ({
      key: col.key,
      labelEn: col.labelEn,
      labelTr: col.labelTr,
      type: col.type as 'text' | 'number' | 'date' | 'currency' | 'boolean',
      table: col.table,
    }));
  }, [allColumns]);

  const modalSelectedColumns = useMemo((): CSSelectedColumn[] => {
    return selectedColumns.map(col => ({
      key: col.key,
      labelEn: col.labelEn,
      labelTr: col.labelTr,
      type: col.type as 'text' | 'number' | 'date' | 'currency' | 'boolean',
      table: col.table,
      sortOrder: col.sortOrder,
    }));
  }, [selectedColumns]);

  const handleValidateColumn = useCallback(async (column: CSColumnDefinition): Promise<{ canJoin: boolean; error?: string }> => {
    if (selectedColumns.length === 0) {
      return { canJoin: true };
    }

    const selectedTables = [...new Set(selectedColumns.map(c => c.table))];
    if (selectedTables.includes(column.table)) {
      return { canJoin: true };
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-report-schema', {
        body: { 
          mode: 'validateColumnCompatibility',
          tables: [...selectedTables, column.table],
        },
      });

      if (error) throw error;
      return { canJoin: data.canJoin, error: data.error };
    } catch (error) {
      return { canJoin: false, error: 'Validation failed' };
    }
  }, [selectedColumns]);

  const handleColumnsChange = useCallback((newColumns: CSSelectedColumn[]) => {
    setSelectedColumns(newColumns as SelectedColumn[]);
  }, []);

  const handleColumnRemove = useCallback((columnKey: string, table: string) => {
    setSelectedColumns(prev => prev.filter(c => !(c.key === columnKey && c.table === table)));
  }, []);

  const handleColumnSortToggle = useCallback((columnKey: string, table: string) => {
    setSelectedColumns(prev => prev.map(col => {
      if (col.key !== columnKey || col.table !== table) return col;
      const currentSort = col.sortOrder;
      let newSort: 'asc' | 'desc' | undefined;
      if (!currentSort) newSort = 'asc';
      else if (currentSort === 'asc') newSort = 'desc';
      else newSort = undefined;
      return { ...col, sortOrder: newSort };
    }));
  }, []);

  // Drag handlers for selected columns reordering
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newColumns = [...selectedColumns];
      const [removed] = newColumns.splice(draggedIndex, 1);
      newColumns.splice(dragOverIndex > draggedIndex ? dragOverIndex - 1 : dragOverIndex, 0, removed);
      setSelectedColumns(newColumns);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, selectedColumns]);

  const handleSave = async () => {
    if (!reportName.trim()) {
      toast({
        title: String(t('validationError')),
        description: language === 'tr' ? 'Rapor adı gerekli' : 'Report name is required',
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

    if (!validation.isValid) {
      toast({
        title: String(t('validationError')),
        description: language === 'tr' ? 'Seçili sütunlar birleştirilemez' : 'Selected columns cannot be joined',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const selectedTables = [...new Set(selectedColumns.map(c => c.table))];
      const primaryTable = selectedTables[0] || 'unknown';

      const payload = {
        name: reportName,
        report_type: primaryTable,
        data_source: primaryTable,
        selected_joins: selectedTables.slice(1),
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
        comparison_period: comparisonConfig.enabled ? JSON.stringify(comparisonConfig) : null,
        is_system: false,
        created_by: user.user?.id || null,
      };

      const { error } = await supabase
        .from('email_report_configs')
        .insert(payload as any);

      if (error) throw error;

      toast({
        title: String(t('saved')),
        description: language === 'tr' ? 'Rapor başarıyla kaydedildi' : 'Report saved successfully',
      });

      // Reset form
      setReportName('');
      setSelectedColumns([]);
      setFilterGroups([]);
      setSortConfigs([]);
      setCalculatedFields([]);
      setComparisonConfig({ enabled: false, type: 'month', dateColumn: '', displayOptions: { showAbsolute: true, showDifference: true, showPercentage: true } });
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: String(t('error')),
        description: language === 'tr' ? 'Rapor kaydedilemedi' : 'Failed to save report',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (selectedColumns.length === 0) {
      toast({
        title: String(t('validationError')),
        description: language === 'tr' ? 'En az bir sütun seçin' : 'Please select at least one column',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: language === 'tr' ? 'Dışa aktarılıyor...' : 'Exporting...',
      description: language === 'tr' ? `${format.toUpperCase()} formatında hazırlanıyor` : `Preparing ${format.toUpperCase()} export`,
    });

    // TODO: Implement actual export logic
  };

  // Get selected tables for JoinPathDisplay
  const selectedTables = useMemo(() => [...new Set(selectedColumns.map(c => c.table))], [selectedColumns]);

  const getLabel = (item: { labelEn: string; labelTr: string }) => 
    language === 'tr' ? item.labelTr : item.labelEn;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Report Name */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">
              {language === 'tr' ? 'Rapor Oluşturucu' : 'Report Builder'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {language === 'tr' 
                ? 'Sütunları seçin, sistem otomatik olarak tabloları birleştirir'
                : 'Select columns, the system automatically joins tables'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            placeholder={language === 'tr' ? 'Rapor Adı' : 'Report Name'}
            className="w-64"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {language === 'tr' ? 'Önizleme' : 'Preview'}
          </Button>
        </div>
      </div>

      {/* Selected Columns Card with Save Button */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm font-medium">
                {language === 'tr' ? 'Seçili Sütunlar' : 'Selected Columns'}
              </CardTitle>
              {selectedColumns.length > 0 && (
                <>
                  <Badge variant="secondary">
                    {selectedColumns.length} {language === 'tr' ? 'sütun' : 'columns'}
                  </Badge>
                  <Badge variant="outline">
                    {selectedTables.length} {language === 'tr' ? 'tablo' : 'tables'}
                  </Badge>
                </>
              )}
              {/* Validation Status */}
              {selectedColumns.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {validating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : validation.isValid ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className={cn(
                    "text-xs",
                    validation.isValid ? "text-green-600" : "text-destructive"
                  )}>
                    {validating 
                      ? (language === 'tr' ? 'Doğrulanıyor...' : 'Validating...')
                      : validation.isValid 
                        ? (language === 'tr' ? 'Birleştirilebilir' : 'Can be joined')
                        : (language === 'tr' ? 'Birleştirilemez' : 'Cannot be joined')
                    }
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setColumnModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                {language === 'tr' ? 'Sütun Ekle' : 'Add Columns'}
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !validation.isValid || selectedColumns.length === 0}
                size="sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                {language === 'tr' ? 'Kaydet' : 'Save'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-3">
          {selectedColumns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Columns className="h-8 w-8 mb-2" />
              <p className="text-sm">
                {language === 'tr' ? 'Henüz sütun seçilmedi' : 'No columns selected yet'}
              </p>
              <Button 
                variant="link" 
                size="sm" 
                className="mt-2"
                onClick={() => setColumnModalOpen(true)}
              >
                {language === 'tr' ? 'Sütun eklemek için tıklayın' : 'Click to add columns'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Draggable column chips */}
              <div className="flex flex-wrap gap-2">
                {selectedColumns.map((col, index) => (
                  <div
                    key={`${col.table}.${col.key}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-sm bg-primary/5 border transition-all group cursor-grab active:cursor-grabbing",
                      dragOverIndex === index ? "border-primary shadow-sm" : "border-transparent",
                      draggedIndex === index && "opacity-50"
                    )}
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{col.table}.</span>
                    <span className="font-medium">{getLabel(col)}</span>
                    {col.sortOrder && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        {col.sortOrder === 'asc' ? '↑' : '↓'}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleColumnSortToggle(col.key, col.table)}
                      className={cn(
                        "h-5 w-5 p-0",
                        col.sortOrder ? "text-primary" : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                    <button
                      onClick={() => handleColumnRemove(col.key, col.table)}
                      className="ml-0.5 hover:bg-muted rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Join Path Display */}
              {validation.joinPath.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <JoinPathDisplay 
                    joinPath={validation.joinPath}
                    selectedTables={selectedTables}
                    canJoin={validation.isValid}
                    error={validation.error}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex md:grid-cols-none">
          <TabsTrigger value="filters" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">{language === 'tr' ? 'Filtreler' : 'Filters'}</span>
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{language === 'tr' ? 'Karşılaştırma' : 'Comparison'}</span>
          </TabsTrigger>
          <TabsTrigger value="calculated" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">{language === 'tr' ? 'Hesaplanan' : 'Calculated'}</span>
          </TabsTrigger>
          <TabsTrigger value="sorting" className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">{language === 'tr' ? 'Sıralama' : 'Sorting'}</span>
          </TabsTrigger>
          <TabsTrigger value="styling" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{language === 'tr' ? 'Stil' : 'Style'}</span>
          </TabsTrigger>
        </TabsList>

        {/* Filters Tab */}
        <TabsContent value="filters" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'tr' ? 'Filtreler' : 'Filters'}</CardTitle>
              <CardDescription>
                {language === 'tr' 
                  ? 'Rapor verilerini filtrelemek için koşullar ekleyin'
                  : 'Add conditions to filter report data'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FilterBuilder
                filters={filterGroups}
                onChange={setFilterGroups}
                availableColumns={selectedColumns.map(col => ({
                  key: col.key,
                  labelEn: col.labelEn,
                  labelTr: col.labelTr,
                  type: col.type as 'text' | 'number' | 'date' | 'currency' | 'boolean',
                  table: col.table,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Comparison Tab */}
        <TabsContent value="comparison" className="mt-6">
          <TimePeriodComparison
            config={comparisonConfig}
            onChange={setComparisonConfig}
            availableColumns={selectedColumns}
          />
        </TabsContent>

        {/* Calculated Fields Tab */}
        <TabsContent value="calculated" className="mt-6">
          <CalculatedFieldsTab
            calculatedFields={calculatedFields}
            availableColumns={selectedColumns}
            onFieldsChange={setCalculatedFields}
          />
        </TabsContent>

        {/* Sorting Tab */}
        <TabsContent value="sorting" className="mt-6">
          <SortingTab
            sortConfigs={sortConfigs}
            selectedColumns={selectedColumns}
            availableColumns={selectedColumns}
            onSortConfigsChange={setSortConfigs}
          />
        </TabsContent>

        {/* Styling Tab */}
        <TabsContent value="styling" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'tr' ? 'Rapor Stili' : 'Report Styling'}</CardTitle>
              <CardDescription>
                {language === 'tr' 
                  ? 'Raporunuzun görünümünü özelleştirin'
                  : 'Customize the appearance of your report'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StyleBuilder
                styling={reportStyling}
                onChange={setReportStyling}
                availableColumns={selectedColumns}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Panel */}
      {showPreview && selectedColumns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{language === 'tr' ? 'Önizleme' : 'Preview'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportPreview
              reportName={reportName || (language === 'tr' ? 'Adsız Rapor' : 'Untitled Report')}
              selectedColumns={selectedColumns}
              calculatedFields={calculatedFields}
              styling={reportStyling}
              sortConfigs={sortConfigs}
              filterGroups={filterGroups}
              includeCharts={includeCharts}
            />
          </CardContent>
        </Card>
      )}

      {/* Export Actions */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {language === 'tr' 
                ? 'Raporu doğrudan dışa aktarın veya daha sonra kullanmak için kaydedin'
                : 'Export the report directly or save it for later use'}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                PDF
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !validation.isValid}>
                <Play className="h-4 w-4 mr-2" />
                {language === 'tr' ? 'Çalıştır ve Kaydet' : 'Run & Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Column Selector Modal */}
      <ColumnSelectorModal
        open={columnModalOpen}
        onOpenChange={setColumnModalOpen}
        allColumns={modalColumns}
        selectedColumns={modalSelectedColumns}
        onColumnsChange={handleColumnsChange}
        onValidateColumn={handleValidateColumn}
        loading={loading}
      />
    </div>
  );
};

export default ReportBuilderTab;
