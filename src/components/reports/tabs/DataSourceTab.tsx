import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DataSource,
  JoinDefinition,
  getDataSourceLabel,
  getDataSourceDescription,
} from '../reportBuilderTypes';

interface DataSourceTabProps {
  loading: boolean;
  dataSources: DataSource[];
  selectedDataSource: string;
  availableJoins: JoinDefinition[];
  selectedJoins: string[];
  reportName: string;
  onReportNameChange: (name: string) => void;
  onDataSourceSelect: (key: string) => void;
  onJoinToggle: (joinTable: string) => void;
}

export const DataSourceTab: React.FC<DataSourceTabProps> = ({
  loading,
  dataSources,
  selectedDataSource,
  availableJoins,
  selectedJoins,
  reportName,
  onReportNameChange,
  onDataSourceSelect,
  onJoinToggle,
}) => {
  const { language, t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('reportBuilder.reportName')}</Label>
        <Input
          value={reportName}
          onChange={(e) => onReportNameChange(e.target.value)}
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
                onClick={() => onDataSourceSelect(ds.key)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{getDataSourceLabel(ds, language)}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getDataSourceDescription(ds, language)}
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
                    onCheckedChange={() => onJoinToggle(join.table)}
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
  );
};
