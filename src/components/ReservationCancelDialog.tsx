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
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState<'customer_canceled' | 'incorrect_entry' | 'no_payment' | 'other' | ''>('');
  const [cancelNotes, setCancelNotes] = useState('');

  if (!reservation) return null;

  const totalMeters = reservation.reservation_lines.reduce((sum, line) => sum + line.reserved_meters, 0);

  const handleCancel = async () => {
    if (!cancelReason) {
      toast.error(String(t('selectCancelReason')));
      return;
    }

    if (cancelReason === 'other' && !cancelNotes) {
      toast.error(String(t('provideAdditionalDetails')));
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

      toast.success(String(t('reservationCanceled')));
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
          <DialogTitle>{String(t('cancelReservationTitle'))}</DialogTitle>
          <DialogDescription>
            {String(t('cancelReservationDesc'))
              .replace('{reservationNumber}', reservation.reservation_number)
              .replace('{customerName}', reservation.customer_name)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold">{String(t('thisWillReleaseStock'))}</p>
              <p className="mt-1">{String(t('metersWillBeReleased')).replace('{meters}', totalMeters.toFixed(2))}</p>
            </div>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">{String(t('cancellationReason'))} *</Label>
            <Select value={cancelReason} onValueChange={(v) => setCancelReason(v as any)}>
              <SelectTrigger id="cancel-reason">
                <SelectValue placeholder={String(t('selectReason'))} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer_canceled">{String(t('customerCanceled'))}</SelectItem>
                <SelectItem value="incorrect_entry">{String(t('incorrectEntry'))}</SelectItem>
                <SelectItem value="no_payment">{String(t('noPayment'))}</SelectItem>
                <SelectItem value="other">{String(t('otherReason'))}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="cancel-notes">
              {String(t('additionalDetails'))} {cancelReason === 'other' && '*'}
            </Label>
            <Textarea
              id="cancel-notes"
              value={cancelNotes}
              onChange={(e) => setCancelNotes(e.target.value)}
              placeholder={String(t('explainReason'))}
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
            {String(t('keepReservation'))}
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={loading || !cancelReason}
          >
            {loading ? String(t('canceling')) : String(t('confirmCancel'))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
