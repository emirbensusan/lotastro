import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CatalogSupplier {
  id: string;
  catalog_item_id: string;
  supplier_name: string;
  supplier_code: string | null;
  moq: number | null;
  lead_time_days: number | null;
  supplier_notes: string | null;
  last_update_date: string | null;
  created_at: string;
}

interface CatalogSuppliersTabProps {
  catalogItemId: string;
  canEdit: boolean;
}

const CatalogSuppliersTab: React.FC<CatalogSuppliersTabProps> = ({
  catalogItemId,
  canEdit,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<CatalogSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<CatalogSupplier | null>(null);
  const [formData, setFormData] = useState({
    supplier_name: '',
    supplier_code: '',
    moq: '',
    lead_time_days: '',
    supplier_notes: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, [catalogItemId]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog_item_suppliers')
        .select('*')
        .eq('catalog_item_id', catalogItemId)
        .order('supplier_name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (supplier?: CatalogSupplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        supplier_name: supplier.supplier_name,
        supplier_code: supplier.supplier_code || '',
        moq: supplier.moq?.toString() || '',
        lead_time_days: supplier.lead_time_days?.toString() || '',
        supplier_notes: supplier.supplier_notes || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        supplier_name: '',
        supplier_code: '',
        moq: '',
        lead_time_days: '',
        supplier_notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const saveData = {
        catalog_item_id: catalogItemId,
        supplier_name: formData.supplier_name,
        supplier_code: formData.supplier_code || null,
        moq: formData.moq ? Number(formData.moq) : null,
        lead_time_days: formData.lead_time_days ? Number(formData.lead_time_days) : null,
        supplier_notes: formData.supplier_notes || null,
        last_update_date: new Date().toISOString().split('T')[0],
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from('catalog_item_suppliers')
          .update(saveData)
          .eq('id', editingSupplier.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Supplier updated successfully' });
      } else {
        const { error } = await supabase
          .from('catalog_item_suppliers')
          .insert(saveData);

        if (error) throw error;
        toast({ title: 'Success', description: 'Supplier added successfully' });
      }

      setDialogOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('catalog.confirmDeleteSupplier'))) return;

    try {
      const { error } = await supabase
        .from('catalog_item_suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Supplier removed' });
      fetchSuppliers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t('catalog.suppliers')}
        </CardTitle>
        {canEdit && (
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            {t('catalog.addSupplier')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {suppliers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('catalog.noSuppliers')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('catalog.supplierName')}</TableHead>
                <TableHead>{t('catalog.supplierCode')}</TableHead>
                <TableHead>{t('catalog.moq')}</TableHead>
                <TableHead>{t('catalog.leadTime')}</TableHead>
                <TableHead>{t('catalog.notes')}</TableHead>
                {canEdit && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.supplier_name}</TableCell>
                  <TableCell>{supplier.supplier_code || '-'}</TableCell>
                  <TableCell>{supplier.moq || '-'}</TableCell>
                  <TableCell>
                    {supplier.lead_time_days 
                      ? `${supplier.lead_time_days} ${t('catalog.days')}`
                      : '-'
                    }
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {supplier.supplier_notes || '-'}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(supplier)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(supplier.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? t('catalog.editSupplier') : t('catalog.addSupplier')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_name">{t('catalog.supplierName')} *</Label>
              <Input
                id="supplier_name"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder="Supplier name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_code">{t('catalog.supplierCode')}</Label>
              <Input
                id="supplier_code"
                value={formData.supplier_code}
                onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })}
                placeholder="Supplier's code for this item"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="moq">{t('catalog.moq')}</Label>
                <Input
                  id="moq"
                  type="number"
                  value={formData.moq}
                  onChange={(e) => setFormData({ ...formData, moq: e.target.value })}
                  placeholder="Minimum order"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead_time_days">{t('catalog.leadTimeDays')}</Label>
                <Input
                  id="lead_time_days"
                  type="number"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                  placeholder="Days"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_notes">{t('catalog.notes')}</Label>
              <Textarea
                id="supplier_notes"
                value={formData.supplier_notes}
                onChange={(e) => setFormData({ ...formData, supplier_notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!formData.supplier_name}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CatalogSuppliersTab;
