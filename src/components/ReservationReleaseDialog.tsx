import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { Info } from 'lucide-react';

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

      toast.success('Reservation released successfully');
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
          <DialogTitle>Release Reservation</DialogTitle>
          <DialogDescription>
            Release reservation {reservation.reservation_number} for {reservation.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3 flex gap-2">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold">This will release reserved stock back to available inventory</p>
              <p className="mt-1">{totalMeters.toFixed(2)}m will become available again</p>
              <p className="mt-2 text-xs">
                The reservation will remain in the system with status "Released" for record keeping.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRelease} disabled={loading}>
            {loading ? 'Releasing...' : 'Release Reservation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
