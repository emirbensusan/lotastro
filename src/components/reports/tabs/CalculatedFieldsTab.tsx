import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calculator, Edit, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { CalculatedFieldBuilder, CalculatedField } from '../CalculatedFieldBuilder';
import { ColumnDefinition } from '../reportBuilderTypes';

interface CalculatedFieldsTabProps {
  calculatedFields: CalculatedField[];
  availableColumns: ColumnDefinition[];
  onFieldsChange: (fields: CalculatedField[]) => void;
}

export const CalculatedFieldsTab: React.FC<CalculatedFieldsTabProps> = ({
  calculatedFields,
  availableColumns,
  onFieldsChange,
}) => {
  const { language, t } = useLanguage();
  const [calcFieldBuilderOpen, setCalcFieldBuilderOpen] = useState(false);
  const [editingCalcField, setEditingCalcField] = useState<CalculatedField | null>(null);

  const handleSaveField = (field: CalculatedField) => {
    if (editingCalcField) {
      onFieldsChange(calculatedFields.map(f => f.id === field.id ? field : f));
    } else {
      onFieldsChange([...calculatedFields, field]);
    }
  };

  const handleDeleteField = (fieldId: string) => {
    onFieldsChange(calculatedFields.filter(f => f.id !== fieldId));
  };

  return (
    <>
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
                    onClick={() => handleDeleteField(field.id)}
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

      {/* Calculated Field Builder Dialog */}
      <CalculatedFieldBuilder
        open={calcFieldBuilderOpen}
        onClose={() => {
          setCalcFieldBuilderOpen(false);
          setEditingCalcField(null);
        }}
        onSave={handleSaveField}
        availableColumns={availableColumns}
        editingField={editingCalcField}
      />
    </>
  );
};
