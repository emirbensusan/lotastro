import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ManufacturingOrder {
  id: string;
  mo_number: string;
  supplier_id: string;
  quality: string;
  color: string;
  ordered_amount: number;
  order_date: string;
  expected_completion_date: string | null;
  supplier_confirmation_number: string | null;
  price_per_meter: number | null;
  currency: string | null;
  notes: string | null;
  is_customer_order: boolean;
  customer_name: string | null;
  customer_agreed_date: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: ManufacturingOrder | null;
  suppliers: { id: string; name: string }[];
  onSuccess: () => void;
}

const MO_STATUSES = ['ORDERED', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'CANCELLED'];
const CURRENCIES = ['EUR', 'USD', 'TRY', 'GBP'];

const ManufacturingOrderDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  editingOrder,
  suppliers,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    supplier_id: '',
    quality: '',
    color: '',
    ordered_meters: '',
    expected_completion_date: '',
    supplier_confirmation_number: '',
    price_per_meter: '',
    currency: 'EUR',
    notes: '',
    is_customer_order: false,
    customer_name: '',
    customer_agreed_date: '',
    status: 'ORDERED',
  });

  useEffect(() => {
    if (editingOrder) {
      setFormData({
        supplier_id: editingOrder.supplier_id,
        quality: editingOrder.quality,
        color: editingOrder.color,
        ordered_meters: editingOrder.ordered_amount.toString(),
        expected_completion_date: editingOrder.expected_completion_date || '',
        supplier_confirmation_number: editingOrder.supplier_confirmation_number || '',
        price_per_meter: editingOrder.price_per_meter?.toString() || '',
        currency: editingOrder.currency || 'EUR',
        notes: editingOrder.notes || '',
        is_customer_order: editingOrder.is_customer_order || false,
        customer_name: editingOrder.customer_name || '',
        customer_agreed_date: editingOrder.customer_agreed_date || '',
        status: editingOrder.status,
      });
    } else {
      setFormData({
        supplier_id: '',
        quality: '',
        color: '',
        ordered_meters: '',
        expected_completion_date: '',
        supplier_confirmation_number: '',
        price_per_meter: '',
        currency: 'EUR',
        notes: '',
        is_customer_order: false,
        customer_name: '',
        customer_agreed_date: '',
        status: 'ORDERED',
      });
    }
  }, [editingOrder, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier_id || !formData.quality || !formData.color || !formData.ordered_meters) {
      toast({
        title: t('error') as string,
        description: t('mo.fillRequiredFields') as string,
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        supplier_id: formData.supplier_id,
        quality: formData.quality.toUpperCase(),
        color: formData.color.toUpperCase(),
        ordered_amount: parseFloat(formData.ordered_meters),
        expected_completion_date: formData.expected_completion_date || null,
        supplier_confirmation_number: formData.supplier_confirmation_number || null,
        price_per_meter: formData.price_per_meter ? parseFloat(formData.price_per_meter) : null,
        currency: formData.currency,
        notes: formData.notes || null,
        is_customer_order: formData.is_customer_order,
        customer_name: formData.is_customer_order ? formData.customer_name : null,
        customer_agreed_date: formData.is_customer_order && formData.customer_agreed_date ? formData.customer_agreed_date : null,
        status: formData.status,
        updated_by: user?.id,
      };

      if (editingOrder) {
        // Check if status changed to SHIPPED
        if (editingOrder.status !== 'SHIPPED' && formData.status === 'SHIPPED') {
          // Create incoming stock entry
          const { data: incomingStock, error: incomingError } = await supabase
            .from('incoming_stock')
            .insert({
              supplier_id: formData.supplier_id,
              quality: formData.quality.toUpperCase(),
              color: formData.color.toUpperCase(),
              expected_meters: parseFloat(formData.ordered_meters),
              status: 'pending_inbound',
              created_by: user?.id,
              notes: `Auto-created from MO ${editingOrder.mo_number}`,
            })
            .select()
            .single();

          if (incomingError) throw incomingError;

          // Update MO with incoming_stock_id
          const { error } = await supabase
            .from('manufacturing_orders')
            .update({ ...payload, incoming_stock_id: incomingStock.id })
            .eq('id', editingOrder.id);

          if (error) throw error;

          toast({
            title: t('success') as string,
            description: t('mo.shippedAndIncomingCreated') as string,
          });
        } else {
          const { error } = await supabase
            .from('manufacturing_orders')
            .update(payload)
            .eq('id', editingOrder.id);

          if (error) throw error;

          toast({
            title: t('success') as string,
            description: t('mo.updateSuccess') as string,
          });
        }
      } else {
        const { error } = await supabase
          .from('manufacturing_orders')
          .insert({
            ...payload,
            created_by: user?.id,
          });

        if (error) throw error;

        toast({
          title: t('success') as string,
          description: t('mo.createSuccess') as string,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving manufacturing order:', error);
      toast({
        title: t('error') as string,
        description: error.message || t('mo.saveError') as string,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingOrder ? t('mo.editOrder') : t('mo.createNew')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Supplier */}
            <div className="space-y-2">
              <Label htmlFor="supplier">{t('supplier')} *</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('mo.selectSupplier')} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status (only for edit) */}
            {editingOrder && (
              <div className="space-y-2">
                <Label htmlFor="status">{t('status')} *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MO_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`mo.status.${status.toLowerCase()}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quality */}
            <div className="space-y-2">
              <Label htmlFor="quality">{t('quality')} *</Label>
              <Input
                id="quality"
                value={formData.quality}
                onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
                placeholder="e.g., V710"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label htmlFor="color">{t('color')} *</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g., RED"
              />
            </div>

            {/* Ordered Meters */}
            <div className="space-y-2">
              <Label htmlFor="ordered_meters">{t('mo.orderedMeters')} *</Label>
              <Input
                id="ordered_meters"
                type="number"
                min="1"
                value={formData.ordered_meters}
                onChange={(e) => setFormData({ ...formData, ordered_meters: e.target.value })}
                placeholder="e.g., 1000"
              />
            </div>

            {/* Expected Completion Date */}
            <div className="space-y-2">
              <Label htmlFor="expected_completion_date">{t('mo.eta')}</Label>
              <Input
                id="expected_completion_date"
                type="date"
                value={formData.expected_completion_date}
                onChange={(e) => setFormData({ ...formData, expected_completion_date: e.target.value })}
              />
            </div>

            {/* Supplier Confirmation Number */}
            <div className="space-y-2">
              <Label htmlFor="supplier_confirmation_number">{t('mo.supplierConfirmation')}</Label>
              <Input
                id="supplier_confirmation_number"
                value={formData.supplier_confirmation_number}
                onChange={(e) => setFormData({ ...formData, supplier_confirmation_number: e.target.value })}
                placeholder={t('mo.supplierConfirmationPlaceholder') as string}
              />
            </div>

            {/* Price per Meter */}
            <div className="space-y-2">
              <Label htmlFor="price_per_meter">{t('mo.pricePerMeter')}</Label>
              <div className="flex gap-2">
                <Input
                  id="price_per_meter"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_meter}
                  onChange={(e) => setFormData({ ...formData, price_per_meter: e.target.value })}
                  placeholder="0.00"
                  className="flex-1"
                />
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Customer Order Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="is_customer_order" className="text-base">{t('mo.isCustomerOrder')}</Label>
              <p className="text-sm text-muted-foreground">{t('mo.isCustomerOrderDesc')}</p>
            </div>
            <Switch
              id="is_customer_order"
              checked={formData.is_customer_order}
              onCheckedChange={(checked) => setFormData({ ...formData, is_customer_order: checked })}
            />
          </div>

          {/* Customer Fields (conditional) */}
          {formData.is_customer_order && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="customer_name">{t('customer')}</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder={t('mo.customerNamePlaceholder') as string}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_agreed_date">{t('mo.agreedDate')}</Label>
                <Input
                  id="customer_agreed_date"
                  type="date"
                  value={formData.customer_agreed_date}
                  onChange={(e) => setFormData({ ...formData, customer_agreed_date: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={t('mo.notesPlaceholder') as string}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingOrder ? t('update') : t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManufacturingOrderDialog;