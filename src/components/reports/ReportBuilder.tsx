import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, Columns, ArrowUpDown, Palette, Save, FileSpreadsheet,
  Loader2, Calculator, Filter, Eye, Clock
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReportBuilder } from '@/hooks/useReportBuilder';
import { FilterBuilder } from './FilterBuilder';
import { StyleBuilder } from './StyleBuilder';
import { ReportPreview } from './ReportPreview';
import {
  DataSourceTab,
  ColumnsTab,
  CalculatedFieldsTab,
  SortingTab,
  OutputTab,
  ScheduleTab,
} from './tabs';
import { ReportConfig } from './reportBuilderTypes';

// Re-export types for backward compatibility
export type { ReportConfig, ColumnDefinition, SelectedColumn, SortConfig, ScheduleConfig } from './reportBuilderTypes';

interface ReportBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: ReportConfig) => Promise<void>;
  editingConfig?: ReportConfig | null;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  open,
  onClose,
  onSave,
  editingConfig,
}) => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('datasource');
  const [showPreview, setShowPreview] = useState(true);

  const {
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
    setColumnSearch,
    setReportName,
    setOutputFormats,
    setIncludeCharts,
    setCalculatedFields,
    setFilterGroups,
    setSortConfigs,
    setReportStyling,
    setScheduleConfig,
    handleDataSourceSelect,
    handleJoinToggle,
    handleAddColumn,
    handleRemoveColumn,
    handleColumnSortToggle,
    handleReorderColumns,
    handleSave,
  } = useReportBuilder({ open, editingConfig, onSave, onClose });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {editingConfig ? t('reportBuilder.editReport') : t('reportBuilder.createReport')}
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              {showPreview 
                ? (language === 'tr' ? 'Önizlemeyi Gizle' : 'Hide Preview')
                : (language === 'tr' ? 'Önizlemeyi Göster' : 'Show Preview')
              }
            </Button>
          </div>
          <DialogDescription>
            {t('reportBuilder.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Main Configuration Panel */}
          <div className={`flex-1 overflow-hidden ${showPreview ? 'w-3/5' : 'w-full'}`}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-8">
                <TabsTrigger value="datasource" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span className="hidden xl:inline">{t('reportBuilder.dataSource')}</span>
                </TabsTrigger>
                <TabsTrigger value="columns" className="flex items-center gap-2" disabled={!selectedDataSource}>
                  <Columns className="h-4 w-4" />
                  <span className="hidden xl:inline">{t('reportBuilder.columns')}</span>
                </TabsTrigger>
                <TabsTrigger value="calculated" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                  <Calculator className="h-4 w-4" />
                  <span className="hidden xl:inline">{t('reportBuilder.calculated')}</span>
                </TabsTrigger>
                <TabsTrigger value="filters" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                  <Filter className="h-4 w-4" />
                  <span className="hidden xl:inline">{t('reportBuilder.filters')}</span>
                </TabsTrigger>
                <TabsTrigger value="sorting" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden xl:inline">{t('reportBuilder.sorting')}</span>
                </TabsTrigger>
                <TabsTrigger value="styling" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                  <Palette className="h-4 w-4" />
                  <span className="hidden xl:inline">{t('reportBuilder.styling')}</span>
                </TabsTrigger>
                <TabsTrigger value="output" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden xl:inline">{t('reportBuilder.output')}</span>
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex items-center gap-2" disabled={selectedColumns.length === 0}>
                  <Clock className="h-4 w-4" />
                  <span className="hidden xl:inline">{language === 'tr' ? 'Zamanlama' : 'Schedule'}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="datasource" className="flex-1 overflow-hidden mt-4">
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

              <TabsContent value="columns" className="flex-1 overflow-hidden mt-4">
                <ColumnsTab
                  availableColumns={availableColumns}
                  filteredAvailableColumns={filteredAvailableColumns}
                  selectedColumns={selectedColumns}
                  columnSearch={columnSearch}
                  onColumnSearchChange={setColumnSearch}
                  onAddColumn={handleAddColumn}
                  onRemoveColumn={handleRemoveColumn}
                  onColumnSortToggle={handleColumnSortToggle}
                  onReorderColumns={handleReorderColumns}
                />
              </TabsContent>

              <TabsContent value="calculated" className="flex-1 overflow-hidden mt-4">
                <CalculatedFieldsTab
                  calculatedFields={calculatedFields}
                  availableColumns={availableColumns}
                  onFieldsChange={setCalculatedFields}
                />
              </TabsContent>

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

              <TabsContent value="sorting" className="flex-1 overflow-hidden mt-4">
                <SortingTab
                  sortConfigs={sortConfigs}
                  selectedColumns={selectedColumns}
                  availableColumns={availableColumns}
                  onSortConfigsChange={setSortConfigs}
                />
              </TabsContent>

              <TabsContent value="styling" className="flex-1 overflow-hidden mt-4">
                <StyleBuilder
                  styling={reportStyling}
                  onChange={setReportStyling}
                  availableColumns={availableColumns}
                />
              </TabsContent>

              <TabsContent value="output" className="flex-1 overflow-hidden mt-4">
                <OutputTab
                  outputFormats={outputFormats}
                  includeCharts={includeCharts}
                  onOutputFormatsChange={setOutputFormats}
                  onIncludeChartsChange={setIncludeCharts}
                />
              </TabsContent>

              <TabsContent value="schedule" className="flex-1 overflow-hidden mt-4">
                <ScheduleTab
                  scheduleConfig={scheduleConfig}
                  onScheduleConfigChange={setScheduleConfig}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Live Preview Panel */}
          {showPreview && selectedColumns.length > 0 && (
            <div className="w-2/5 border rounded-lg overflow-hidden bg-background">
              <ReportPreview
                reportName={reportName}
                selectedColumns={selectedColumns}
                calculatedFields={calculatedFields}
                styling={reportStyling}
                sortConfigs={sortConfigs}
                filterGroups={filterGroups}
                includeCharts={includeCharts}
              />
            </div>
          )}
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
    </Dialog>
  );
};

export default ReportBuilder;
