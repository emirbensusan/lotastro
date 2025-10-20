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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

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

interface LotRow {
  id: string;
  lot_number: string;
  roll_count: number;
  roll_meters: string;
  warehouse_location: string;
  notes: string;
}

interface StockReceiptData {
  lots: LotRow[];
}

export default function BatchReceiveDialog({
  open,
  onOpenChange,
  selectedStock,
  onSuccess
}: BatchReceiveDialogProps) {
  const [receiptData, setReceiptData] = useState<Map<string, StockReceiptData>>(new Map());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  useEffect(() => {
    if (open && selectedStock.length > 0) {
      const initialData = new Map<string, StockReceiptData>();
      selectedStock.forEach(item => {
        initialData.set(item.id, {
          lots: [{
            id: crypto.randomUUID(),
            lot_number: `${item.quality}-${item.color}-${Date.now()}`,
            roll_count: 1,
            roll_meters: '',
            warehouse_location: '',
            notes: ''
          }]
        });
      });
      setReceiptData(initialData);
    }
  }, [open, selectedStock]);

  const addLotRow = (stockId: string) => {
    const newData = new Map(receiptData);
    const existing = newData.get(stockId);
    if (existing) {
      const stock = selectedStock.find(s => s.id === stockId);
      existing.lots.push({
        id: crypto.randomUUID(),
        lot_number: `${stock?.quality}-${stock?.color}-${Date.now()}-${existing.lots.length + 1}`,
        roll_count: 1,
        roll_meters: '',
        warehouse_location: '',
        notes: ''
      });
      setReceiptData(newData);
    }
  };

  const removeLotRow = (stockId: string, lotId: string) => {
    const newData = new Map(receiptData);
    const existing = newData.get(stockId);
    if (existing && existing.lots.length > 1) {
      existing.lots = existing.lots.filter(lot => lot.id !== lotId);
      setReceiptData(newData);
    }
  };

  const updateLot = (stockId: string, lotId: string, field: keyof LotRow, value: string | number) => {
    const newData = new Map(receiptData);
    const existing = newData.get(stockId);
    if (existing) {
      existing.lots = existing.lots.map(lot =>
        lot.id === lotId ? { ...lot, [field]: value } : lot
      );
      setReceiptData(newData);
    }
  };

  const calculateStockTotal = (stockId: string) => {
    const data = receiptData.get(stockId);
    if (!data) return 0;
    return data.lots.reduce((sum, lot) => {
      const rollMeters = parseFloat(lot.roll_meters) || 0;
      const rollCount = parseInt(lot.roll_count.toString()) || 0;
      return sum + (rollMeters * rollCount);
    }, 0);
  };

  const processReceipt = async (
    item: IncomingStockWithSupplier,
    data: StockReceiptData,
    userId: string
  ) => {
    // Validation
    if (data.lots.length === 0) {
      throw new Error(`${item.invoice_number}: No lots defined`);
    }

    const totalMeters = data.lots.reduce((sum, lot) => {
      const rollMeters = parseFloat(lot.roll_meters) || 0;
      const rollCount = parseInt(lot.roll_count.toString()) || 0;
      return sum + (rollMeters * rollCount);
    }, 0);

    if (totalMeters <= 0) {
      throw new Error(`${item.invoice_number}: Total meters must be greater than 0`);
    }

    const remaining = item.expected_meters - item.received_meters;
    if (totalMeters > remaining) {
      throw new Error(`${item.invoice_number}: Cannot receive ${totalMeters}m, only ${remaining}m remaining`);
    }

    for (const lot of data.lots) {
      if (!lot.lot_number.trim()) {
        throw new Error(`${item.invoice_number}: All lots must have a lot number`);
      }
      if (!lot.roll_meters || parseFloat(lot.roll_meters) <= 0) {
        throw new Error(`${item.invoice_number}: All lots must have valid roll meters`);
      }
      if (!lot.roll_count || lot.roll_count <= 0) {
        throw new Error(`${item.invoice_number}: All lots must have at least 1 roll`);
      }
    }

    // Create goods_in_receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('goods_in_receipts')
      .insert({
        incoming_stock_id: item.id,
        received_by: userId,
        received_at: new Date().toISOString(),
        defect_notes: data.lots.map(l => l.notes).filter(Boolean).join('; ') || null
      })
      .select()
      .single();

    if (receiptError) throw receiptError;

    // Create lots
    const lotsToCreate = data.lots.map(lot => {
      const rollMeters = parseFloat(lot.roll_meters);
      const rollCount = parseInt(lot.roll_count.toString());
      const totalLotMeters = rollMeters * rollCount;

      return {
        quality: item.quality,
        color: item.color,
        roll_count: rollCount,
        meters: totalLotMeters,
        lot_number: lot.lot_number,
        entry_date: new Date().toISOString().split('T')[0],
        supplier_id: item.supplier_id,
        invoice_number: item.invoice_number,
        invoice_date: item.invoice_date,
        warehouse_location: lot.warehouse_location || null,
        notes: lot.notes || null,
        qr_code_url: `${window.location.origin}/qr/${lot.lot_number}`,
        status: 'in_stock' as const
      };
    });

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

    const { error: rowsError } = await supabase
      .from('goods_in_rows')
      .insert(rowsToCreate);

    if (rowsError) {
      console.error('Error creating goods_in_rows:', rowsError);
    }

    // Create rolls
    const rollsToCreate: any[] = [];
    createdLots.forEach((lot, lotIndex) => {
      const rollMeters = parseFloat(data.lots[lotIndex].roll_meters);
      const rollCount = parseInt(data.lots[lotIndex].roll_count.toString());
      
      for (let i = 0; i < rollCount; i++) {
        rollsToCreate.push({
          lot_id: lot.id,
          meters: rollMeters,
          position: i + 1,
          status: 'available'
        });
      }
    });

    const { error: rollsError } = await supabase
      .from('rolls')
      .insert(rollsToCreate);

    if (rollsError) {
      console.error('Error creating rolls:', rollsError);
    }

    // Update incoming stock
    const newReceivedMeters = item.received_meters + totalMeters;
    const { error: updateError } = await supabase
      .from('incoming_stock')
      .update({
        received_meters: newReceivedMeters
      })
      .eq('id', item.id);

    if (updateError) throw updateError;

    // Log audit
    await logAction(
      'CREATE',
      'lot',
      createdLots[0].id,
      `Batch received ${totalMeters}m from ${item.invoice_number}`,
      null,
      {
        lots: createdLots,
        incoming_stock_id: item.id,
        receipt_id: receipt.id
      },
      `Batch received ${totalMeters}m in ${data.lots.length} lot(s) with ${rollsToCreate.length} roll(s)`
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
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Batch Receive ({selectedStock.length} items)</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh]">
          <div className="space-y-6 pr-4">
            {selectedStock.map(item => {
              const data = receiptData.get(item.id);
              const remaining = item.expected_meters - item.received_meters;
              const totalMeters = calculateStockTotal(item.id);

              return (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {item.invoice_number} - {item.quality} {item.color}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Remaining: {remaining}m | Total to receive: <span className={totalMeters > remaining ? 'text-destructive font-bold' : 'text-green-600 font-bold'}>{totalMeters.toFixed(2)}m</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addLotRow(item.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Lot
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Lot Number</TableHead>
                          <TableHead className="w-[80px]">Rolls</TableHead>
                          <TableHead className="w-[100px]">M/Roll</TableHead>
                          <TableHead className="w-[80px]">Total</TableHead>
                          <TableHead className="w-[120px]">Location</TableHead>
                          <TableHead className="w-[150px]">Notes</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.lots.map((lot) => {
                          const rollMeters = parseFloat(lot.roll_meters) || 0;
                          const rollCount = parseInt(lot.roll_count.toString()) || 0;
                          const totalLotMeters = rollMeters * rollCount;

                          return (
                            <TableRow key={lot.id}>
                              <TableCell>
                                <Input
                                  value={lot.lot_number}
                                  onChange={(e) => updateLot(item.id, lot.id, 'lot_number', e.target.value)}
                                  placeholder="Lot number"
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  value={lot.roll_count}
                                  onChange={(e) => updateLot(item.id, lot.id, 'roll_count', parseInt(e.target.value) || 1)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={lot.roll_meters}
                                  onChange={(e) => updateLot(item.id, lot.id, 'roll_meters', e.target.value)}
                                  placeholder="0.00"
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-medium">{totalLotMeters.toFixed(2)}</span>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={lot.warehouse_location}
                                  onChange={(e) => updateLot(item.id, lot.id, 'warehouse_location', e.target.value)}
                                  placeholder="A1-B2"
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={lot.notes}
                                  onChange={(e) => updateLot(item.id, lot.id, 'notes', e.target.value)}
                                  placeholder="Notes"
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLotRow(item.id, lot.id)}
                                  disabled={data.lots.length === 1}
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
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