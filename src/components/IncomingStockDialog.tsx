import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { CatalogAutocomplete } from '@/components/catalog/CatalogAutocomplete';

interface IncomingStockWithSupplier {
  id: string;
  quality: string;
  color: string;
  expected_meters: number;
  received_meters: number;
  reserved_meters: number;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  expected_arrival_date: string | null;
  notes: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  suppliers: {
    id: string;
    name: string;
  };
}

interface IncomingStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStock: IncomingStockWithSupplier | null;
  onSuccess: () => void;
}

interface FormData {
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  expected_arrival_date: string;
  quality: string;
  color: string;
  expected_meters: string;
  notes: string;
  catalog_item_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

export const IncomingStockDialog: React.FC<IncomingStockDialogProps> = ({
  open,
  onOpenChange,
  editingStock,
  onSuccess
}) => {
  const [formData, setFormData] = useState<FormData>({
    supplier_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    expected_arrival_date: '',
    quality: '',
    color: '',
    expected_meters: '',
    notes: '',
    catalog_item_id: null
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  useEffect(() => {
    if (open) {
      fetchSuppliers();
    }
  }, [open]);

  useEffect(() => {
    if (editingStock && open) {
      setFormData({
        supplier_id: editingStock.supplier_id,
        invoice_number: editingStock.invoice_number,
        invoice_date: editingStock.invoice_date,
        expected_arrival_date: editingStock.expected_arrival_date || '',
        quality: editingStock.quality,
        color: editingStock.color,
        expected_meters: editingStock.expected_meters.toString(),
        notes: editingStock.notes || '',
        catalog_item_id: (editingStock as any).catalog_item_id || null
      });
    } else if (!editingStock && open) {
      setFormData({
        supplier_id: '',
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        expected_arrival_date: '',
        quality: '',
        color: '',
        expected_meters: '',
        notes: '',
        catalog_item_id: null
      });
    }
  }, [editingStock, open]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch suppliers.',
        variant: 'destructive'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate
      if (!formData.supplier_id) throw new Error('Please select a supplier');
      if (!formData.invoice_number.trim()) throw new Error('Invoice number is required');
      if (!formData.quality.trim()) throw new Error('Quality is required');
      if (!formData.color.trim()) throw new Error('Color is required');
      
      const expectedMeters = parseFloat(formData.expected_meters);
      if (isNaN(expectedMeters) || expectedMeters <= 0) {
        throw new Error('Expected meters must be greater than 0');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (editingStock) {
        // Update existing entry
        const { error } = await supabase
          .from('incoming_stock')
          .update({
            supplier_id: formData.supplier_id,
            invoice_number: formData.invoice_number,
            invoice_date: formData.invoice_date,
            expected_arrival_date: formData.expected_arrival_date || null,
            quality: formData.quality,
            color: formData.color,
            expected_meters: expectedMeters,
            notes: formData.notes || null,
            catalog_item_id: formData.catalog_item_id
          })
          .eq('id', editingStock.id);

        if (error) throw error;

        await logAction(
          'UPDATE',
          'incoming_stock' as any,
          editingStock.id,
          formData.invoice_number,
          editingStock,
          { ...formData, expected_meters: expectedMeters },
          'Updated incoming stock entry'
        );

        toast({
          title: 'Success',
          description: 'Incoming stock updated successfully.'
        });
      } else {
        // Create new entry
        const { data, error } = await supabase
          .from('incoming_stock')
          .insert({
            supplier_id: formData.supplier_id,
            invoice_number: formData.invoice_number,
            invoice_date: formData.invoice_date,
            expected_arrival_date: formData.expected_arrival_date || null,
            quality: formData.quality,
            color: formData.color,
            expected_meters: expectedMeters,
            notes: formData.notes || null,
            received_meters: 0,
            reserved_meters: 0,
            status: 'pending_inbound',
            created_by: user.id,
            catalog_item_id: formData.catalog_item_id
          })
          .select()
          .single();

        if (error) throw error;

        await logAction(
          'CREATE',
          'incoming_stock' as any,
          data.id,
          formData.invoice_number,
          null,
          data,
          'Created incoming stock entry'
        );

        toast({
          title: 'Success',
          description: 'Incoming stock created successfully.'
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving incoming stock:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save incoming stock.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingStock ? 'Edit Incoming Stock' : 'New Incoming Stock Entry'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Supplier *</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number *</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                placeholder="INV-2025-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice Date *</Label>
              <Input
                id="invoice_date"
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_arrival_date">Expected Arrival Date</Label>
              <Input
                id="expected_arrival_date"
                type="date"
                value={formData.expected_arrival_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expected_arrival_date: e.target.value }))}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Quality & Color *</Label>
              <CatalogAutocomplete
                value={{
                  quality: formData.quality,
                  color: formData.color,
                  catalog_item_id: formData.catalog_item_id
                }}
                onChange={(val) => setFormData(prev => ({
                  ...prev,
                  quality: val.quality,
                  color: val.color,
                  catalog_item_id: val.catalog_item_id
                }))}
                allowNonCatalog={true}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_meters">Expected Meters *</Label>
            <Input
              id="expected_meters"
              type="number"
              step="0.01"
              min="0"
              value={formData.expected_meters}
              onChange={(e) => setFormData(prev => ({ ...prev, expected_meters: e.target.value }))}
              placeholder="1000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional information about this shipment..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : editingStock ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
