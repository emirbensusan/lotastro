import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface Reservation {
  id: string;
  reservation_number: string;
  customer_name: string;
  reservation_lines: Array<{
    id: string;
    scope: 'INVENTORY' | 'INCOMING';
    quality: string;
    color: string;
    reserved_meters: number;
    roll_ids: string | null;
    lot_id: string | null;
    lot?: {
      lot_number: string;
    };
  }>;
}

interface ReservationConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onSuccess: () => void;
}

export default function ReservationConvertDialog({
  open,
  onOpenChange,
  reservation,
  onSuccess
}: ReservationConvertDialogProps) {
  const { logAction } = useAuditLog();
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');

  if (!reservation) return null;

  const inventoryLines = reservation.reservation_lines.filter(line => line.scope === 'INVENTORY');
  const incomingLines = reservation.reservation_lines.filter(line => line.scope === 'INCOMING');
  const totalMeters = inventoryLines.reduce((sum, line) => sum + line.reserved_meters, 0);

  const handleConvert = async () => {
    if (inventoryLines.length === 0) {
      toast.error('Cannot convert: reservation contains only incoming stock');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const finalCustomerName = customerName || reservation.customer_name;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: finalCustomerName,
          created_by: user.id
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order_lots for each inventory line
      for (const line of inventoryLines) {
        const rollIds = line.roll_ids?.split(',').filter(id => id.trim()) || [];
        
        // Get roll meters
        let rollMeters = '';
        if (rollIds.length > 0) {
          const { data: rolls } = await supabase
            .from('rolls')
            .select('meters')
            .in('id', rollIds);
          
          if (rolls) {
            rollMeters = rolls.map(r => r.meters.toString()).join(',');
          }
        }

        await supabase
          .from('order_lots')
          .insert({
            order_id: order.id,
            lot_id: line.lot_id!,
            quality: line.quality,
            color: line.color,
            roll_count: rollIds.length,
            line_type: 'standard',
            selected_roll_ids: line.roll_ids,
            selected_roll_meters: rollMeters
          });

        // Mark rolls as allocated
        if (rollIds.length > 0) {
          await supabase
            .from('rolls')
            .update({ status: 'allocated' })
            .in('id', rollIds);
        }
      }

      // Update reservation status
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          status: 'converted',
          converted_by: user.id,
          converted_at: new Date().toISOString()
        })
        .eq('id', reservation.id);

      if (updateError) throw updateError;

      // Log audit actions
      await logAction(
        'CREATE',
        'order',
        order.id,
        order.order_number,
        null,
        order,
        `Created order ${order.order_number} from reservation ${reservation.reservation_number}`
      );

      await logAction(
        'STATUS_CHANGE',
        'lot',
        reservation.id,
        reservation.reservation_number,
        { status: 'active' },
        { status: 'converted', order_id: order.id },
        `Converted reservation ${reservation.reservation_number} to order ${order.order_number}`
      );

      toast.success(`Order ${order.order_number} created from reservation`);
      onSuccess();
      onOpenChange(false);
      setCustomerName('');
    } catch (error: any) {
      console.error('Convert error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Order</DialogTitle>
          <DialogDescription>
            Convert reservation {reservation.reservation_number} into a sales order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning for incoming lines */}
          {incomingLines.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">Note: Incoming lines will not be converted</p>
                <p className="mt-1">
                  {incomingLines.length} incoming line(s) will remain in the reservation
                </p>
              </div>
            </div>
          )}

          {/* Success info */}
          {inventoryLines.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-3 flex gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-semibold">
                  {inventoryLines.length} inventory line(s) will be converted
                </p>
                <p className="mt-1">Total: {totalMeters.toFixed(2)}m</p>
              </div>
            </div>
          )}

          {/* Customer name override */}
          <div className="space-y-2">
            <Label htmlFor="customer-name">Customer Name</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={reservation.customer_name}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use: {reservation.customer_name}
            </p>
          </div>

          {/* Line items preview */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {inventoryLines.map((line, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div>
                      <span className="font-medium">{line.quality} - {line.color}</span>
                      <Badge variant="outline" className="ml-2">INVENTORY</Badge>
                    </div>
                    <span>{line.reserved_meters.toFixed(2)}m</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setCustomerName('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={loading || inventoryLines.length === 0}
          >
            {loading ? 'Converting...' : 'Create Order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
