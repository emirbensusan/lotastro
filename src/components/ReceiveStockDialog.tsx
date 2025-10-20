import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

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

export const ReceiveStockDialog: React.FC<ReceiveStockDialogProps> = ({
  open,
  onOpenChange,
  incomingStock,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    meters_received: '',
    lot_count: 1,
    warehouse_location: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const remainingMeters = incomingStock
    ? incomingStock.expected_meters - incomingStock.received_meters
    : 0;

  useEffect(() => {
    if (open && incomingStock) {
      setFormData({
        meters_received: remainingMeters.toString(),
        lot_count: 1,
        warehouse_location: '',
        notes: ''
      });
    }
  }, [open, incomingStock, remainingMeters]);

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomingStock) return;

    setLoading(true);

    try {
      const metersReceived = parseFloat(formData.meters_received);
      const lotCount = parseInt(formData.lot_count.toString());

      // Validate
      if (isNaN(metersReceived) || metersReceived <= 0) {
        throw new Error('Please enter a valid number for meters received');
      }

      if (metersReceived > remainingMeters) {
        throw new Error(`Cannot receive more than remaining ${remainingMeters}m`);
      }

      if (isNaN(lotCount) || lotCount <= 0) {
        throw new Error('Lot count must be at least 1');
      }

      // Calculate meters per lot
      const metersPerLot = metersReceived / lotCount;

      // Generate lot numbers
      const baseLotNumber = `${incomingStock.quality}-${incomingStock.color}-${Date.now()}`;

      // Create lots
      const lotsToCreate = [];
      for (let i = 0; i < lotCount; i++) {
        const lotNumber = lotCount > 1 ? `${baseLotNumber}-${i + 1}` : baseLotNumber;

        lotsToCreate.push({
          quality: incomingStock.quality,
          color: incomingStock.color,
          roll_count: 1,
          meters: metersPerLot,
          lot_number: lotNumber,
          entry_date: new Date().toISOString().split('T')[0],
          supplier_id: incomingStock.supplier_id,
          invoice_number: incomingStock.invoice_number,
          invoice_date: incomingStock.invoice_date,
          warehouse_location: formData.warehouse_location || null,
          notes: formData.notes || null,
          qr_code_url: `${window.location.origin}/qr/${lotNumber}`,
          status: 'in_stock'
        });
      }

      // Insert lots
      const { data: createdLots, error: lotsError } = await supabase
        .from('lots')
        .insert(lotsToCreate)
        .select();

      if (lotsError) throw lotsError;

      // Create roll entries for each lot
      const rollsToCreate = createdLots.map(lot => ({
        lot_id: lot.id,
        meters: lot.meters,
        position: 1,
        status: 'available'
      }));

      const { error: rollsError } = await supabase
        .from('rolls')
        .insert(rollsToCreate);

      if (rollsError) {
        console.error('Error creating rolls:', rollsError);
      }

      // Update incoming stock
      const newReceivedMeters = incomingStock.received_meters + metersReceived;
      const { error: updateError } = await supabase
        .from('incoming_stock')
        .update({
          received_meters: newReceivedMeters
        })
        .eq('id', incomingStock.id);

      if (updateError) throw updateError;

      // Log action
      await logAction(
        'CREATE',
        'lot',
        createdLots[0].id,
        `Received ${metersReceived}m from incoming stock ${incomingStock.invoice_number}`,
        null,
        { lots: createdLots, incoming_stock_id: incomingStock.id },
        `Received ${metersReceived}m in ${lotCount} lot(s)`
      );

      toast({
        title: 'Success',
        description: `Received ${metersReceived}m and created ${lotCount} lot(s)`
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

  if (!incomingStock) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive Incoming Stock</DialogTitle>
        </DialogHeader>

        {/* Display incoming stock details */}
        <div className="space-y-2 p-4 bg-muted rounded-lg">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Invoice:</span>
            <span className="text-sm font-medium">{incomingStock.invoice_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Supplier:</span>
            <span className="text-sm font-medium">{incomingStock.suppliers.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Quality:</span>
            <span className="text-sm font-medium">{incomingStock.quality}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Color:</span>
            <span className="text-sm font-medium">{incomingStock.color}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Expected:</span>
            <span className="text-sm font-medium">{incomingStock.expected_meters}m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Already Received:</span>
            <span className="text-sm font-medium">{incomingStock.received_meters}m</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-sm font-semibold">Remaining:</span>
            <span className="text-sm font-bold text-primary">{remainingMeters}m</span>
          </div>
        </div>

        <form onSubmit={handleReceive} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meters_received">Meters Received *</Label>
            <Input
              id="meters_received"
              type="number"
              step="0.01"
              min="0"
              max={remainingMeters}
              value={formData.meters_received}
              onChange={(e) => setFormData(prev => ({ ...prev, meters_received: e.target.value }))}
              placeholder={`Max: ${remainingMeters}`}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lot_count">Split into Lots</Label>
            <Input
              id="lot_count"
              type="number"
              min="1"
              value={formData.lot_count}
              onChange={(e) => setFormData(prev => ({ ...prev, lot_count: parseInt(e.target.value) || 1 }))}
            />
            <p className="text-xs text-muted-foreground">
              Each lot will have approximately {
                formData.meters_received
                  ? (parseFloat(formData.meters_received) / formData.lot_count).toFixed(2)
                  : '0'
              }m
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="warehouse_location">Warehouse Location</Label>
            <Input
              id="warehouse_location"
              value={formData.warehouse_location}
              onChange={(e) => setFormData(prev => ({ ...prev, warehouse_location: e.target.value }))}
              placeholder="e.g., A1-B2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Defects, damages, or other notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Receiving...' : 'Receive Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
