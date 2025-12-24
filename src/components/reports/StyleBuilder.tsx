import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, X, Palette, Type, AlertTriangle, Trash2, Eye } from 'lucide-react';

interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
}

export interface ConditionalRule {
  id: string;
  column: string;
  operator: string;
  value: string;
  value2?: string;
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: 'normal' | 'bold';
  icon?: string;
}

export interface ReportStyling {
  headerBackgroundColor: string;
  headerTextColor: string;
  headerFontWeight: 'normal' | 'bold';
  alternateRowColors: boolean;
  evenRowColor: string;
  oddRowColor: string;
  borderStyle: 'none' | 'light' | 'medium' | 'heavy';
  fontSize: 'small' | 'medium' | 'large';
  conditionalRules: ConditionalRule[];
}

interface StyleBuilderProps {
  styling: ReportStyling;
  onChange: (styling: ReportStyling) => void;
  availableColumns: ColumnDefinition[];
}

const PRESET_COLORS = [
  { value: '#1e40af', label: 'Blue' },
  { value: '#166534', label: 'Green' },
  { value: '#9f1239', label: 'Red' },
  { value: '#7c2d12', label: 'Orange' },
  { value: '#581c87', label: 'Purple' },
  { value: '#1f2937', label: 'Gray' },
  { value: '#0f172a', label: 'Dark' },
  { value: '#ffffff', label: 'White' },
  { value: '#f3f4f6', label: 'Light Gray' },
  { value: '#fef3c7', label: 'Yellow' },
];

const CONDITIONAL_OPERATORS = {
  number: [
    { key: 'equals', labelEn: 'Equals', labelTr: 'Eşittir' },
    { key: 'not_equals', labelEn: 'Not Equals', labelTr: 'Eşit Değil' },
    { key: 'greater_than', labelEn: 'Greater Than', labelTr: 'Büyüktür' },
    { key: 'less_than', labelEn: 'Less Than', labelTr: 'Küçüktür' },
    { key: 'between', labelEn: 'Between', labelTr: 'Arasında' },
    { key: 'is_empty', labelEn: 'Is Empty', labelTr: 'Boş' },
  ],
  text: [
    { key: 'equals', labelEn: 'Equals', labelTr: 'Eşittir' },
    { key: 'contains', labelEn: 'Contains', labelTr: 'İçerir' },
    { key: 'starts_with', labelEn: 'Starts With', labelTr: 'İle Başlar' },
    { key: 'is_empty', labelEn: 'Is Empty', labelTr: 'Boş' },
  ],
  date: [
    { key: 'before', labelEn: 'Before', labelTr: 'Önce' },
    { key: 'after', labelEn: 'After', labelTr: 'Sonra' },
    { key: 'equals', labelEn: 'Equals', labelTr: 'Eşittir' },
    { key: 'is_empty', labelEn: 'Is Empty', labelTr: 'Boş' },
  ],
  boolean: [
    { key: 'is_true', labelEn: 'Is True', labelTr: 'Doğru' },
    { key: 'is_false', labelEn: 'Is False', labelTr: 'Yanlış' },
  ],
};

const DEFAULT_STYLING: ReportStyling = {
  headerBackgroundColor: '#1e40af',
  headerTextColor: '#ffffff',
  headerFontWeight: 'bold',
  alternateRowColors: true,
  evenRowColor: '#ffffff',
  oddRowColor: '#f9fafb',
  borderStyle: 'light',
  fontSize: 'medium',
  conditionalRules: [],
};

export const StyleBuilder: React.FC<StyleBuilderProps> = ({
  styling,
  onChange,
  availableColumns,
}) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('header');

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const getColumnLabel = (col: ColumnDefinition) => {
    return language === 'tr' ? col.labelTr : col.labelEn;
  };

  const getOperatorsForColumn = (columnKey: string) => {
    const column = availableColumns.find(c => c.key === columnKey);
    if (!column) return CONDITIONAL_OPERATORS.text;
    
    switch (column.type) {
      case 'number':
      case 'currency':
        return CONDITIONAL_OPERATORS.number;
      case 'date':
        return CONDITIONAL_OPERATORS.date;
      case 'boolean':
        return CONDITIONAL_OPERATORS.boolean;
      default:
        return CONDITIONAL_OPERATORS.text;
    }
  };

  const addConditionalRule = () => {
    const firstColumn = availableColumns[0];
    const operators = getOperatorsForColumn(firstColumn?.key || '');
    const newRule: ConditionalRule = {
      id: generateId(),
      column: firstColumn?.key || '',
      operator: operators[0]?.key || 'equals',
      value: '',
      backgroundColor: '#fef3c7',
      textColor: '#1f2937',
      fontWeight: 'normal',
    };
    onChange({
      ...styling,
      conditionalRules: [...styling.conditionalRules, newRule],
    });
  };

  const updateConditionalRule = (ruleId: string, updates: Partial<ConditionalRule>) => {
    onChange({
      ...styling,
      conditionalRules: styling.conditionalRules.map(rule =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ),
    });
  };

  const removeConditionalRule = (ruleId: string) => {
    onChange({
      ...styling,
      conditionalRules: styling.conditionalRules.filter(rule => rule.id !== ruleId),
    });
  };

  const needsValue = (operator: string) => {
    return !['is_empty', 'is_true', 'is_false'].includes(operator);
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="header" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            <span>{language === 'tr' ? 'Başlık' : 'Header'}</span>
          </TabsTrigger>
          <TabsTrigger value="rows" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span>{language === 'tr' ? 'Satırlar' : 'Rows'}</span>
          </TabsTrigger>
          <TabsTrigger value="conditional" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{language === 'tr' ? 'Koşullu' : 'Conditional'}</span>
          </TabsTrigger>
        </TabsList>

        {/* Header Styling Tab */}
        <TabsContent value="header" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Arka Plan Rengi' : 'Background Color'}</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={styling.headerBackgroundColor}
                  onChange={(e) => onChange({ ...styling, headerBackgroundColor: e.target.value })}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.slice(0, 6).map((color) => (
                    <button
                      key={color.value}
                      className={`w-6 h-6 rounded border-2 ${
                        styling.headerBackgroundColor === color.value ? 'border-primary' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => onChange({ ...styling, headerBackgroundColor: color.value })}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Metin Rengi' : 'Text Color'}</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={styling.headerTextColor}
                  onChange={(e) => onChange({ ...styling, headerTextColor: e.target.value })}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <div className="flex flex-wrap gap-1">
                  {[PRESET_COLORS[7], PRESET_COLORS[6], PRESET_COLORS[5]].map((color) => (
                    <button
                      key={color.value}
                      className={`w-6 h-6 rounded border-2 ${
                        styling.headerTextColor === color.value ? 'border-primary' : 'border-muted'
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => onChange({ ...styling, headerTextColor: color.value })}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{language === 'tr' ? 'Yazı Tipi Kalınlığı' : 'Font Weight'}</Label>
            <Select
              value={styling.headerFontWeight}
              onValueChange={(val) => onChange({ ...styling, headerFontWeight: val as 'normal' | 'bold' })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{language === 'tr' ? 'Normal' : 'Normal'}</SelectItem>
                <SelectItem value="bold">{language === 'tr' ? 'Kalın' : 'Bold'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{language === 'tr' ? 'Yazı Boyutu' : 'Font Size'}</Label>
            <Select
              value={styling.fontSize}
              onValueChange={(val) => onChange({ ...styling, fontSize: val as 'small' | 'medium' | 'large' })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">{language === 'tr' ? 'Küçük' : 'Small'}</SelectItem>
                <SelectItem value="medium">{language === 'tr' ? 'Orta' : 'Medium'}</SelectItem>
                <SelectItem value="large">{language === 'tr' ? 'Büyük' : 'Large'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{language === 'tr' ? 'Kenarlık Stili' : 'Border Style'}</Label>
            <Select
              value={styling.borderStyle}
              onValueChange={(val) => onChange({ ...styling, borderStyle: val as 'none' | 'light' | 'medium' | 'heavy' })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{language === 'tr' ? 'Yok' : 'None'}</SelectItem>
                <SelectItem value="light">{language === 'tr' ? 'İnce' : 'Light'}</SelectItem>
                <SelectItem value="medium">{language === 'tr' ? 'Orta' : 'Medium'}</SelectItem>
                <SelectItem value="heavy">{language === 'tr' ? 'Kalın' : 'Heavy'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="mt-4 p-4 border rounded-lg bg-muted/30">
            <Label className="mb-2 block">{language === 'tr' ? 'Önizleme' : 'Preview'}</Label>
            <div className="overflow-hidden rounded border">
              <table className="w-full" style={{ fontSize: styling.fontSize === 'small' ? '12px' : styling.fontSize === 'large' ? '16px' : '14px' }}>
                <thead>
                  <tr style={{ 
                    backgroundColor: styling.headerBackgroundColor, 
                    color: styling.headerTextColor,
                    fontWeight: styling.headerFontWeight
                  }}>
                    <th className="p-2 text-left">{language === 'tr' ? 'Kalite' : 'Quality'}</th>
                    <th className="p-2 text-left">{language === 'tr' ? 'Renk' : 'Color'}</th>
                    <th className="p-2 text-right">{language === 'tr' ? 'Metre' : 'Meters'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: styling.evenRowColor }}>
                    <td className="p-2" style={{ borderWidth: styling.borderStyle === 'none' ? 0 : styling.borderStyle === 'light' ? 1 : styling.borderStyle === 'medium' ? 2 : 3, borderColor: '#e5e7eb', borderStyle: 'solid' }}>Q-001</td>
                    <td className="p-2" style={{ borderWidth: styling.borderStyle === 'none' ? 0 : styling.borderStyle === 'light' ? 1 : styling.borderStyle === 'medium' ? 2 : 3, borderColor: '#e5e7eb', borderStyle: 'solid' }}>Blue</td>
                    <td className="p-2 text-right" style={{ borderWidth: styling.borderStyle === 'none' ? 0 : styling.borderStyle === 'light' ? 1 : styling.borderStyle === 'medium' ? 2 : 3, borderColor: '#e5e7eb', borderStyle: 'solid' }}>1,500</td>
                  </tr>
                  {styling.alternateRowColors && (
                    <tr style={{ backgroundColor: styling.oddRowColor }}>
                      <td className="p-2" style={{ borderWidth: styling.borderStyle === 'none' ? 0 : styling.borderStyle === 'light' ? 1 : styling.borderStyle === 'medium' ? 2 : 3, borderColor: '#e5e7eb', borderStyle: 'solid' }}>Q-002</td>
                      <td className="p-2" style={{ borderWidth: styling.borderStyle === 'none' ? 0 : styling.borderStyle === 'light' ? 1 : styling.borderStyle === 'medium' ? 2 : 3, borderColor: '#e5e7eb', borderStyle: 'solid' }}>Red</td>
                      <td className="p-2 text-right" style={{ borderWidth: styling.borderStyle === 'none' ? 0 : styling.borderStyle === 'light' ? 1 : styling.borderStyle === 'medium' ? 2 : 3, borderColor: '#e5e7eb', borderStyle: 'solid' }}>2,300</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Row Styling Tab */}
        <TabsContent value="rows" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{language === 'tr' ? 'Alternatif Satır Renkleri' : 'Alternate Row Colors'}</Label>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Çift ve tek satırlar için farklı renkler kullan' : 'Use different colors for even and odd rows'}
              </p>
            </div>
            <Switch
              checked={styling.alternateRowColors}
              onCheckedChange={(val) => onChange({ ...styling, alternateRowColors: val })}
            />
          </div>

          {styling.alternateRowColors && (
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label>{language === 'tr' ? 'Çift Satır Rengi' : 'Even Row Color'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={styling.evenRowColor}
                    onChange={(e) => onChange({ ...styling, evenRowColor: e.target.value })}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={styling.evenRowColor}
                    onChange={(e) => onChange({ ...styling, evenRowColor: e.target.value })}
                    className="flex-1"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === 'tr' ? 'Tek Satır Rengi' : 'Odd Row Color'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={styling.oddRowColor}
                    onChange={(e) => onChange({ ...styling, oddRowColor: e.target.value })}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={styling.oddRowColor}
                    onChange={(e) => onChange({ ...styling, oddRowColor: e.target.value })}
                    className="flex-1"
                    placeholder="#f9fafb"
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Conditional Formatting Tab */}
        <TabsContent value="conditional" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{language === 'tr' ? 'Koşullu Biçimlendirme' : 'Conditional Formatting'}</h4>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Değerlere göre hücreleri vurgula' : 'Highlight cells based on values'}
              </p>
            </div>
            <Button onClick={addConditionalRule} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'tr' ? 'Kural Ekle' : 'Add Rule'}
            </Button>
          </div>

          {styling.conditionalRules.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Henüz kural eklenmedi' : 'No rules added yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'tr' ? 'Koşullu biçimlendirme için kural ekleyin' : 'Add rules to highlight cells conditionally'}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[350px]">
              <div className="space-y-3 pr-4">
                {styling.conditionalRules.map((rule, index) => {
                  const operators = getOperatorsForColumn(rule.column);
                  const column = availableColumns.find(c => c.key === rule.column);
                  
                  return (
                    <div key={rule.id} className="p-4 border rounded-lg bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">
                          {language === 'tr' ? `Kural ${index + 1}` : `Rule ${index + 1}`}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeConditionalRule(rule.id)}
                          className="h-7 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Condition Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {language === 'tr' ? 'Eğer' : 'If'}
                        </span>
                        <Select
                          value={rule.column}
                          onValueChange={(val) => {
                            const newOperators = getOperatorsForColumn(val);
                            updateConditionalRule(rule.id, { 
                              column: val,
                              operator: newOperators[0]?.key || 'equals'
                            });
                          }}
                        >
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns.map(col => (
                              <SelectItem key={col.key} value={col.key}>
                                {getColumnLabel(col)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={rule.operator}
                          onValueChange={(val) => updateConditionalRule(rule.id, { operator: val })}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map(op => (
                              <SelectItem key={op.key} value={op.key}>
                                {language === 'tr' ? op.labelTr : op.labelEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {needsValue(rule.operator) && (
                          <Input
                            value={rule.value}
                            onChange={(e) => updateConditionalRule(rule.id, { value: e.target.value })}
                            placeholder={language === 'tr' ? 'Değer' : 'Value'}
                            className="w-24 h-8"
                          />
                        )}
                      </div>

                      {/* Styling Row */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                        <span className="text-sm text-muted-foreground">
                          {language === 'tr' ? 'Şu şekilde göster:' : 'Then show as:'}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">{language === 'tr' ? 'Arka Plan' : 'BG'}</Label>
                          <Input
                            type="color"
                            value={rule.backgroundColor || '#fef3c7'}
                            onChange={(e) => updateConditionalRule(rule.id, { backgroundColor: e.target.value })}
                            className="w-8 h-8 p-1 cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <Label className="text-xs">{language === 'tr' ? 'Metin' : 'Text'}</Label>
                          <Input
                            type="color"
                            value={rule.textColor || '#1f2937'}
                            onChange={(e) => updateConditionalRule(rule.id, { textColor: e.target.value })}
                            className="w-8 h-8 p-1 cursor-pointer"
                          />
                        </div>

                        <Select
                          value={rule.fontWeight || 'normal'}
                          onValueChange={(val) => updateConditionalRule(rule.id, { fontWeight: val as 'normal' | 'bold' })}
                        >
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="bold">{language === 'tr' ? 'Kalın' : 'Bold'}</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Mini Preview */}
                        <div 
                          className="px-3 py-1 rounded text-sm flex items-center gap-1"
                          style={{ 
                            backgroundColor: rule.backgroundColor || '#fef3c7',
                            color: rule.textColor || '#1f2937',
                            fontWeight: rule.fontWeight || 'normal'
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          {language === 'tr' ? 'Önizleme' : 'Preview'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const DEFAULT_REPORT_STYLING = DEFAULT_STYLING;

export default StyleBuilder;
