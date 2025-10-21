import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Reservation {
  id: string;
  reservation_number: string;
  customer_name: string;
  reservation_lines: Array<{
    reserved_meters: number;
  }>;
}

interface ReservationReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onSuccess: () => void;
}

export default function ReservationReleaseDialog({
  open,
  onOpenChange,
  reservation,
  onSuccess
}: ReservationReleaseDialogProps) {
  const { logAction } = useAuditLog();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  if (!reservation) return null;

  const totalMeters = reservation.reservation_lines.reduce((sum, line) => sum + line.reserved_meters, 0);

  const handleRelease = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update status (trigger will handle cleanup)
      const { error } = await supabase
        .from('reservations')
        .update({
          status: 'released',
          canceled_by: user.id,
          canceled_at: new Date().toISOString()
        })
        .eq('id', reservation.id);

      if (error) throw error;

      await logAction(
        'STATUS_CHANGE',
        'lot',
        reservation.id,
        reservation.reservation_number,
        { status: 'active' },
        { status: 'released' },
        `Released reservation ${reservation.reservation_number}`
      );

      toast.success(String(t('reservationReleased')));
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Release error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{String(t('releaseReservationTitle'))}</DialogTitle>
          <DialogDescription>
            {String(t('releaseReservationDesc'))
              .replace('{reservationNumber}', reservation.reservation_number)
              .replace('{customerName}', reservation.customer_name)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3 flex gap-2">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold">{String(t('releaseInfo'))}</p>
              <p className="mt-1">{String(t('metersWillBeAvailable')).replace('{meters}', totalMeters.toFixed(2))}</p>
              <p className="mt-2 text-xs">
                {String(t('recordKeepingNote'))}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {String(t('cancel'))}
          </Button>
          <Button onClick={handleRelease} disabled={loading}>
            {loading ? String(t('releasing')) : String(t('releaseButton'))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
