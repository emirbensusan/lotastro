import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Columns, Filter, ArrowUpDown, Palette, Save, Calculator, 
  Loader2, FileSpreadsheet, Clock, Play, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ColumnBrowser, TableDefinition, TableRelationship as CBTableRelationship, ColumnDefinition as CBColumnDefinition } from './ColumnBrowser';
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

interface SchemaResponse {
  columns: ColumnDefinition[];
  relationships: JPTableRelationship[];
  tables: { key: string; labelEn: string; labelTr: string; descriptionEn?: string; descriptionTr?: string }[];
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
  const [activeTab, setActiveTab] = useState('columns');
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Schema data
  const [allColumns, setAllColumns] = useState<ColumnDefinition[]>([]);
  const [relationships, setRelationships] = useState<JPTableRelationship[]>([]);
  const [tables, setTables] = useState<{ key: string; labelEn: string; labelTr: string; descriptionEn?: string; descriptionTr?: string }[]>([]);

  // Selected columns and validation
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, joinPath: [] });
  const [validating, setValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
      setAllColumns(response.columns || []);
      setRelationships(response.relationships || []);
      setTables(response.tables || []);
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

  // Convert columns to table definitions for ColumnBrowser
  const tableDefinitions = useMemo((): TableDefinition[] => {
    const tableMap = new Map<string, TableDefinition>();
    
    allColumns.forEach(col => {
      if (!tableMap.has(col.table)) {
        const tableInfo = tables.find(t => t.key === col.table);
        tableMap.set(col.table, {
          table: col.table,
          labelEn: tableInfo?.labelEn || col.table,
          labelTr: tableInfo?.labelTr || col.table,
          descriptionEn: tableInfo?.descriptionEn || '',
          descriptionTr: tableInfo?.descriptionTr || '',
          columns: [],
          columnCount: 0,
        });
      }
      const tableDef = tableMap.get(col.table)!;
      tableDef.columns.push({
        key: col.key,
        labelEn: col.labelEn,
        labelTr: col.labelTr,
        type: col.type as 'text' | 'number' | 'date' | 'currency' | 'boolean',
        table: col.table,
      });
      tableDef.columnCount = tableDef.columns.length;
    });
    
    return Array.from(tableMap.values());
  }, [allColumns, tables]);

  // Convert relationships for ColumnBrowser
  const cbRelationships = useMemo((): CBTableRelationship[] => {
    return relationships.map(r => ({
      ...r,
      type: r.type as 'one-to-many' | 'many-to-one' | 'one-to-one',
    }));
  }, [relationships]);

  // Convert selected columns for ColumnBrowser
  const cbSelectedColumns = useMemo((): CBColumnDefinition[] => {
    return selectedColumns.map(c => ({
      key: c.key,
      labelEn: c.labelEn,
      labelTr: c.labelTr,
      type: c.type as 'text' | 'number' | 'date' | 'currency' | 'boolean',
      table: c.table,
    }));
  }, [selectedColumns]);

  const handleColumnToggle = useCallback((column: CBColumnDefinition) => {
    const exists = selectedColumns.find(c => c.key === column.key);
    if (exists) {
      setSelectedColumns(prev => prev.filter(c => c.key !== column.key));
    } else {
      setSelectedColumns(prev => [...prev, { 
        ...column,
        type: column.type,
      } as SelectedColumn]);
    }
  }, [selectedColumns]);

  const handleValidateColumn = useCallback(async (column: CBColumnDefinition): Promise<{ canJoin: boolean; error?: string }> => {
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

  const handleColumnRemove = useCallback((columnKey: string) => {
    setSelectedColumns(prev => prev.filter(c => c.key !== columnKey));
  }, []);

  const handleReorderColumns = useCallback((newColumns: SelectedColumn[]) => {
    setSelectedColumns(newColumns);
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <Button onClick={handleSave} disabled={saving || !validation.isValid}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {language === 'tr' ? 'Kaydet' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Validation Status */}
      {selectedColumns.length > 0 && (
        <Card className={validation.isValid ? 'border-green-500/50 bg-green-500/5' : 'border-destructive/50 bg-destructive/5'}>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {validating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : validation.isValid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className={`text-sm font-medium ${validation.isValid ? 'text-green-700' : 'text-destructive'}`}>
                  {validating 
                    ? (language === 'tr' ? 'Doğrulanıyor...' : 'Validating...')
                    : validation.isValid 
                      ? (language === 'tr' ? 'Sütunlar birleştirilebilir' : 'Columns can be joined')
                      : (validation.error || (language === 'tr' ? 'Sütunlar birleştirilemez' : 'Columns cannot be joined'))
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {selectedColumns.length} {language === 'tr' ? 'sütun' : 'columns'}
                </Badge>
                <Badge variant="outline">
                  {selectedTables.length} {language === 'tr' ? 'tablo' : 'tables'}
                </Badge>
              </div>
            </div>
            
            {/* Join Path Display */}
            {validation.joinPath.length > 0 && (
              <div className="mt-3">
                <JoinPathDisplay 
                  joinPath={validation.joinPath}
                  selectedTables={selectedTables}
                  canJoin={validation.isValid}
                  error={validation.error}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected Columns Preview */}
      {selectedColumns.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              {language === 'tr' ? 'Seçili Sütunlar' : 'Selected Columns'}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex flex-wrap gap-2">
              {selectedColumns.map((col) => (
                <Badge key={col.key} variant="secondary" className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{col.table}.</span>
                  {language === 'tr' ? col.labelTr : col.labelEn}
                  <button
                    onClick={() => handleColumnRemove(col.key)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex md:grid-cols-none">
          <TabsTrigger value="columns" className="flex items-center gap-2">
            <Columns className="h-4 w-4" />
            <span className="hidden sm:inline">{language === 'tr' ? 'Sütunlar' : 'Columns'}</span>
          </TabsTrigger>
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

        {/* Columns Tab - Column Browser */}
        <TabsContent value="columns" className="mt-6">
          <ColumnBrowser
            tables={tableDefinitions}
            relationships={cbRelationships}
            selectedColumns={cbSelectedColumns}
            onColumnToggle={handleColumnToggle}
            onValidateColumn={handleValidateColumn}
            validationErrors={validationErrors}
            loading={validating}
          />
        </TabsContent>

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
    </div>
  );
};

export default ReportBuilderTab;
