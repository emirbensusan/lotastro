import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Save, Settings2, Mail, Info, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface CatalogApprovalSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FieldCategory {
  key: string;
  labelKey: string;
  fields: {
    key: string;
    labelKey: string;
  }[];
}

const FIELD_CATEGORIES: FieldCategory[] = [
  {
    key: 'basic',
    labelKey: 'catalog.approvalSettings.categories.basic',
    fields: [
      { key: 'code', labelKey: 'catalog.code' },
      { key: 'color_name', labelKey: 'catalog.colorName' },
      { key: 'type', labelKey: 'catalog.type' },
      { key: 'description', labelKey: 'catalog.description' },
    ],
  },
  {
    key: 'fabric',
    labelKey: 'catalog.approvalSettings.categories.fabric',
    fields: [
      { key: 'composition', labelKey: 'catalog.composition' },
      { key: 'weight_g_m2', labelKey: 'catalog.weight' },
      { key: 'weaving_knitted', labelKey: 'catalog.weavingKnitted' },
      { key: 'fabric_type', labelKey: 'catalog.fabricType' },
      { key: 'dyeing_batch_size', labelKey: 'catalog.dyeingBatchSize' },
    ],
  },
  {
    key: 'compliance',
    labelKey: 'catalog.approvalSettings.categories.compliance',
    fields: [
      { key: 'eu_origin', labelKey: 'catalog.euOrigin' },
      { key: 'sustainable_notes', labelKey: 'catalog.sustainableNotes' },
      { key: 'care_instructions', labelKey: 'catalog.careInstructions' },
    ],
  },
  {
    key: 'files',
    labelKey: 'catalog.approvalSettings.categories.files',
    fields: [
      { key: 'spec_sheet_url', labelKey: 'catalog.specSheet' },
      { key: 'spec_sheet_file', labelKey: 'catalog.specSheetFile' },
      { key: 'test_report_url', labelKey: 'catalog.testReport' },
      { key: 'test_report_file', labelKey: 'catalog.testReportFile' },
      { key: 'shade_range_image_url', labelKey: 'catalog.shadeRangeImage' },
      { key: 'photo_of_design_url', labelKey: 'catalog.photoOfDesign' },
    ],
  },
];

const DEFAULT_TRIGGER_FIELDS = ['composition', 'weight_g_m2', 'eu_origin', 'spec_sheet_file', 'test_report_file'];

const CatalogApprovalSettings: React.FC<CatalogApprovalSettingsProps> = ({ open, onOpenChange }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [triggerFields, setTriggerFields] = useState<string[]>(DEFAULT_TRIGGER_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['basic', 'fabric']);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalFields, setOriginalFields] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalog_approval_settings')
        .select('*')
        .eq('setting_key', 'trigger_fields')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const fields = (data.setting_value as any)?.fields || DEFAULT_TRIGGER_FIELDS;
        setTriggerFields(fields);
        setOriginalFields(fields);
      } else {
        setTriggerFields(DEFAULT_TRIGGER_FIELDS);
        setOriginalFields(DEFAULT_TRIGGER_FIELDS);
      }
    } catch (error: any) {
      console.error('Error fetching approval settings:', error);
      toast({
        title: String(t('error')),
        description: String(t('catalog.approvalSettings.fetchError')),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldToggle = (fieldKey: string, checked: boolean) => {
    const newFields = checked
      ? [...triggerFields, fieldKey]
      : triggerFields.filter(f => f !== fieldKey);
    setTriggerFields(newFields);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('catalog_approval_settings')
        .upsert({
          setting_key: 'trigger_fields',
          setting_value: { fields: triggerFields },
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key',
        });

      if (error) throw error;

      setOriginalFields(triggerFields);
      setHasChanges(false);
      toast({
        title: String(t('success')),
        description: String(t('catalog.approvalSettings.saved')),
      });
    } catch (error: any) {
      console.error('Error saving approval settings:', error);
      toast({
        title: String(t('error')),
        description: error.message || String(t('catalog.approvalSettings.saveError')),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const getCategorySelectedCount = (category: FieldCategory) => {
    return category.fields.filter(f => triggerFields.includes(f.key)).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {t('catalog.approvalSettings.title')}
          </DialogTitle>
          <DialogDescription>
            {t('catalog.approvalSettings.description')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                {t('catalog.approvalSettings.infoMessage')}
              </p>
            </div>

            {/* Field Categories */}
            <div className="space-y-2">
              {FIELD_CATEGORIES.map((category) => (
                <Collapsible
                  key={category.key}
                  open={expandedCategories.includes(category.key)}
                  onOpenChange={() => toggleCategory(category.key)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {t(category.labelKey)}
                            </CardTitle>
                            <Badge variant="secondary" className="text-xs">
                              {getCategorySelectedCount(category)} / {category.fields.length}
                            </Badge>
                          </div>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 text-muted-foreground transition-transform',
                              expandedCategories.includes(category.key) && 'rotate-180'
                            )}
                          />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-3">
                        <div className="grid grid-cols-2 gap-3">
                          {category.fields.map((field) => (
                            <div key={field.key} className="flex items-center space-x-2">
                              <Checkbox
                                id={`field-${field.key}`}
                                checked={triggerFields.includes(field.key)}
                                onCheckedChange={(checked) => 
                                  handleFieldToggle(field.key, checked as boolean)
                                }
                              />
                              <Label
                                htmlFor={`field-${field.key}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {t(field.labelKey)}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>

            {/* Selected fields summary */}
            {triggerFields.length > 0 && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm font-medium mb-2">
                  {t('catalog.approvalSettings.selectedFields')} ({triggerFields.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {triggerFields.map((field) => {
                    const fieldInfo = FIELD_CATEGORIES.flatMap(c => c.fields).find(f => f.key === field);
                    return (
                      <Badge key={field} variant="outline" className="text-xs">
                        {fieldInfo ? t(fieldInfo.labelKey) : field}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Email Notifications Section */}
            <Card className="border-dashed opacity-75">
              <CardHeader className="py-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    {t('catalog.approvalSettings.emailNotifications')}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {t('comingSoon')}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {t('catalog.approvalSettings.emailNotificationsDesc')}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CatalogApprovalSettings;
