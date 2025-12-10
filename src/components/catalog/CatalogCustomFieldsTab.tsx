import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CustomFieldDefinition {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  options: string[] | null;
  help_text: string | null;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
}

interface CatalogCustomFieldsTabProps {
  catalogItemId: string;
  extraAttributes: Record<string, any>;
  onChange: (attrs: Record<string, any>) => void;
  canEdit: boolean;
}

const CatalogCustomFieldsTab: React.FC<CatalogCustomFieldsTabProps> = ({
  catalogItemId,
  extraAttributes,
  onChange,
  canEdit,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDefinitions();
  }, []);

  const fetchDefinitions = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog_custom_field_definitions')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setDefinitions(data || []);
    } catch (error: any) {
      console.error('Error fetching custom field definitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    onChange({
      ...extraAttributes,
      [fieldKey]: value,
    });
  };

  const renderField = (def: CustomFieldDefinition) => {
    const value = extraAttributes?.[def.field_key];

    switch (def.field_type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldChange(def.field_key, e.target.value)}
            disabled={!canEdit}
            placeholder={def.help_text || ''}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleFieldChange(def.field_key, e.target.value ? Number(e.target.value) : null)}
            disabled={!canEdit}
            placeholder={def.help_text || ''}
          />
        );

      case 'boolean':
        return (
          <Switch
            checked={value || false}
            onCheckedChange={(checked) => handleFieldChange(def.field_key, checked)}
            disabled={!canEdit}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => handleFieldChange(def.field_key, e.target.value)}
            disabled={!canEdit}
          />
        );

      case 'dropdown':
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => handleFieldChange(def.field_key, val)}
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder={def.help_text || `Select ${def.label}`} />
            </SelectTrigger>
            <SelectContent>
              {(def.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'url':
        return (
          <Input
            type="url"
            value={value || ''}
            onChange={(e) => handleFieldChange(def.field_key, e.target.value)}
            disabled={!canEdit}
            placeholder="https://..."
          />
        );

      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldChange(def.field_key, e.target.value)}
            disabled={!canEdit}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (definitions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Settings2 className="h-12 w-12 mb-4 opacity-50" />
          <p>{t('catalog.noCustomFields')}</p>
          <p className="text-sm mt-2">{t('catalog.customFieldsCanBeAdded')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          {t('catalog.customFields')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {definitions.map((def) => (
            <div key={def.id} className="space-y-2">
              <Label htmlFor={def.field_key}>
                {def.label}
                {def.is_required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {renderField(def)}
              {def.help_text && def.field_type !== 'text' && (
                <p className="text-xs text-muted-foreground">{def.help_text}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CatalogCustomFieldsTab;
