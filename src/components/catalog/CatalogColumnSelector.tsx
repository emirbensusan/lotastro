import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Columns3, Check, X, RotateCcw, Save } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Column {
  key: string;
  label: string;
  default: boolean;
}

interface CatalogColumnSelectorProps {
  allColumns: Column[];
  selectedColumns: string[];
  onConfirm: (columns: string[]) => void;
  onCancel: () => void;
}

const CatalogColumnSelector: React.FC<CatalogColumnSelectorProps> = ({
  allColumns,
  selectedColumns: initialSelected,
  onConfirm,
  onCancel,
}) => {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const handleToggle = (key: string) => {
    setSelected(prev => 
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelected(allColumns.map(c => c.key));
  };

  const handleClearAll = () => {
    // Keep at least some essential columns
    setSelected(['lastro_sku_code', 'code', 'color_name', 'status']);
  };

  const handleResetDefaults = () => {
    setSelected(allColumns.filter(c => c.default).map(c => c.key));
  };

  return (
    <div className="min-h-[80vh] p-6">
      {/* Header with title and action buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Columns3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">{t('catalog.selectColumns')}</h1>
            <p className="text-muted-foreground text-sm">
              {t('catalog.selectColumnsDescription')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            <Check className="h-4 w-4 mr-2" />
            {t('catalog.selectAll')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearAll}>
            <X className="h-4 w-4 mr-2" />
            {t('catalog.clearAll')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('catalog.resetDefaults')}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={selected.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {t('catalog.loadCatalog')}
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Column Selection */}
        <Card>
          <CardHeader>
            <CardTitle>{t('catalog.availableColumns')}</CardTitle>
            <CardDescription>
              {selected.length} {t('catalog.columnsSelected')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(80vh-280px)]">
              <div className="space-y-2 pr-4">
                {allColumns.map(column => (
                  <label
                    key={column.key}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                      ${selected.includes(column.key) 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'hover:bg-muted/50 border-border'}
                    `}
                  >
                    <Checkbox
                      checked={selected.includes(column.key)}
                      onCheckedChange={() => handleToggle(column.key)}
                    />
                    <span className="text-sm flex-1">{column.label}</span>
                    {column.default && (
                      <Badge variant="secondary" className="text-xs">
                        {t('catalog.default')}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Saved Views */}
        <Card>
          <CardHeader>
            <CardTitle>{t('catalog.savedViews')}</CardTitle>
            <CardDescription>{t('catalog.savedViewsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[calc(80vh-280px)] text-muted-foreground">
              <p className="text-center">
                {t('catalog.noSavedViews')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CatalogColumnSelector;
