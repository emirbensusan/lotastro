import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface CompositionItem {
  fiber: string;
  percent: number;
}

interface CompositionEditorProps {
  composition: CompositionItem[];
  onChange: (composition: CompositionItem[]) => void;
  disabled?: boolean;
}

const COMMON_FIBERS = [
  'Polyester', 'Viscose', 'Cotton', 'Nylon', 'Elastane', 
  'Wool', 'Silk', 'Linen', 'Acetate', 'Cupro'
];

const CompositionEditor: React.FC<CompositionEditorProps> = ({
  composition,
  onChange,
  disabled = false,
}) => {
  const { t } = useLanguage();

  const handleAdd = () => {
    onChange([...composition, { fiber: '', percent: 0 }]);
  };

  const handleRemove = (index: number) => {
    onChange(composition.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, field: keyof CompositionItem, value: string | number) => {
    const updated = [...composition];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const totalPercent = composition.reduce((sum, item) => sum + (item.percent || 0), 0);
  const isValid = totalPercent === 100 || composition.length === 0;

  return (
    <div className="space-y-3">
      {composition.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={item.fiber}
            onChange={(e) => handleUpdate(index, 'fiber', e.target.value)}
            placeholder={t('catalog.fiberName') as string}
            disabled={disabled}
            list="fiber-options"
            className="flex-1"
          />
          <datalist id="fiber-options">
            {COMMON_FIBERS.map(fiber => (
              <option key={fiber} value={fiber} />
            ))}
          </datalist>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              value={item.percent || ''}
              onChange={(e) => handleUpdate(index, 'percent', Number(e.target.value))}
              disabled={disabled}
              className="w-20 text-right"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ))}

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('catalog.addFiber')}
        </Button>
      )}

      {composition.length > 0 && (
        <div className={`text-sm ${isValid ? 'text-muted-foreground' : 'text-destructive'}`}>
          {t('catalog.totalPercent')}: {totalPercent}%
          {!isValid && ` (${t('catalog.mustEqual100')})`}
        </div>
      )}
    </div>
  );
};

export default CompositionEditor;
