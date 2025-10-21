import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Truck, X, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

interface Reservation {
  id: string;
  reservation_number: string;
  customer_name: string;
  customer_id: string | null;
  reserved_date: string;
  hold_until: string | null;
  status: 'active' | 'released' | 'converted' | 'canceled';
  notes: string | null;
  created_at: string;
  canceled_at: string | null;
  canceled_by: string | null;
  cancel_reason: string | null;
  converted_at: string | null;
  converted_by: string | null;
  reservation_lines: Array<{
    id: string;
    scope: 'INVENTORY' | 'INCOMING';
    quality: string;
    color: string;
    reserved_meters: number;
    roll_ids: string | null;
    lot_id: string | null;
    incoming_stock_id: string | null;
    lot?: {
      lot_number: string;
      warehouse_location: string | null;
    };
    incoming_stock?: {
      invoice_number: string | null;
      suppliers: {
        name: string;
      };
    };
  }>;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface ReservationDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onCancel?: (reservation: Reservation) => void;
  onConvert?: (reservation: Reservation) => void;
  onRelease?: (reservation: Reservation) => void;
}

export default function ReservationDetailsDialog({
  open,
  onOpenChange,
  reservation,
  onCancel,
  onConvert,
  onRelease
}: ReservationDetailsDialogProps) {
  const { t } = useLanguage();
  
  if (!reservation) return null;

  const totalMeters = reservation.reservation_lines.reduce(
    (sum, line) => sum + line.reserved_meters,
    0
  );

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'converted':
        return 'secondary';
      case 'canceled':
        return 'destructive';
      case 'released':
        return 'outline';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-mono">
                {reservation.reservation_number}
              </DialogTitle>
              <DialogDescription className="mt-2">
                {String(t('customer'))}: {reservation.customer_name}
                {reservation.customer_id && ` (${String(t('customerId'))}: ${reservation.customer_id})`}
              </DialogDescription>
            </div>
            <Badge variant={getStatusVariant(reservation.status)}>
              {reservation.status.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[65vh]">
          <div className="space-y-6 pr-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{String(t('totalReserved'))}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalMeters.toFixed(2)}m</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{String(t('lineItems'))}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {reservation.reservation_lines.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{String(t('reservedDate'))}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-base font-medium">
                    {formatDate(reservation.reserved_date)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{String(t('reservationDetails'))}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{String(t('createdBy'))}:</span>
                  <span className="font-medium">
                    {reservation.profiles?.full_name || reservation.profiles?.email || '—'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">{String(t('createdAt'))}:</span>
                  <span className="font-medium">
                    {formatDateTime(reservation.created_at)}
                  </span>
                </div>

                {reservation.hold_until && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{String(t('holdUntil'))}:</span>
                    <span className="font-medium">
                      {formatDate(reservation.hold_until)}
                    </span>
                  </div>
                )}

                {reservation.notes && (
                  <div className="mt-4">
                    <Label>{String(t('notes'))}:</Label>
                    <p className="mt-1 text-muted-foreground">{reservation.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{String(t('reservedItems'))}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{String(t('type'))}</TableHead>
                      <TableHead>{String(t('quality'))}</TableHead>
                      <TableHead>{String(t('color'))}</TableHead>
                      <TableHead>{String(t('meters'))}</TableHead>
                      <TableHead>{String(t('source'))}</TableHead>
                      <TableHead>{String(t('location'))}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservation.reservation_lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Badge variant={line.scope === 'INVENTORY' ? 'default' : 'secondary'}>
                            {line.scope}
                          </Badge>
                        </TableCell>
                        <TableCell>{line.quality}</TableCell>
                        <TableCell>{line.color}</TableCell>
                        <TableCell>{line.reserved_meters.toFixed(2)}m</TableCell>
                        <TableCell className="text-xs">
                          {line.scope === 'INVENTORY'
                            ? line.lot?.lot_number
                            : line.incoming_stock?.invoice_number}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {line.scope === 'INVENTORY'
                            ? (line.lot?.warehouse_location || '—')
                            : (line.incoming_stock?.suppliers?.name || '—')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Action History */}
            {reservation.status !== 'active' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{String(t('statusHistory'))}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {reservation.canceled_at && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{String(t('canceledOn'))}:</span>
                        <span>{formatDateTime(reservation.canceled_at)}</span>
                      </div>
                      {reservation.cancel_reason && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{String(t('cancelReason'))}:</span>
                          <span>{reservation.cancel_reason}</span>
                        </div>
                      )}
                    </>
                  )}

                  {reservation.converted_at && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{String(t('convertedOn'))}:</span>
                        <span>{formatDateTime(reservation.converted_at)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-between pt-4 border-t">
          <div className="flex gap-2">
            {reservation.status === 'active' && (
              <>
                <Button
                  variant="default"
                  onClick={() => onConvert?.(reservation)}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  {String(t('convertToOrder'))}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => onRelease?.(reservation)}
                >
                  {String(t('releaseStock'))}
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => onCancel?.(reservation)}
                >
                  <X className="h-4 w-4 mr-2" />
                  {String(t('cancel'))}
                </Button>
              </>
            )}
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {String(t('closeDialog'))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
