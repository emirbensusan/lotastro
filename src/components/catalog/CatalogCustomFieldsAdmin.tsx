import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Power, PowerOff, GripVertical, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CustomFieldDefinition {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  options: string[] | null;
  help_text: string | null;
  is_required: boolean;
  is_active: boolean;
  display_order: number | null;
  scope: string;
  created_at: string;
  created_by_user_id: string | null;
  updated_at: string;
}

interface CatalogCustomFieldsAdminProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes/No Toggle' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'url', label: 'URL' },
];

const generateFieldKey = (label: string): string => {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
};

const CatalogCustomFieldsAdmin: React.FC<CatalogCustomFieldsAdminProps> = ({ open, onOpenChange }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [fieldToToggle, setFieldToToggle] = useState<CustomFieldDefinition | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    label: '',
    field_key: '',
    field_type: 'text',
    options: [] as string[],
    help_text: '',
    is_required: false,
    display_order: 0,
  });
  const [newOption, setNewOption] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchDefinitions();
    }
  }, [open]);

  const fetchDefinitions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalog_custom_field_definitions')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setDefinitions((data as CustomFieldDefinition[]) || []);
    } catch (error: any) {
      console.error('Error fetching custom field definitions:', error);
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredDefinitions = definitions.filter(d => {
    if (filter === 'active') return d.is_active;
    if (filter === 'inactive') return !d.is_active;
    return true;
  });

  const resetForm = () => {
    setFormData({
      label: '',
      field_key: '',
      field_type: 'text',
      options: [],
      help_text: '',
      is_required: false,
      display_order: definitions.length + 1,
    });
    setNewOption('');
  };

  const handleCreateClick = () => {
    resetForm();
    setFormData(prev => ({
      ...prev,
      display_order: definitions.length + 1,
    }));
    setCreateDialogOpen(true);
  };

  const handleEditClick = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setFormData({
      label: field.label,
      field_key: field.field_key,
      field_type: field.field_type,
      options: field.options || [],
      help_text: field.help_text || '',
      is_required: field.is_required,
      display_order: field.display_order || 0,
    });
    setEditDialogOpen(true);
  };

  const handleToggleClick = (field: CustomFieldDefinition) => {
    setFieldToToggle(field);
    setDeactivateDialogOpen(true);
  };

  const handleLabelChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      label: value,
      field_key: !editDialogOpen ? generateFieldKey(value) : prev.field_key,
    }));
  };

  const handleAddOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, newOption.trim()],
      }));
      setNewOption('');
    }
  };

  const handleRemoveOption = (optionToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter(opt => opt !== optionToRemove),
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.label.trim()) {
      return t('catalog.customFieldsAdmin.labelRequired') as string;
    }
    if (!formData.field_key.trim()) {
      return t('catalog.customFieldsAdmin.fieldKeyRequired') as string;
    }
    if (formData.field_type === 'dropdown' && formData.options.length === 0) {
      return t('catalog.customFieldsAdmin.atLeastOneOption') as string;
    }
    // Check for duplicate field_key (only for create)
    if (!editDialogOpen) {
      const exists = definitions.some(d => d.field_key === formData.field_key);
      if (exists) {
        return t('catalog.customFieldsAdmin.fieldKeyUnique') as string;
      }
    }
    return null;
  };

  const handleCreate = async () => {
    const error = validateForm();
    if (error) {
      toast({ title: t('error') as string, description: error, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error: insertError } = await supabase
        .from('catalog_custom_field_definitions')
        .insert({
          field_key: formData.field_key,
          label: formData.label,
          field_type: formData.field_type,
          options: formData.field_type === 'dropdown' ? formData.options : null,
          help_text: formData.help_text || null,
          is_required: formData.is_required,
          display_order: formData.display_order,
          created_by_user_id: profile?.user_id || null,
        });

      if (insertError) throw insertError;

      toast({
        title: t('success') as string,
        description: t('catalog.customFieldsAdmin.fieldCreated') as string,
      });
      setCreateDialogOpen(false);
      fetchDefinitions();
    } catch (error: any) {
      console.error('Error creating custom field:', error);
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingField) return;

    const error = validateForm();
    if (error) {
      toast({ title: t('error') as string, description: error, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('catalog_custom_field_definitions')
        .update({
          label: formData.label,
          options: formData.field_type === 'dropdown' ? formData.options : null,
          help_text: formData.help_text || null,
          is_required: formData.is_required,
          display_order: formData.display_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingField.id);

      if (updateError) throw updateError;

      toast({
        title: t('success') as string,
        description: t('catalog.customFieldsAdmin.fieldUpdated') as string,
      });
      setEditDialogOpen(false);
      setEditingField(null);
      fetchDefinitions();
    } catch (error: any) {
      console.error('Error updating custom field:', error);
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!fieldToToggle) return;

    setSaving(true);
    try {
      const newStatus = !fieldToToggle.is_active;
      const { error: updateError } = await supabase
        .from('catalog_custom_field_definitions')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fieldToToggle.id);

      if (updateError) throw updateError;

      toast({
        title: t('success') as string,
        description: newStatus 
          ? (t('catalog.customFieldsAdmin.fieldReactivated') as string)
          : (t('catalog.customFieldsAdmin.fieldDeactivated') as string),
      });
      setDeactivateDialogOpen(false);
      setFieldToToggle(null);
      fetchDefinitions();
    } catch (error: any) {
      console.error('Error toggling custom field:', error);
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getFieldTypeLabel = (type: string) => {
    return t(`catalog.customFieldsAdmin.fieldType${type.charAt(0).toUpperCase() + type.slice(1)}`) as string;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('catalog.customFieldsAdmin.title')}</DialogTitle>
            <DialogDescription>{t('catalog.customFieldsAdmin.description')}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <Button
                variant={filter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('active')}
              >
                {t('catalog.customFieldsAdmin.active')}
              </Button>
              <Button
                variant={filter === 'inactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('inactive')}
              >
                {t('catalog.customFieldsAdmin.inactive')}
              </Button>
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                {t('all')}
              </Button>
            </div>
            <Button onClick={handleCreateClick}>
              <Plus className="h-4 w-4 mr-2" />
              {t('catalog.customFieldsAdmin.createField')}
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredDefinitions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {t('catalog.customFieldsAdmin.noFields')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{t('catalog.customFieldsAdmin.fieldLabel')}</TableHead>
                    <TableHead>{t('catalog.customFieldsAdmin.fieldKey')}</TableHead>
                    <TableHead>{t('catalog.customFieldsAdmin.fieldType')}</TableHead>
                    <TableHead>{t('catalog.customFieldsAdmin.options')}</TableHead>
                    <TableHead>{t('catalog.customFieldsAdmin.required')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="w-24">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDefinitions.map((field, index) => (
                    <TableRow key={field.id} className={!field.is_active ? 'opacity-60' : ''}>
                      <TableCell className="text-muted-foreground">{field.display_order || index + 1}</TableCell>
                      <TableCell className="font-medium">{field.label}</TableCell>
                      <TableCell className="font-mono text-xs">{field.field_key}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getFieldTypeLabel(field.field_type)}</Badge>
                      </TableCell>
                      <TableCell>
                        {field.field_type === 'dropdown' && field.options ? (
                          <span className="text-sm text-muted-foreground">
                            {field.options.length} {t('catalog.customFieldsAdmin.options').toString().toLowerCase()}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {field.is_required ? (
                          <Badge variant="secondary">✓</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={field.is_active ? 'default' : 'secondary'}>
                          {field.is_active 
                            ? t('catalog.customFieldsAdmin.active') 
                            : t('catalog.customFieldsAdmin.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditClick(field)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleToggleClick(field)}>
                            {field.is_active ? (
                              <PowerOff className="h-4 w-4 text-destructive" />
                            ) : (
                              <Power className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Field Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('catalog.customFieldsAdmin.createField')}</DialogTitle>
          </DialogHeader>
          <FieldForm
            formData={formData}
            setFormData={setFormData}
            onLabelChange={handleLabelChange}
            newOption={newOption}
            setNewOption={setNewOption}
            onAddOption={handleAddOption}
            onRemoveOption={handleRemoveOption}
            isEdit={false}
            t={t}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? t('saving') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingField(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('catalog.customFieldsAdmin.editField')}</DialogTitle>
          </DialogHeader>
          <FieldForm
            formData={formData}
            setFormData={setFormData}
            onLabelChange={handleLabelChange}
            newOption={newOption}
            setNewOption={setNewOption}
            onAddOption={handleAddOption}
            onRemoveOption={handleRemoveOption}
            isEdit={true}
            t={t}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Reactivate Confirmation */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {fieldToToggle?.is_active 
                ? t('catalog.customFieldsAdmin.deactivateConfirmTitle')
                : t('catalog.customFieldsAdmin.reactivateConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {fieldToToggle?.is_active 
                ? t('catalog.customFieldsAdmin.deactivateConfirmMessage')
                : t('catalog.customFieldsAdmin.reactivateConfirmMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={saving}>
              {fieldToToggle?.is_active 
                ? t('catalog.customFieldsAdmin.deactivate')
                : t('catalog.customFieldsAdmin.reactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Field Form Component
interface FieldFormProps {
  formData: {
    label: string;
    field_key: string;
    field_type: string;
    options: string[];
    help_text: string;
    is_required: boolean;
    display_order: number;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    label: string;
    field_key: string;
    field_type: string;
    options: string[];
    help_text: string;
    is_required: boolean;
    display_order: number;
  }>>;
  onLabelChange: (value: string) => void;
  newOption: string;
  setNewOption: (value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (option: string) => void;
  isEdit: boolean;
  t: (key: string) => string | string[];
}

const FieldForm: React.FC<FieldFormProps> = ({
  formData,
  setFormData,
  onLabelChange,
  newOption,
  setNewOption,
  onAddOption,
  onRemoveOption,
  isEdit,
  t,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('catalog.customFieldsAdmin.fieldLabel')} *</Label>
        <Input
          value={formData.label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={t('catalog.customFieldsAdmin.fieldLabelPlaceholder') as string}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('catalog.customFieldsAdmin.fieldKey')} *</Label>
        <Input
          value={formData.field_key}
          onChange={(e) => setFormData(prev => ({ ...prev, field_key: e.target.value }))}
          disabled={isEdit}
          className={isEdit ? 'bg-muted' : ''}
          placeholder="e.g., certification_date"
        />
        <p className="text-xs text-muted-foreground">
          {t('catalog.customFieldsAdmin.fieldKeyHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{t('catalog.customFieldsAdmin.fieldType')} *</Label>
        <Select
          value={formData.field_type}
          onValueChange={(value) => setFormData(prev => ({ ...prev, field_type: value }))}
          disabled={isEdit}
        >
          <SelectTrigger className={isEdit ? 'bg-muted' : ''}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {t(`catalog.customFieldsAdmin.fieldType${type.value.charAt(0).toUpperCase() + type.value.slice(1)}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formData.field_type === 'dropdown' && (
        <div className="space-y-2">
          <Label>{t('catalog.customFieldsAdmin.options')} *</Label>
          <div className="flex gap-2">
            <Input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              placeholder={t('catalog.customFieldsAdmin.optionsHint') as string}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddOption();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={onAddOption}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {formData.options.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.options.map((opt, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {opt}
                  <button
                    type="button"
                    onClick={() => onRemoveOption(opt)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>{t('catalog.customFieldsAdmin.helpText')}</Label>
        <Input
          value={formData.help_text}
          onChange={(e) => setFormData(prev => ({ ...prev, help_text: e.target.value }))}
          placeholder={t('catalog.customFieldsAdmin.helpTextHint') as string}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('catalog.customFieldsAdmin.displayOrder')}</Label>
        <Input
          type="number"
          value={formData.display_order}
          onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
          min={0}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={formData.is_required}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_required: checked }))}
        />
        <Label>{t('catalog.customFieldsAdmin.required')}</Label>
      </div>
    </div>
  );
};

export default CatalogCustomFieldsAdmin;
