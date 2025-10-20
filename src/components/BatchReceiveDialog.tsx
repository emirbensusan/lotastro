import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IncomingStockWithSupplier {
  id: string;
  quality: string;
  color: string;
  expected_meters: number;
  received_meters: number;
  reserved_meters: number;
  supplier_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  expected_arrival_date: string | null;
  status: string;
  notes: string | null;
  suppliers: {
    id: string;
    name: string;
  };
}

interface BatchReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStock: IncomingStockWithSupplier[];
  onSuccess: () => void;
}

interface ReceiptFormData {
  meters_received: string;
  lot_count: number;
  warehouse_location: string;
  notes: string;
}

export default function BatchReceiveDialog({
  open,
  onOpenChange,
  selectedStock,
  onSuccess
}: BatchReceiveDialogProps) {
  const [receiptData, setReceiptData] = useState<Map<string, ReceiptFormData>>(new Map());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  useEffect(() => {
    if (open && selectedStock.length > 0) {
      const initialData = new Map<string, ReceiptFormData>();
      selectedStock.forEach(item => {
        initialData.set(item.id, {
          meters_received: (item.expected_meters - item.received_meters).toFixed(2),
          lot_count: 1,
          warehouse_location: '',
          notes: ''
        });
      });
      setReceiptData(initialData);
    }
  }, [open, selectedStock]);

  const updateReceiptData = (id: string, field: keyof ReceiptFormData, value: string | number) => {
    const newData = new Map(receiptData);
    const current = newData.get(id);
    if (current) {
      newData.set(id, { ...current, [field]: value });
      setReceiptData(newData);
    }
  };

  const processReceipt = async (
    item: IncomingStockWithSupplier, 
    data: ReceiptFormData, 
    userId: string
  ) => {
    const metersReceived = parseFloat(data.meters_received);
    const lotCount = parseInt(data.lot_count.toString());

    if (isNaN(metersReceived) || metersReceived <= 0) {
      throw new Error(`Invalid meters for ${item.invoice_number || item.quality}`);
    }

    const remainingMeters = item.expected_meters - item.received_meters;
    if (metersReceived > remainingMeters) {
      throw new Error(`Cannot receive more than ${remainingMeters}m for ${item.invoice_number || item.quality}`);
    }

    // Create goods_in_receipt entry
    const { data: receipt, error: receiptError } = await supabase
      .from('goods_in_receipts')
      .insert({
        incoming_stock_id: item.id,
        received_by: userId,
        received_at: new Date().toISOString(),
        defect_notes: data.notes || null
      })
      .select()
      .single();

    if (receiptError) throw receiptError;

    // Calculate meters per lot
    const metersPerLot = metersReceived / lotCount;

    // Generate lot numbers
    const baseLotNumber = `${item.quality}-${item.color}-${Date.now()}`;
    
    // Create lots
    const lotsToCreate = [];
    for (let i = 0; i < lotCount; i++) {
      const lotNumber = lotCount > 1 ? `${baseLotNumber}-${i + 1}` : baseLotNumber;
      
      lotsToCreate.push({
        quality: item.quality,
        color: item.color,
        roll_count: 1,
        meters: metersPerLot,
        lot_number: lotNumber,
        entry_date: new Date().toISOString().split('T')[0],
        supplier_id: item.supplier_id,
        invoice_number: item.invoice_number,
        invoice_date: item.invoice_date,
        warehouse_location: data.warehouse_location || null,
        notes: data.notes || null,
        qr_code_url: `${window.location.origin}/qr/${lotNumber}`,
        status: 'in_stock'
      });
    }

    const { data: createdLots, error: lotsError } = await supabase
      .from('lots')
      .insert(lotsToCreate)
      .select();

    if (lotsError) throw lotsError;

    // Create goods_in_rows
    const rowsToCreate = createdLots.map(lot => ({
      receipt_id: receipt.id,
      lot_id: lot.id,
      quality: lot.quality,
      color: lot.color,
      meters: lot.meters
    }));

    await supabase.from('goods_in_rows').insert(rowsToCreate);

    // Create roll entries
    const rollsToCreate = createdLots.map(lot => ({
      lot_id: lot.id,
      meters: lot.meters,
      position: 1,
      status: 'available'
    }));

    await supabase.from('rolls').insert(rollsToCreate);

    // Update incoming stock
    const newReceivedMeters = item.received_meters + metersReceived;
    await supabase
      .from('incoming_stock')
      .update({ received_meters: newReceivedMeters })
      .eq('id', item.id);

    // Log audit action
    await logAction(
      'CREATE',
      'lot',
      createdLots[0].id,
      `Batch received ${metersReceived}m from ${item.invoice_number || item.quality}`,
      null,
      { 
        lots: createdLots, 
        incoming_stock_id: item.id,
        receipt_id: receipt.id 
      },
      `Batch received ${metersReceived}m in ${lotCount} lot(s)`
    );
  };

  const handleBatchReceive = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      // Process each selected item
      for (const item of selectedStock) {
        const data = receiptData.get(item.id);
        if (!data) continue;

        try {
          await processReceipt(item, data, user.id);
          successCount++;
        } catch (error: any) {
          failureCount++;
          errors.push(`${item.invoice_number || item.quality}: ${error.message}`);
          console.error(`Error processing ${item.id}:`, error);
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Batch Receipt Complete',
          description: `Successfully received ${successCount} shipment(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
          variant: successCount === selectedStock.length ? 'default' : 'destructive'
        });
      }

      if (errors.length > 0) {
        console.error('Batch receipt errors:', errors);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Batch receive error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Batch Receive ({selectedStock.length} items)</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4">
            {selectedStock.map(item => {
              const data = receiptData.get(item.id);
              if (!data) return null;

              return (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {item.invoice_number || 'No Invoice'} - {item.quality} {item.color}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Supplier: {item.suppliers.name}
                    </p>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Meters to Receive *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={data.meters_received}
                        onChange={(e) => updateReceiptData(item.id, 'meters_received', e.target.value)}
                        placeholder="Meters"
                      />
                      <p className="text-xs text-muted-foreground">
                        Remaining: {(item.expected_meters - item.received_meters).toFixed(2)}m
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Lot Count *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={data.lot_count}
                        onChange={(e) => updateReceiptData(item.id, 'lot_count', parseInt(e.target.value) || 1)}
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Warehouse Location</Label>
                      <Input
                        value={data.warehouse_location}
                        onChange={(e) => updateReceiptData(item.id, 'warehouse_location', e.target.value)}
                        placeholder="e.g., A1-B2"
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Notes / Defects</Label>
                      <Input
                        value={data.notes}
                        onChange={(e) => updateReceiptData(item.id, 'notes', e.target.value)}
                        placeholder="Any defects or notes"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleBatchReceive} disabled={loading}>
            {loading ? 'Receiving...' : `Receive All (${selectedStock.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
