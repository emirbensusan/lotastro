import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  GripVertical, Plus, X, Database, Columns, ArrowUpDown, 
  Palette, Save, FileSpreadsheet, Mail,
  Search, Loader2, Calculator, Edit, Trash2, Filter, ChevronUp, ChevronDown
} from 'lucide-react';
import { CalculatedFieldBuilder, CalculatedField } from './CalculatedFieldBuilder';
import { FilterBuilder, FilterGroup } from './FilterBuilder';

interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
}

interface SelectedColumn extends ColumnDefinition {
  displayLabel?: string;
  width?: number;
  sortOrder?: 'asc' | 'desc' | null;
  sortPriority?: number;
}

interface DataSource {
  key: string;
  labelEn: string;
  labelTr: string;
  descriptionEn: string;
  descriptionTr: string;
  columnCount: number;
  hasJoins: boolean;
}

interface JoinDefinition {
  table: string;
  labelEn: string;
  labelTr: string;
  joinColumn: string;
  foreignColumn: string;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
  priority: number;
}

interface ReportConfig {
  id?: string;
  name: string;
  data_source: string;
  selected_joins: string[];
  columns_config: SelectedColumn[];
  calculated_fields?: CalculatedField[];
  sorting: SortConfig[];
  filters: FilterGroup[];
  output_formats: string[];
  include_charts: boolean;
  schedule_id?: string | null;
}

interface ReportBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: ReportConfig) => Promise<void>;
  editingConfig?: ReportConfig | null;
}

const OUTPUT_FORMATS = [
  { key: 'html', labelEn: 'HTML Email', labelTr: 'HTML E-posta', icon: Mail },
  { key: 'excel', labelEn: 'Excel File', labelTr: 'Excel Dosyası', icon: FileSpreadsheet },
  { key: 'csv', labelEn: 'CSV File', labelTr: 'CSV Dosyası', icon: FileSpreadsheet },
];

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  open,
  onClose,
  onSave,
  editingConfig,
}) => {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  
  // State
  const [activeTab, setActiveTab] = useState('datasource');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Data source state
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [availableColumns, setAvailableColumns] = useState<ColumnDefinition[]>([]);
  const [availableJoins, setAvailableJoins] = useState<JoinDefinition[]>([]);
  const [selectedJoins, setSelectedJoins] = useState<string[]>([]);
  
  // Column configuration state
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
  const [columnSearch, setColumnSearch] = useState('');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Report configuration state
  const [reportName, setReportName] = useState('');
  const [outputFormats, setOutputFormats] = useState<string[]>(['html']);
  const [includeCharts, setIncludeCharts] = useState(false);
  
  // Calculated fields state
  const [calculatedFields, setCalculatedFields] = useState<CalculatedField[]>([]);
  const [calcFieldBuilderOpen, setCalcFieldBuilderOpen] = useState(false);
  const [editingCalcField, setEditingCalcField] = useState<CalculatedField | null>(null);
  
  // Filter state
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  
  // Sort configuration state
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);

  // Fetch data sources on mount
  useEffect(() => {
    if (open) {
      fetchDataSources();
    }
  }, [open]);

  // Load editing config
  useEffect(() => {
    if (editingConfig && open) {
      setReportName(editingConfig.name);
      setSelectedDataSource(editingConfig.data_source);
      setSelectedJoins(editingConfig.selected_joins || []);
      setSelectedColumns(editingConfig.columns_config || []);
      setCalculatedFields(editingConfig.calculated_fields || []);
      setOutputFormats(editingConfig.output_formats || ['html']);
      setIncludeCharts(editingConfig.include_charts || false);
      setFilterGroups(editingConfig.filters || []);
      setSortConfigs(editingConfig.sorting || []);
      
      // Fetch columns for the selected data source
      if (editingConfig.data_source) {
        fetchDataSourceColumns(editingConfig.data_source, true);
      }
    } else if (open) {
      // Reset form for new report
      setReportName('');
      setSelectedDataSource('');
      setSelectedJoins([]);
      setSelectedColumns([]);
      setCalculatedFields([]);
      setOutputFormats(['html']);
      setIncludeCharts(false);
      setFilterGroups([]);
      setSortConfigs([]);
      setActiveTab('datasource');
    }
  }, [editingConfig, open]);

  // Fetch columns when data source changes
  useEffect(() => {
    if (selectedDataSource && !editingConfig) {
      fetchDataSourceColumns(selectedDataSource, selectedJoins.length > 0);
    }
  }, [selectedDataSource, selectedJoins]);

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
    try {
      const { data, error } = await supabase.functions.invoke('get-report-schema', {
        body: {},
        headers: {},
      });
      
      // Fetch with query params
      const response = await supabase.functions.invoke('get-report-schema', {
        body: { dataSource: dataSourceKey, includeJoins },
      });
      
      if (response.error) throw response.error;
      
      setAvailableColumns(response.data.columns || []);
      setAvailableJoins(response.data.availableJoins || []);
    } catch (error) {
      console.error('Error fetching columns:', error);
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

  // Column drag & drop handlers
  const handleDragStart = (e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverIndex(null);
  };

  const handleDropOnSelected = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (!draggedColumn) return;
    
    // Check if dragging from available columns
    const fromAvailable = availableColumns.find(c => c.key === draggedColumn);
    
    if (fromAvailable && !selectedColumns.find(c => c.key === draggedColumn)) {
      // Add new column at target position
      const newColumn: SelectedColumn = { ...fromAvailable };
      const newSelected = [...selectedColumns];
      newSelected.splice(targetIndex, 0, newColumn);
      setSelectedColumns(newSelected);
    } else {
      // Reorder existing columns
      const currentIndex = selectedColumns.findIndex(c => c.key === draggedColumn);
      if (currentIndex !== -1 && currentIndex !== targetIndex) {
        const newSelected = [...selectedColumns];
        const [removed] = newSelected.splice(currentIndex, 1);
        newSelected.splice(targetIndex > currentIndex ? targetIndex - 1 : targetIndex, 0, removed);
        setSelectedColumns(newSelected);
      }
    }
    
    handleDragEnd();
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

  const handleSave = async () => {
    if (!reportName.trim()) {
      toast({
        title: String(t('validationError')),
        description: 'Report name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedDataSource) {
      toast({
        title: String(t('validationError')),
        description: 'Please select a data source',
        variant: 'destructive',
      });
      return;
    }

    if (selectedColumns.length === 0) {
      toast({
        title: String(t('validationError')),
        description: 'Please select at least one column',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const config: ReportConfig = {
        id: editingConfig?.id,
        name: reportName,
        data_source: selectedDataSource,
        selected_joins: selectedJoins,
        columns_config: selectedColumns,
        calculated_fields: calculatedFields,
        sorting: sortConfigs.length > 0 
          ? sortConfigs 
          : selectedColumns
              .filter(c => c.sortOrder)
              .map((c, index) => ({ column: c.key, direction: c.sortOrder!, priority: index })),
        filters: filterGroups,
        output_formats: outputFormats,
        include_charts: includeCharts,
      };
      
      await onSave(config);
      onClose();
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

  const getColumnLabel = (col: ColumnDefinition) => {
    return language === 'tr' ? col.labelTr : col.labelEn;
  };

  const getDataSourceLabel = (ds: DataSource) => {
    return language === 'tr' ? ds.labelTr : ds.labelEn;
  };

  const getDataSourceDescription = (ds: DataSource) => {
    return language === 'tr' ? ds.descriptionTr : ds.descriptionEn;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {editingConfig ? t('reportBuilder.editReport') : t('reportBuilder.createReport')}
          </DialogTitle>
          <DialogDescription>
            {t('reportBuilder.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="datasource" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reportBuilder.dataSource')}</span>
              </TabsTrigger>
              <TabsTrigger value="columns" className="flex items-center gap-2" disabled={!selectedDataSource}>
                <Columns className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reportBuilder.columns')}</span>
              </TabsTrigger>
              <TabsTrigger value="calculated" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                <Calculator className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reportBuilder.calculated')}</span>
              </TabsTrigger>
              <TabsTrigger value="filters" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reportBuilder.filters')}</span>
              </TabsTrigger>
              <TabsTrigger value="sorting" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reportBuilder.sorting')}</span>
              </TabsTrigger>
              <TabsTrigger value="output" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reportBuilder.output')}</span>
              </TabsTrigger>
            </TabsList>

            {/* Data Source Tab */}
            <TabsContent value="datasource" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('reportBuilder.reportName')}</Label>
                  <Input
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder={String(t('reportBuilder.reportNamePlaceholder'))}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t('reportBuilder.selectDataSource')}</Label>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                      {dataSources.map((ds) => (
                        <div
                          key={ds.key}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedDataSource === ds.key
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => handleDataSourceSelect(ds.key)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{getDataSourceLabel(ds)}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {getDataSourceDescription(ds)}
                              </p>
                            </div>
                            <Badge variant="outline" className="ml-2">
                              {ds.columnCount} {t('reportBuilder.columns')}
                            </Badge>
                          </div>
                          {ds.hasJoins && (
                            <Badge variant="secondary" className="mt-2">
                              {t('reportBuilder.hasRelatedData')}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedDataSource && availableJoins.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>{t('reportBuilder.includeRelatedData')}</Label>
                      <div className="flex flex-wrap gap-2">
                        {availableJoins.map((join) => (
                          <div
                            key={join.table}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              id={`join-${join.table}`}
                              checked={selectedJoins.includes(join.table)}
                              onCheckedChange={() => handleJoinToggle(join.table)}
                            />
                            <Label htmlFor={`join-${join.table}`} className="cursor-pointer">
                              {language === 'tr' ? join.labelTr : join.labelEn}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Columns Tab */}
            <TabsContent value="columns" className="flex-1 overflow-hidden mt-4">
              <div className="grid grid-cols-2 gap-4 h-[400px]">
                {/* Available Columns */}
                <div className="border rounded-lg flex flex-col">
                  <div className="p-3 border-b bg-muted/50">
                    <h4 className="font-medium text-sm">{t('reportBuilder.availableColumns')}</h4>
                    <div className="relative mt-2">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={columnSearch}
                        onChange={(e) => setColumnSearch(e.target.value)}
                        placeholder={String(t('reportBuilder.searchColumns'))}
                        className="pl-8 h-9"
                      />
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {filteredAvailableColumns.map((col) => {
                        const isSelected = selectedColumns.some(c => c.key === col.key);
                        return (
                          <div
                            key={col.key}
                            draggable={!isSelected}
                            onDragStart={(e) => handleDragStart(e, col.key)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center justify-between p-2 rounded-md text-sm ${
                              isSelected
                                ? 'bg-muted text-muted-foreground'
                                : 'hover:bg-muted/50 cursor-grab active:cursor-grabbing'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {!isSelected && <GripVertical className="h-4 w-4 text-muted-foreground" />}
                              <span>{getColumnLabel(col)}</span>
                              <Badge variant="outline" className="text-xs">
                                {col.type}
                              </Badge>
                            </div>
                            {!isSelected && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAddColumn(col)}
                                className="h-7 w-7 p-0"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Selected Columns */}
                <div className="border rounded-lg flex flex-col">
                  <div className="p-3 border-b bg-muted/50">
                    <h4 className="font-medium text-sm">
                      {t('reportBuilder.selectedColumns')} ({selectedColumns.length})
                    </h4>
                  </div>
                  <ScrollArea className="flex-1">
                    <div
                      className="p-2 space-y-1 min-h-full"
                      onDragOver={(e) => e.preventDefault()}
                    >
                      {selectedColumns.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <Columns className="h-8 w-8 mb-2" />
                          <p className="text-sm">{t('reportBuilder.dragColumnsHere')}</p>
                        </div>
                      ) : (
                        selectedColumns.map((col, index) => (
                          <div
                            key={col.key}
                            draggable
                            onDragStart={(e) => handleDragStart(e, col.key)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDropOnSelected(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center justify-between p-2 rounded-md text-sm bg-primary/5 border ${
                              dragOverIndex === index ? 'border-primary' : 'border-transparent'
                            } cursor-grab active:cursor-grabbing`}
                          >
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{index + 1}.</span>
                              <span>{getColumnLabel(col)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleColumnSortToggle(col.key)}
                                className={`h-7 w-7 p-0 ${col.sortOrder ? 'text-primary' : ''}`}
                              >
                                <ArrowUpDown className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveColumn(col.key)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                      {/* Drop zone at end */}
                      {selectedColumns.length > 0 && (
                        <div
                          className={`p-2 border-2 border-dashed rounded-md text-center text-sm text-muted-foreground ${
                            draggedColumn && !selectedColumns.find(c => c.key === draggedColumn)
                              ? 'border-primary bg-primary/5'
                              : 'border-muted'
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverIndex(selectedColumns.length);
                          }}
                          onDrop={(e) => handleDropOnSelected(e, selectedColumns.length)}
                        >
                          {t('reportBuilder.dropHere')}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* Calculated Fields Tab */}
            <TabsContent value="calculated" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{t('reportBuilder.calculatedFields')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('reportBuilder.calculatedFieldsDescription')}
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      setEditingCalcField(null);
                      setCalcFieldBuilderOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('reportBuilder.addCalculatedField')}
                  </Button>
                </div>

                {calculatedFields.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <Calculator className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t('reportBuilder.noCalculatedFields')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('reportBuilder.noCalculatedFieldsHint')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {calculatedFields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <Calculator className="h-4 w-4 text-primary" />
                          <div>
                            <span className="font-medium">
                              {language === 'tr' ? field.labelTr : field.labelEn}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {field.type.replace('_', ' ')}
                              </Badge>
                              {field.config.sourceColumn && (
                                <span className="text-xs text-muted-foreground">
                                  {field.config.sourceColumn}
                                  {field.config.compareColumn && ` vs ${field.config.compareColumn}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCalcField(field);
                              setCalcFieldBuilderOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCalculatedFields(calculatedFields.filter(f => f.id !== field.id));
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Filters Tab */}
            <TabsContent value="filters" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{t('reportBuilder.filtersTitle')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('reportBuilder.filtersDescription')}
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

            {/* Sorting Tab */}
            <TabsContent value="sorting" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{t('reportBuilder.sortingTitle')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('reportBuilder.sortingDescription')}
                    </p>
                  </div>
                </div>
                
                {/* Active Sort Rules */}
                {sortConfigs.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <Label className="text-sm font-medium">{t('reportBuilder.activeSortRules')}</Label>
                    {sortConfigs.map((sortConfig, index) => {
                      const col = selectedColumns.find(c => c.key === sortConfig.column) || availableColumns.find(c => c.key === sortConfig.column);
                      return (
                        <div
                          key={sortConfig.column}
                          className="flex items-center justify-between p-3 border rounded-lg bg-primary/5"
                        >
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            <Badge variant="outline">{index + 1}</Badge>
                            <span className="font-medium">{col ? getColumnLabel(col) : sortConfig.column}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSortConfigs(sortConfigs.map(sc => 
                                  sc.column === sortConfig.column
                                    ? { ...sc, direction: sc.direction === 'asc' ? 'desc' : 'asc' }
                                    : sc
                                ));
                              }}
                              className="h-8 gap-1"
                            >
                              {sortConfig.direction === 'asc' ? (
                                <><ChevronUp className="h-4 w-4" /> {t('reportBuilder.ascending')}</>
                              ) : (
                                <><ChevronDown className="h-4 w-4" /> {t('reportBuilder.descending')}</>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSortConfigs(sortConfigs.filter(sc => sc.column !== sortConfig.column));
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Available Columns for Sorting */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('reportBuilder.addSortColumn')}</Label>
                  <ScrollArea className="h-[250px] border rounded-lg">
                    <div className="p-2 space-y-1">
                      {selectedColumns
                        .filter(col => !sortConfigs.find(sc => sc.column === col.key))
                        .map((col) => (
                          <div
                            key={col.key}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <span>{getColumnLabel(col)}</span>
                              <Badge variant="outline" className="text-xs">{col.type}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSortConfigs([
                                    ...sortConfigs,
                                    { column: col.key, direction: 'asc', priority: sortConfigs.length }
                                  ]);
                                }}
                                className="h-7 gap-1"
                              >
                                <ChevronUp className="h-3 w-3" />
                                {t('reportBuilder.asc')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSortConfigs([
                                    ...sortConfigs,
                                    { column: col.key, direction: 'desc', priority: sortConfigs.length }
                                  ]);
                                }}
                                className="h-7 gap-1"
                              >
                                <ChevronDown className="h-3 w-3" />
                                {t('reportBuilder.desc')}
                              </Button>
                            </div>
                          </div>
                        ))}
                      {selectedColumns.filter(col => !sortConfigs.find(sc => sc.column === col.key)).length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-4">
                          {t('reportBuilder.allColumnsSorted')}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* Output Tab */}
            <TabsContent value="output" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label>{t('reportBuilder.outputFormats')}</Label>
                  <div className="flex flex-wrap gap-3">
                    {OUTPUT_FORMATS.map((format) => {
                      const Icon = format.icon;
                      const isSelected = outputFormats.includes(format.key);
                      return (
                        <div
                          key={format.key}
                          className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => {
                            setOutputFormats(isSelected
                              ? outputFormats.filter(f => f !== format.key)
                              : [...outputFormats, format.key]
                            );
                          }}
                        >
                          <Checkbox checked={isSelected} />
                          <Icon className="h-4 w-4" />
                          <span>{language === 'tr' ? format.labelTr : format.labelEn}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('reportBuilder.includeCharts')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('reportBuilder.includeChartsDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={includeCharts}
                    onCheckedChange={setIncludeCharts}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Calculated Field Builder Dialog */}
      <CalculatedFieldBuilder
        open={calcFieldBuilderOpen}
        onClose={() => {
          setCalcFieldBuilderOpen(false);
          setEditingCalcField(null);
        }}
        onSave={(field) => {
          if (editingCalcField) {
            setCalculatedFields(calculatedFields.map(f => f.id === field.id ? field : f));
          } else {
            setCalculatedFields([...calculatedFields, field]);
          }
        }}
        availableColumns={availableColumns}
        editingField={editingCalcField}
      />
    </Dialog>
  );
};

export default ReportBuilder;
