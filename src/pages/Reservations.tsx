import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from "sonner";
import { Calendar, Plus, Eye, Truck, Trash2 } from 'lucide-react';
import ReservationDialog from '@/components/ReservationDialog';
import ReservationDetailsDialog from '@/components/ReservationDetailsDialog';
import ReservationCancelDialog from '@/components/ReservationCancelDialog';
import ReservationConvertDialog from '@/components/ReservationConvertDialog';
import ReservationReleaseDialog from '@/components/ReservationReleaseDialog';
import ReservationExport from '@/components/ReservationExport';
import { useLanguage } from '@/contexts/LanguageContext';

const Reservations = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Reservation dialogs
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [showReservationDetails, setShowReservationDetails] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<any>(null);
  const [reservationToConvert, setReservationToConvert] = useState<any>(null);
  const [reservationToRelease, setReservationToRelease] = useState<any>(null);

  useEffect(() => {
    fetchReservations();
  }, []);
  
  const fetchReservations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          reservation_lines (
            id, scope, quality, color, reserved_meters, roll_ids, lot_id, incoming_stock_id,
            lot:lots (lot_number, warehouse_location),
            incoming_stock:incoming_stock (invoice_number, suppliers (name))
          ),
          profiles!reservations_created_by_fkey (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReservations(data || []);
    } catch (error: any) {
      toast.error(`Error loading reservations: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Check permissions
  const canCreateReservations = profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'senior_manager';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('reservations')}</h1>
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('reservations')}</h1>
        <Calendar className="h-8 w-8 text-primary" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{t('reservations')}</CardTitle>
              <CardDescription>{t('manageReservationsDesc')}</CardDescription>
            </div>
            <div className="flex gap-2">
              <ReservationExport reservations={reservations} />
              {canCreateReservations && (
                <Button onClick={() => setShowReservationDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('newReservation')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reservationNumber')}</TableHead>
                <TableHead>{t('customer')}</TableHead>
                <TableHead>{t('reservedDate')}</TableHead>
                <TableHead>{t('totalMeters')}</TableHead>
                <TableHead>{t('lineItems')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="font-mono">{res.reservation_number}</TableCell>
                  <TableCell>{res.customer_name}</TableCell>
                  <TableCell>{new Date(res.reserved_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {res.reservation_lines.reduce((sum: number, l: any) => sum + l.reserved_meters, 0).toFixed(2)}m
                  </TableCell>
                  <TableCell>{res.reservation_lines.length}</TableCell>
                  <TableCell>
                    <Badge variant={res.status === 'active' ? 'default' : res.status === 'converted' ? 'secondary' : 'outline'}>
                      {res.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedReservation(res); setShowReservationDetails(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {res.status === 'active' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setReservationToConvert(res)}>
                            <Truck className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setReservationToCancel(res)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reservation Dialogs */}
      <ReservationDialog
        open={showReservationDialog}
        onOpenChange={setShowReservationDialog}
        onSuccess={fetchReservations}
      />

      <ReservationDetailsDialog
        open={showReservationDetails}
        onOpenChange={setShowReservationDetails}
        reservation={selectedReservation}
        onCancel={(res) => { setShowReservationDetails(false); setReservationToCancel(res); }}
        onConvert={(res) => { setShowReservationDetails(false); setReservationToConvert(res); }}
        onRelease={(res) => { setShowReservationDetails(false); setReservationToRelease(res); }}
      />

      <ReservationCancelDialog
        open={!!reservationToCancel}
        onOpenChange={(open) => !open && setReservationToCancel(null)}
        reservation={reservationToCancel}
        onSuccess={fetchReservations}
      />

      <ReservationConvertDialog
        open={!!reservationToConvert}
        onOpenChange={(open) => !open && setReservationToConvert(null)}
        reservation={reservationToConvert}
        onSuccess={fetchReservations}
      />

      <ReservationReleaseDialog
        open={!!reservationToRelease}
        onOpenChange={(open) => !open && setReservationToRelease(null)}
        reservation={reservationToRelease}
        onSuccess={fetchReservations}
      />
    </div>
  );
};

export default Reservations;
