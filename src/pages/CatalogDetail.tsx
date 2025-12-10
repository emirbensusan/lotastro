import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Check, 
  X, 
  Edit2, 
  BookOpen,
  Building2,
  FileText,
  Settings2,
  History,
  Save,
  AlertCircle
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CatalogOverviewTab from '@/components/catalog/CatalogOverviewTab';
import CatalogSuppliersTab from '@/components/catalog/CatalogSuppliersTab';
import CatalogFilesTab from '@/components/catalog/CatalogFilesTab';
import CatalogCustomFieldsTab from '@/components/catalog/CatalogCustomFieldsTab';
import CatalogHistoryTab from '@/components/catalog/CatalogHistoryTab';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CatalogItem {
  id: string;
  code: string;
  color_name: string;
  description: string | null;
  lastro_sku_code: string;
  logo_sku_code: string | null;
  status: string;
  type: string;
  is_active: boolean;
  composition: any;
  weaving_knitted: string | null;
  fabric_type: string | null;
  weight_g_m2: number | null;
  produced_unit: string;
  sold_unit: string;
  spec_sheet_url: string | null;
  spec_sheet_file: string | null;
  test_report_url: string | null;
  test_report_file: string | null;
  shade_range_image_url: string | null;
  photo_of_design_url: string | null;
  eu_origin: boolean;
  sustainable_notes: string | null;
  product_notes: string | null;
  care_instructions: string | null;
  dyeing_batch_size: number | null;
  suppliers: string | null;
  last_update_date: string | null;
  last_inbound_date: string | null;
  extra_attributes: any;
  created_at: string;
  created_by_user_id: string | null;
  updated_at: string;
  updated_by_user_id: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  temporarily_unavailable: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  end_of_life: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending Approval',
  active: 'Active',
  temporarily_unavailable: 'Temporarily Unavailable',
  blocked: 'Blocked',
  end_of_life: 'End of Life',
};

const CatalogDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [originalItem, setOriginalItem] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [hasChanges, setHasChanges] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [triggerFields, setTriggerFields] = useState<string[]>([]);

  const isNew = id === 'new';
  const canEdit = hasPermission('catalog', 'edit');
  const canApprove = hasPermission('catalog', 'approve');

  useEffect(() => {
    fetchTriggerFields();
    if (!isNew && id) {
      fetchItem();
    } else {
      // Initialize new item with defaults
      const newItem = {
        id: '',
        code: '',
        color_name: '',
        description: null,
        lastro_sku_code: '',
        logo_sku_code: null,
        status: 'pending_approval',
        type: 'lining',
        is_active: false,
        composition: [],
        weaving_knitted: null,
        fabric_type: null,
        weight_g_m2: null,
        produced_unit: 'meters',
        sold_unit: 'meters',
        spec_sheet_url: null,
        spec_sheet_file: null,
        test_report_url: null,
        test_report_file: null,
        shade_range_image_url: null,
        photo_of_design_url: null,
        eu_origin: false,
        sustainable_notes: null,
        product_notes: null,
        care_instructions: null,
        dyeing_batch_size: null,
        suppliers: null,
        last_update_date: null,
        last_inbound_date: null,
        extra_attributes: {},
        created_at: new Date().toISOString(),
        created_by_user_id: user?.id || null,
        updated_at: new Date().toISOString(),
        updated_by_user_id: null,
        approved_at: null,
        approved_by_user_id: null,
      };
      setItem(newItem);
      setOriginalItem(newItem);
      setLoading(false);
    }
  }, [id, isNew]);

  const fetchTriggerFields = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog_approval_settings')
        .select('setting_value')
        .eq('setting_key', 'trigger_fields')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching trigger fields:', error);
        return;
      }

      if (data) {
        setTriggerFields((data.setting_value as any)?.fields || []);
      }
    } catch (error) {
      console.error('Error fetching trigger fields:', error);
    }
  };

  const fetchItem = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data as any);
      setOriginalItem(data as any);
      
    } catch (error: any) {
      console.error('Error fetching catalog item:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch catalog item',
        variant: 'destructive',
      });
      navigate('/catalog');
    } finally {
      setLoading(false);
    }
  };

  // Check if any trigger fields have changed
  const getChangedTriggerFields = (): string[] => {
    if (!originalItem || !item || originalItem.status !== 'active') {
      return [];
    }

    const changedFields: string[] = [];
    for (const fieldKey of triggerFields) {
      const originalValue = originalItem[fieldKey as keyof CatalogItem];
      const newValue = item[fieldKey as keyof CatalogItem];
      
      // Deep compare for objects/arrays
      if (JSON.stringify(originalValue) !== JSON.stringify(newValue)) {
        changedFields.push(fieldKey);
      }
    }
    return changedFields;
  };

  const validateItem = (): { valid: boolean; errors: string[] } => {
    if (!item) return { valid: false, errors: ['No item to validate'] };
    
    const errors: string[] = [];
    
    // Required fields
    if (!item.code?.trim()) {
      errors.push(t('catalog.validation.codeRequired') as string);
    }
    if (!item.color_name?.trim()) {
      errors.push(t('catalog.validation.colorRequired') as string);
    }
    
    // Numeric validations (only if value is provided)
    if (item.weight_g_m2 !== null && item.weight_g_m2 !== undefined && item.weight_g_m2 <= 0) {
      errors.push(t('catalog.validation.invalidWeight') as string);
    }
    if (item.dyeing_batch_size !== null && item.dyeing_batch_size !== undefined && item.dyeing_batch_size <= 0) {
      errors.push(t('catalog.validation.invalidBatchSize') as string);
    }
    
    // Composition validation (if provided, must total ~100%)
    if (item.composition && Array.isArray(item.composition) && item.composition.length > 0) {
      const total = item.composition.reduce((sum: number, c: any) => sum + (c.percent || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        errors.push(t('catalog.validation.compositionTotal') as string);
      }
    }
    
    return { valid: errors.length === 0, errors };
  };

  const handleSave = async () => {
    if (!item) return;

    // Validate before saving
    const validation = validateItem();
    if (!validation.valid) {
      toast({
        title: t('validationError') as string,
        description: validation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        code: item.code,
        color_name: item.color_name,
        description: item.description,
        logo_sku_code: item.logo_sku_code,
        type: item.type,
        composition: item.composition,
        weaving_knitted: item.weaving_knitted,
        fabric_type: item.fabric_type,
        weight_g_m2: item.weight_g_m2,
        produced_unit: item.produced_unit,
        sold_unit: item.sold_unit,
        spec_sheet_url: item.spec_sheet_url,
        test_report_url: item.test_report_url,
        shade_range_image_url: item.shade_range_image_url,
        photo_of_design_url: item.photo_of_design_url,
        eu_origin: item.eu_origin,
        sustainable_notes: item.sustainable_notes,
        product_notes: item.product_notes,
        care_instructions: item.care_instructions,
        dyeing_batch_size: item.dyeing_batch_size,
        extra_attributes: item.extra_attributes,
        updated_by_user_id: user?.id,
      };

      if (isNew) {
        const { data, error } = await supabase
          .from('catalog_items')
          .insert({
            ...saveData,
            lastro_sku_code: '', // Will be auto-generated by trigger
            created_by_user_id: user?.id,
            status: 'pending_approval' as const,
          } as any)
          .select()
          .single();

        if (error) throw error;

        // Log creation audit
        await supabase.from('catalog_item_audit_logs').insert([{
          catalog_item_id: data.id,
          changed_by_user_id: user?.id,
          change_type: 'create',
          field_changes: { new: saveData },
        }]);

        toast({ title: 'Success', description: 'Catalog item created successfully' });
        navigate(`/catalog/${data.id}`);
      } else {
        // Check if trigger fields changed (only for active items)
        const changedTriggerFields = getChangedTriggerFields();
        const needsReApproval = changedTriggerFields.length > 0;
        
        const updateData: any = { ...saveData };
        
        // If trigger fields changed on an active item, reset to pending_approval
        if (needsReApproval) {
          updateData.status = 'pending_approval';
          updateData.approved_at = null;
          updateData.approved_by_user_id = null;
        }

        const { error } = await supabase
          .from('catalog_items')
          .update(updateData)
          .eq('id', item.id);

        if (error) throw error;

        // Log update audit
        await supabase.from('catalog_item_audit_logs').insert([{
          catalog_item_id: item.id,
          changed_by_user_id: user?.id,
          change_type: needsReApproval ? 'status_reset_pending' : 'update',
          field_changes: needsReApproval 
            ? { ...saveData, trigger_fields_changed: changedTriggerFields, status: { old: 'active', new: 'pending_approval' } }
            : saveData,
        }]);

        if (needsReApproval) {
          // Show re-approval toast
          const fieldLabels = changedTriggerFields.join(', ');
          toast({ 
            title: String(t('catalog.approvalSettings.reApprovalRequired')), 
            description: String(t('catalog.approvalSettings.reApprovalMessage')).replace('{fields}', fieldLabels),
            variant: 'default',
          });
        } else {
          toast({ title: 'Success', description: 'Catalog item updated successfully' });
        }
        
        setHasChanges(false);
        fetchItem();
      }
    } catch (error: any) {
      console.error('Error saving catalog item:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save catalog item',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!item) return;

    try {
      const { error } = await supabase
        .from('catalog_items')
        .update({
          status: 'active' as const,
          approved_at: new Date().toISOString(),
          approved_by_user_id: user?.id,
          updated_by_user_id: user?.id,
        })
        .eq('id', item.id);

      if (error) throw error;

      // Log approval audit
      await supabase.from('catalog_item_audit_logs').insert([{
        catalog_item_id: item.id,
        changed_by_user_id: user?.id,
        change_type: 'approval',
        field_changes: { status: { old: item.status, new: 'active' } },
      }]);

      toast({ title: 'Success', description: 'Catalog item approved' });
      fetchItem();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve item',
        variant: 'destructive',
      });
    }
    setShowApprovalDialog(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!item) return;
    setNewStatus(status);
    setShowStatusDialog(true);
  };

  const confirmStatusChange = async () => {
    if (!item || !newStatus) return;

    try {
      const { error } = await supabase
        .from('catalog_items')
        .update({
          status: newStatus as any,
          updated_by_user_id: user?.id,
        })
        .eq('id', item.id);

      if (error) throw error;

      // Log status change audit
      await supabase.from('catalog_item_audit_logs').insert([{
        catalog_item_id: item.id,
        changed_by_user_id: user?.id,
        change_type: 'status_change',
        field_changes: { status: { old: item.status, new: newStatus } },
      }]);

      toast({ title: 'Success', description: 'Status updated successfully' });
      fetchItem();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
    setShowStatusDialog(false);
  };

  const handleItemChange = (updates: Partial<CatalogItem>) => {
    if (item) {
      setItem({ ...item, ...updates });
      setHasChanges(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('catalog.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/catalog')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {isNew ? t('catalog.createNew') : `${item.code} - ${item.color_name}`}
              </h1>
              <Badge className={STATUS_COLORS[item.status] || ''}>
                {STATUS_LABELS[item.status] || item.status}
              </Badge>
            </div>
            {!isNew && (
              <p className="text-sm text-muted-foreground font-mono mt-1">
                {item.lastro_sku_code}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Approve button - only for pending items */}
          {canApprove && item.status === 'pending_approval' && !isNew && (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => setShowApprovalDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              {t('catalog.approve')}
            </Button>
          )}

          {/* Status change dropdown */}
          {canEdit && !isNew && item.status !== 'pending_approval' && (
            <select
              className="h-9 px-3 rounded-md border bg-background text-sm"
              value={item.status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="temporarily_unavailable">Temporarily Unavailable</option>
              <option value="blocked">Blocked</option>
              <option value="end_of_life">End of Life</option>
            </select>
          )}

          {/* Save button */}
          {canEdit && (
            <Button 
              size="sm" 
              onClick={handleSave}
              disabled={saving || (!isNew && !hasChanges)}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('loading') : t('save')}
            </Button>
          )}
        </div>
      </div>

      {/* Pending approval warning */}
      {item.status === 'pending_approval' && !isNew && (
        <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {t('catalog.pendingApprovalMessage')}
          </p>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden md:inline">{t('catalog.overview')}</span>
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2" disabled={isNew}>
            <Building2 className="h-4 w-4" />
            <span className="hidden md:inline">{t('catalog.suppliers')}</span>
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2" disabled={isNew}>
            <FileText className="h-4 w-4" />
            <span className="hidden md:inline">{t('catalog.files')}</span>
          </TabsTrigger>
          <TabsTrigger value="custom-fields" className="flex items-center gap-2" disabled={isNew}>
            <Settings2 className="h-4 w-4" />
            <span className="hidden md:inline">{t('catalog.customFields')}</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2" disabled={isNew}>
            <History className="h-4 w-4" />
            <span className="hidden md:inline">{t('catalog.history')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <CatalogOverviewTab 
            item={item} 
            onChange={handleItemChange}
            canEdit={canEdit}
            isNew={isNew}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-6">
          <CatalogSuppliersTab 
            catalogItemId={item.id}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="files" className="mt-6">
          <CatalogFilesTab 
            item={item}
            onChange={handleItemChange}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="custom-fields" className="mt-6">
          <CatalogCustomFieldsTab 
            catalogItemId={item.id}
            extraAttributes={item.extra_attributes}
            onChange={(attrs) => handleItemChange({ extra_attributes: attrs })}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <CatalogHistoryTab catalogItemId={item.id} />
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('catalog.confirmApproval')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('catalog.approvalDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              {t('catalog.approve')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Change Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('catalog.confirmStatusChange')}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t('catalog.statusChangeDescription')).replace('{status}', STATUS_LABELS[newStatus] || newStatus)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              {t('catalog.changeStatus')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CatalogDetail;
