import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { CalculatedField } from '@/components/reports/CalculatedFieldBuilder';
import { FilterGroup } from '@/components/reports/FilterBuilder';
import { ReportStyling } from '@/components/reports/StyleBuilder';
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

interface UseReportBuilderProps {
  open: boolean;
  editingConfig?: ReportConfig | null;
  onSave: (config: ReportConfig) => Promise<void>;
  onClose: () => void;
}

export const useReportBuilder = ({ open, editingConfig, onSave, onClose }: UseReportBuilderProps) => {
  const { language, t } = useLanguage();
  const { toast } = useToast();

  // Loading state
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
      setReportStyling(editingConfig.styling || DEFAULT_REPORT_STYLING);
      setScheduleConfig(editingConfig.schedule_config || DEFAULT_SCHEDULE_CONFIG);

      // Fetch columns for the selected data source
      if (editingConfig.data_source) {
        fetchDataSourceColumns(editingConfig.data_source, true);
      }
    } else if (open) {
      // Reset form for new report
      resetForm();
    }
  }, [editingConfig, open]);

  // Fetch columns when data source changes
  useEffect(() => {
    if (selectedDataSource && !editingConfig) {
      fetchDataSourceColumns(selectedDataSource, selectedJoins.length > 0);
    }
  }, [selectedDataSource, selectedJoins]);

  const resetForm = () => {
    setReportName('');
    setSelectedDataSource('');
    setSelectedJoins([]);
    setSelectedColumns([]);
    setCalculatedFields([]);
    setOutputFormats(['html']);
    setIncludeCharts(false);
    setFilterGroups([]);
    setSortConfigs([]);
    setReportStyling(DEFAULT_REPORT_STYLING);
    setScheduleConfig(DEFAULT_SCHEDULE_CONFIG);
  };

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

  const handleDataSourceSelect = useCallback((key: string) => {
    setSelectedDataSource(key);
    setSelectedColumns([]);
    setSelectedJoins([]);
    fetchDataSourceColumns(key, false);
  }, []);

  const handleJoinToggle = useCallback((joinTable: string) => {
    const newJoins = selectedJoins.includes(joinTable)
      ? selectedJoins.filter(j => j !== joinTable)
      : [...selectedJoins, joinTable];
    setSelectedJoins(newJoins);
    fetchDataSourceColumns(selectedDataSource, newJoins.length > 0);
  }, [selectedJoins, selectedDataSource]);

  const handleAddColumn = useCallback((column: ColumnDefinition) => {
    if (!selectedColumns.find(c => c.key === column.key)) {
      setSelectedColumns([...selectedColumns, { ...column }]);
    }
  }, [selectedColumns]);

  const handleRemoveColumn = useCallback((columnKey: string) => {
    setSelectedColumns(selectedColumns.filter(c => c.key !== columnKey));
  }, [selectedColumns]);

  const handleColumnSortToggle = useCallback((columnKey: string) => {
    setSelectedColumns(selectedColumns.map(col => {
      if (col.key === columnKey) {
        const nextSort = col.sortOrder === null ? 'asc' : col.sortOrder === 'asc' ? 'desc' : null;
        return { ...col, sortOrder: nextSort };
      }
      return col;
    }));
  }, [selectedColumns]);

  const handleReorderColumns = useCallback((newColumns: SelectedColumn[]) => {
    setSelectedColumns(newColumns);
  }, []);

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
        styling: reportStyling,
        output_formats: outputFormats,
        include_charts: includeCharts,
        schedule_config: scheduleConfig.enabled ? scheduleConfig : undefined,
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

  return {
    // State
    loading,
    saving,
    dataSources,
    selectedDataSource,
    availableColumns,
    filteredAvailableColumns,
    availableJoins,
    selectedJoins,
    selectedColumns,
    columnSearch,
    reportName,
    outputFormats,
    includeCharts,
    calculatedFields,
    filterGroups,
    sortConfigs,
    reportStyling,
    scheduleConfig,

    // Setters
    setColumnSearch,
    setReportName,
    setOutputFormats,
    setIncludeCharts,
    setCalculatedFields,
    setFilterGroups,
    setSortConfigs,
    setReportStyling,
    setScheduleConfig,
    setSelectedColumns,

    // Handlers
    handleDataSourceSelect,
    handleJoinToggle,
    handleAddColumn,
    handleRemoveColumn,
    handleColumnSortToggle,
    handleReorderColumns,
    handleSave,

    // Context
    language,
    t,
  };
};
