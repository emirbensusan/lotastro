import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from "sonner";
import { Calendar, Plus, Truck, Trash2 } from 'lucide-react';
import ReservationDialog from '@/components/ReservationDialog';
import ReservationDetailsDialog from '@/components/ReservationDetailsDialog';
import ReservationCancelDialog from '@/components/ReservationCancelDialog';
import ReservationConvertDialog from '@/components/ReservationConvertDialog';
import ReservationReleaseDialog from '@/components/ReservationReleaseDialog';
import ReservationExport from '@/components/ReservationExport';
import { useLanguage } from '@/contexts/LanguageContext';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';
import { ViewDetailsButton } from '@/components/ui/view-details-button';

type ReservationStatus = 'active' | 'canceled' | 'converted' | 'released';

const Reservations = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting state
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>({
    key: 'created_at',
    direction: 'desc'
  });

  // Filter state
  const [filters, setFilters] = useState<Record<string, string>>({});
  
  // Reservation dialogs
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [showReservationDetails, setShowReservationDetails] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<any>(null);
  const [reservationToConvert, setReservationToConvert] = useState<any>(null);
  const [reservationToRelease, setReservationToRelease] = useState<any>(null);

  useEffect(() => {
    fetchReservations();
  }, [page, pageSize, currentSort, filters]);
  
  const fetchReservations = async () => {
    try {
      setLoading(true);

      // Get total count first
      let countQuery = supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true });

      if (filters.reservation_number) {
        countQuery = countQuery.ilike('reservation_number', `%${filters.reservation_number}%`);
      }
      if (filters.customer_name) {
        countQuery = countQuery.ilike('customer_name', `%${filters.customer_name}%`);
      }
      if (filters.status) {
        countQuery = countQuery.eq('status', filters.status as ReservationStatus);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Fetch paginated data
      let query = supabase
        .from('reservations')
        .select(`
          *,
          reservation_lines (
            id, scope, quality, color, reserved_meters, roll_ids, lot_id, incoming_stock_id,
            lot:lots (lot_number, warehouse_location),
            incoming_stock:incoming_stock (invoice_number, suppliers (name))
          ),
          profiles!reservations_created_by_fkey (full_name, email)
        `);

      // Apply filters
      if (filters.reservation_number) {
        query = query.ilike('reservation_number', `%${filters.reservation_number}%`);
      }
      if (filters.customer_name) {
        query = query.ilike('customer_name', `%${filters.customer_name}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status as ReservationStatus);
      }

      // Apply sorting
      if (currentSort?.key && currentSort?.direction) {
        query = query.order(currentSort.key, { ascending: currentSort.direction === 'asc' });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;
      setReservations(data || []);
    } catch (error: any) {
      toast.error(`Error loading reservations: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string, direction: SortDirection) => {
    setCurrentSort(direction ? { key, direction } : null);
    setPage(1);
  };

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Check permissions
  const canCreateReservations = profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'senior_manager';

  if (loading && reservations.length === 0) {
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
          {/* Top Pagination */}
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />

          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label={t('reservationNumber') as string}
                  sortKey="reservation_number"
                  currentSort={currentSort}
                  onSort={handleSort}
                  filterable
                  filterType="text"
                  filterValue={filters.reservation_number || ''}
                  onFilterChange={(value) => handleFilter('reservation_number', value)}
                />
                <SortableTableHead
                  label={t('customer') as string}
                  sortKey="customer_name"
                  currentSort={currentSort}
                  onSort={handleSort}
                  filterable
                  filterType="text"
                  filterValue={filters.customer_name || ''}
                  onFilterChange={(value) => handleFilter('customer_name', value)}
                />
                <SortableTableHead
                  label={t('reservedDate') as string}
                  sortKey="reserved_date"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={t('totalMeters') as string}
                  sortKey=""
                  currentSort={currentSort}
                  onSort={() => {}}
                />
                <SortableTableHead
                  label={t('lineItems') as string}
                  sortKey=""
                  currentSort={currentSort}
                  onSort={() => {}}
                />
                <SortableTableHead
                  label={t('status') as string}
                  sortKey="status"
                  currentSort={currentSort}
                  onSort={handleSort}
                  filterable
                  filterType="select"
                  filterOptions={[
                    { value: 'active', label: 'Active' },
                    { value: 'converted', label: 'Converted' },
                    { value: 'canceled', label: 'Canceled' },
                  ]}
                  filterValue={filters.status || ''}
                  onFilterChange={(value) => handleFilter('status', value)}
                />
                <SortableTableHead
                  label={t('actions') as string}
                  sortKey=""
                  currentSort={currentSort}
                  onSort={() => {}}
                />
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
                      <ViewDetailsButton 
                        onClick={() => { setSelectedReservation(res); setShowReservationDetails(true); }}
                        showLabel={false}
                      />
                      {res.status === 'active' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setReservationToConvert(res)}>
                            <Truck className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setReservationToCancel(res)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Bottom Pagination */}
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
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
