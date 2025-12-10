import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Columns3, Check, X, RotateCcw } from 'lucide-react';
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
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Columns3 className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>{t('catalog.selectColumns')}</CardTitle>
              <CardDescription>
                {t('catalog.selectColumnsDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Quick actions */}
          <div className="flex items-center gap-2">
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
          </div>

          {/* Column grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {allColumns.map(column => (
              <label
                key={column.key}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${selected.includes(column.key) 
                    ? 'bg-primary/5 border-primary/30' 
                    : 'hover:bg-muted/50'}
                `}
              >
                <Checkbox
                  checked={selected.includes(column.key)}
                  onCheckedChange={() => handleToggle(column.key)}
                />
                <span className="text-sm">{column.label}</span>
                {column.default && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {t('catalog.default')}
                  </Badge>
                )}
              </label>
            ))}
          </div>

          {/* Selection count */}
          <p className="text-sm text-muted-foreground text-center">
            {selected.length} {t('catalog.columnsSelected')}
          </p>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={selected.length === 0}>
            {t('catalog.loadCatalog')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CatalogColumnSelector;
