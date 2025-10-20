import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface Reservation {
  id: string;
  reservation_number: string;
  customer_name: string;
  reservation_lines: Array<{
    reserved_meters: number;
  }>;
}

interface ReservationCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onSuccess: () => void;
}

export default function ReservationCancelDialog({
  open,
  onOpenChange,
  reservation,
  onSuccess
}: ReservationCancelDialogProps) {
  const { logAction } = useAuditLog();
  const [loading, setLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState<'customer_canceled' | 'incorrect_entry' | 'no_payment' | 'other' | ''>('');
  const [cancelNotes, setCancelNotes] = useState('');

  if (!reservation) return null;

  const totalMeters = reservation.reservation_lines.reduce((sum, line) => sum + line.reserved_meters, 0);

  const handleCancel = async () => {
    if (!cancelReason) {
      toast.error('Please select a cancellation reason');
      return;
    }

    if (cancelReason === 'other' && !cancelNotes) {
      toast.error('Please provide additional details');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update reservation status (trigger will delete lines and release stock)
      const { error } = await supabase
        .from('reservations')
        .update({
          status: 'canceled',
          canceled_by: user.id,
          canceled_at: new Date().toISOString(),
          cancel_reason: cancelReason as any,
          cancel_other_text: cancelReason === 'other' ? cancelNotes : null
        })
        .eq('id', reservation.id);

      if (error) throw error;

      // Log audit action
      await logAction(
        'STATUS_CHANGE',
        'lot',
        reservation.id,
        reservation.reservation_number,
        { status: 'active' },
        {
          status: 'canceled',
          cancel_reason: cancelReason,
          cancel_notes: cancelNotes
        },
        `Canceled reservation ${reservation.reservation_number}. Reason: ${cancelReason}`
      );

      toast.success('Reservation canceled successfully');
      onSuccess();
      onOpenChange(false);
      setCancelReason('');
      setCancelNotes('');
    } catch (error: any) {
      console.error('Cancel error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Reservation</DialogTitle>
          <DialogDescription>
            Cancel reservation {reservation.reservation_number} for {reservation.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold">This will release all reserved stock</p>
              <p className="mt-1">{totalMeters.toFixed(2)}m will become available again</p>
            </div>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Cancellation Reason *</Label>
            <Select value={cancelReason} onValueChange={(v) => setCancelReason(v as any)}>
              <SelectTrigger id="cancel-reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer_canceled">Customer canceled</SelectItem>
                <SelectItem value="incorrect_entry">Incorrect entry</SelectItem>
                <SelectItem value="no_payment">No payment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="cancel-notes">
              Additional Details {cancelReason === 'other' && '*'}
            </Label>
            <Textarea
              id="cancel-notes"
              value={cancelNotes}
              onChange={(e) => setCancelNotes(e.target.value)}
              placeholder="Enter additional details..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setCancelReason('');
              setCancelNotes('');
            }}
          >
            Keep Reservation
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={loading || !cancelReason}
          >
            {loading ? 'Canceling...' : 'Cancel Reservation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
