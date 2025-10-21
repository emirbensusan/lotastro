import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Plus, Trash2 } from 'lucide-react';

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
  suppliers: {
    id: string;
    name: string;
  };
}

interface ReceiveStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incomingStock: IncomingStockWithSupplier | null;
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

export const ReceiveStockDialog: React.FC<ReceiveStockDialogProps> = ({
  open,
  onOpenChange,
  incomingStock,
  onSuccess
}) => {
  const [lots, setLots] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const remainingMeters = incomingStock
    ? incomingStock.expected_meters - incomingStock.received_meters
    : 0;

  useEffect(() => {
    if (open && incomingStock) {
      setLots([{
        id: crypto.randomUUID(),
        lot_number: `${incomingStock.quality}-${incomingStock.color}-${Date.now()}`,
        roll_count: 1,
        roll_meters: '',
        warehouse_location: '',
        notes: ''
      }]);
    }
  }, [open, incomingStock]);

  const addLotRow = () => {
    setLots([...lots, {
      id: crypto.randomUUID(),
      lot_number: `${incomingStock?.quality}-${incomingStock?.color}-${Date.now()}-${lots.length + 1}`,
      roll_count: 1,
      roll_meters: '',
      warehouse_location: '',
      notes: ''
    }]);
  };

  const removeLotRow = (id: string) => {
    if (lots.length > 1) {
      setLots(lots.filter(lot => lot.id !== id));
    }
  };

  const updateLot = (id: string, field: keyof LotRow, value: string | number) => {
    setLots(lots.map(lot => lot.id === id ? { ...lot, [field]: value } : lot));
  };

  const calculateTotalMeters = () => {
    return lots.reduce((sum, lot) => {
      const rollMeters = parseFloat(lot.roll_meters) || 0;
      const rollCount = parseInt(lot.roll_count.toString()) || 0;
      return sum + (rollMeters * rollCount);
    }, 0);
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomingStock) return;

    setLoading(true);

    try {
      // Validation
      if (lots.length === 0) {
        throw new Error('Please add at least one lot');
      }

      const totalMeters = calculateTotalMeters();
      if (totalMeters <= 0) {
        throw new Error('Total meters must be greater than 0');
      }

      if (totalMeters > remainingMeters) {
        throw new Error(`Total meters (${totalMeters}m) exceeds remaining ${remainingMeters}m`);
      }

      for (const lot of lots) {
        if (!lot.lot_number.trim()) {
          throw new Error('All lots must have a lot number');
        }
        if (!lot.roll_meters || parseFloat(lot.roll_meters) <= 0) {
          throw new Error('All lots must have valid roll meters');
        }
        if (!lot.roll_count || lot.roll_count <= 0) {
          throw new Error('All lots must have at least 1 roll');
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Step 1: Create goods_in_receipt entry
      const { data: receipt, error: receiptError } = await supabase
        .from('goods_in_receipts')
        .insert({
          incoming_stock_id: incomingStock.id,
          received_by: user.id,
          received_at: new Date().toISOString(),
          defect_notes: lots.map(l => l.notes).filter(Boolean).join('; ') || null
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Step 2: Create lots
      const lotsToCreate = lots.map(lot => {
        const rollMeters = parseFloat(lot.roll_meters);
        const rollCount = parseInt(lot.roll_count.toString());
        const totalLotMeters = rollMeters * rollCount;

        return {
          quality: incomingStock.quality,
          color: incomingStock.color,
          roll_count: rollCount,
          meters: totalLotMeters,
          lot_number: lot.lot_number,
          entry_date: new Date().toISOString().split('T')[0],
          supplier_id: incomingStock.supplier_id,
          invoice_number: incomingStock.invoice_number,
          invoice_date: incomingStock.invoice_date,
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
      if (!createdLots || createdLots.length === 0) throw new Error('Failed to create lots');

      // Step 3: Create goods_in_rows for each lot
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
        throw new Error('Failed to create goods_in_rows: ' + rowsError.message);
      }

      // Step 4: Create roll entries for each lot
      const rollsToCreate: any[] = [];
      createdLots.forEach((lot, lotIndex) => {
        const rollMeters = parseFloat(lots[lotIndex].roll_meters);
        const rollCount = parseInt(lots[lotIndex].roll_count.toString());
        
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
        throw new Error('Failed to create rolls: ' + rollsError.message);
      }

      // Step 5: Update incoming stock with status
      const newReceivedMeters = incomingStock.received_meters + totalMeters;
      let newStatus = 'pending_inbound';
      
      if (newReceivedMeters >= incomingStock.expected_meters) {
        newStatus = 'fully_received';
      } else if (newReceivedMeters > 0) {
        newStatus = 'partially_received';
      }
      
      const { error: updateError } = await supabase
        .from('incoming_stock')
        .update({
          received_meters: newReceivedMeters,
          status: newStatus
        })
        .eq('id', incomingStock.id);

      if (updateError) throw updateError;

      // Step 6: Log audit action for EACH lot created
      for (const lot of createdLots) {
        await logAction(
          'CREATE',
          'lot',
          lot.id,
          `Received ${lot.meters}m from incoming stock ${incomingStock.invoice_number}`,
          null,
          {
            lot: lot,
            incoming_stock_id: incomingStock.id,
            receipt_id: receipt.id
          },
          `Created lot ${lot.lot_number} with ${lot.roll_count} roll(s) via goods receipt`
        );
      }

      toast({
        title: 'Success',
        description: `Received ${totalMeters.toFixed(2)}m and created ${lots.length} lot(s) with ${rollsToCreate.length} roll(s)`
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Receive error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const totalMeters = calculateTotalMeters();

  if (!incomingStock) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Receive Stock</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleReceive} className="space-y-4">
          {/* Summary Info */}
          <div className="rounded-lg border p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Quality</p>
                <p className="font-medium">{incomingStock.quality}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Color</p>
                <p className="font-medium">{incomingStock.color}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supplier</p>
                <p className="font-medium">{incomingStock.suppliers.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Invoice</p>
                <p className="font-medium">{incomingStock.invoice_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expected</p>
                <p className="font-medium">{incomingStock.expected_meters}m</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Already Received</p>
                <p className="font-medium">{incomingStock.received_meters}m</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="font-medium text-primary">{remainingMeters}m</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total to Receive</p>
                <p className={`font-bold ${totalMeters > remainingMeters ? 'text-destructive' : 'text-green-600'}`}>
                  {totalMeters.toFixed(2)}m
                </p>
              </div>
            </div>
          </div>

          {/* Lot and Roll Entry Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Lot and Roll Details</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLotRow}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lot
              </Button>
            </div>

            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Lot Number</TableHead>
                    <TableHead className="w-[100px]">Roll Count</TableHead>
                    <TableHead className="w-[120px]">Meters/Roll</TableHead>
                    <TableHead className="w-[100px]">Total (m)</TableHead>
                    <TableHead className="w-[150px]">Warehouse Location</TableHead>
                    <TableHead className="w-[200px]">Notes</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => {
                    const rollMeters = parseFloat(lot.roll_meters) || 0;
                    const rollCount = parseInt(lot.roll_count.toString()) || 0;
                    const totalLotMeters = rollMeters * rollCount;

                    return (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <Input
                            value={lot.lot_number}
                            onChange={(e) => updateLot(lot.id, 'lot_number', e.target.value)}
                            placeholder="Lot number"
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={lot.roll_count}
                            onChange={(e) => updateLot(lot.id, 'roll_count', parseInt(e.target.value) || 1)}
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={lot.roll_meters}
                            onChange={(e) => updateLot(lot.id, 'roll_meters', e.target.value)}
                            placeholder="0.00"
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{totalLotMeters.toFixed(2)}</span>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={lot.warehouse_location}
                            onChange={(e) => updateLot(lot.id, 'warehouse_location', e.target.value)}
                            placeholder="e.g., A1-B2"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={lot.notes}
                            onChange={(e) => updateLot(lot.id, 'notes', e.target.value)}
                            placeholder="Notes..."
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLotRow(lot.id)}
                            disabled={lots.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {totalMeters > remainingMeters && (
              <p className="text-sm text-destructive">
                Total meters ({totalMeters.toFixed(2)}m) exceeds remaining ({remainingMeters}m)
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || totalMeters > remainingMeters}>
              {loading ? 'Receiving...' : `Receive ${totalMeters.toFixed(2)}m`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};