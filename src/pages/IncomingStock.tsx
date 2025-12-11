import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, TruckIcon, PackageIcon, AlertCircle, CheckCircle, Edit, Trash2, BookmarkPlus } from 'lucide-react';
import { IncomingStockDialog } from '@/components/IncomingStockDialog';
import { IncomingBulkUpload } from '@/components/IncomingBulkUpload';
import { ReceiveStockDialog } from '@/components/ReceiveStockDialog';
import ReservationDialog from '@/components/ReservationDialog';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';
import { TableExportButton, exportToCSV } from '@/components/ui/table-export-button';
import { ViewDetailsButton } from '@/components/ui/view-details-button';

interface IncomingStock {
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
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface IncomingStockWithSupplier extends IncomingStock {
  suppliers: {
    id: string;
    name: string;
  };
}

const IncomingStock: React.FC = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { t } = useLanguage();
  const [incomingStock, setIncomingStock] = useState<IncomingStockWithSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<IncomingStockWithSupplier | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const { toast } = useToast();

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting state
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>(
    { key: 'created_at', direction: 'desc' }
  );

  useEffect(() => {
    if (!permissionsLoading && hasPermission('inventory', 'viewincoming')) {
      fetchIncomingStock();
      fetchSuppliers();
    }
  }, [permissionsLoading, statusFilter, supplierFilter, page, pageSize, currentSort]);

  const fetchIncomingStock = async () => {
    setLoading(true);
    try {
      // Get total count first
      let countQuery = supabase
        .from('incoming_stock')
        .select('*', { count: 'exact', head: true });

      if (statusFilter !== 'all') {
        countQuery = countQuery.eq('status', statusFilter);
      }
      if (supplierFilter !== 'all') {
        countQuery = countQuery.eq('supplier_id', supplierFilter);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Build main query
      let query = supabase
        .from('incoming_stock')
        .select(`
          *,
          suppliers (
            id,
            name
          )
        `);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (supplierFilter !== 'all') {
        query = query.eq('supplier_id', supplierFilter);
      }

      // Apply sorting
      if (currentSort?.key && currentSort?.direction) {
        query = query.order(currentSort.key, { ascending: currentSort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;
      setIncomingStock(data || []);
    } catch (error) {
      console.error('Error fetching incoming stock:', error);
      toast({
        title: t('error') as string,
        description: t('failedToFetchIncomingStock'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const calculateSummaryStats = () => {
    const totalIncoming = incomingStock
      .filter(s => s.status !== 'fully_received')
      .reduce((sum, s) => sum + (s.expected_meters - s.received_meters), 0);

    const pendingCount = incomingStock.filter(s => s.status === 'pending_inbound').length;
    const partialCount = incomingStock.filter(s => s.status === 'partially_received').length;

    const overdueCount = incomingStock.filter(s =>
      s.status !== 'fully_received' &&
      s.expected_arrival_date &&
      new Date(s.expected_arrival_date) < new Date()
    ).length;

    return { totalIncoming, pendingCount, partialCount, overdueCount };
  };

  const isOverdue = (item: IncomingStockWithSupplier) => {
    return item.status !== 'fully_received' &&
      item.expected_arrival_date &&
      new Date(item.expected_arrival_date) < new Date();
  };

  const handleEdit = (item: IncomingStockWithSupplier) => {
    setSelectedStock(item);
    setDialogOpen(true);
  };

  const handleReceive = (item: IncomingStockWithSupplier) => {
    setSelectedStock(item);
    setReceiveDialogOpen(true);
  };

  const handleReserve = (item: IncomingStockWithSupplier) => {
    setSelectedStock(item);
    setReservationDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDeleteIncomingStock') as string)) return;

    try {
      const { error } = await supabase
        .from('incoming_stock')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: t('incomingStockDeletedSuccess')
      });

      fetchIncomingStock();
    } catch (error: any) {
      console.error('Error deleting incoming stock:', error);
      toast({
        title: 'Error',
        description: error.message || t('failedToDeleteIncomingStock'),
        variant: 'destructive'
      });
    }
  };

  const stats = calculateSummaryStats();

  if (permissionsLoading) {
    return <div className="text-sm text-muted-foreground">{t('loadingEllipsis')}</div>;
  }

  if (!hasPermission('inventory', 'viewincoming')) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            {t('noPermissionIncomingStock')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSort = (key: string, direction: SortDirection) => {
    setCurrentSort(direction ? { key, direction } : null);
    setPage(1);
  };

  const handleExport = () => {
    const exportData = incomingStock.map(item => ({
      invoice_number: item.invoice_number,
      supplier: item.suppliers.name,
      quality: item.quality,
      color: item.color,
      expected_meters: item.expected_meters,
      received_meters: item.received_meters,
      reserved_meters: item.reserved_meters,
      open_meters: item.expected_meters - item.received_meters,
      status: item.status,
      expected_arrival_date: item.expected_arrival_date || '-'
    }));

    exportToCSV(exportData, [
      { key: 'invoice_number', label: String(t('invoiceNumber')) },
      { key: 'supplier', label: String(t('supplier')) },
      { key: 'quality', label: String(t('quality')) },
      { key: 'color', label: String(t('color')) },
      { key: 'expected_meters', label: String(t('expected')) },
      { key: 'received_meters', label: String(t('received')) },
      { key: 'reserved_meters', label: String(t('reserved')) },
      { key: 'open_meters', label: String(t('open')) },
      { key: 'status', label: String(t('status')) },
      { key: 'expected_arrival_date', label: String(t('arrivalDate')) }
    ], 'incoming-stock-export');
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('incomingStockLabel')}</h1>
        <div className="flex gap-2">
          <TableExportButton onExport={handleExport} disabled={incomingStock.length === 0} />
          {hasPermission('inventory', 'createincoming') && (
            <>
              <Button onClick={() => setBulkUploadOpen(true)} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                {t('bulkUpload')}
              </Button>
              <Button onClick={() => {
                setSelectedStock(null);
                setDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                {t('newEntry')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TruckIcon className="h-4 w-4 text-muted-foreground" />
              {t('totalIncomingMeters')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalIncoming.toLocaleString()}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('expectedStockOnTheWay')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
              {t('pendingShipments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.pendingCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('awaitingArrival')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              {t('partiallyReceived')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.partialCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('inProgress')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              {t('overdue')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pastExpectedDate')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatusFilter')}</SelectItem>
            <SelectItem value="pending_inbound">{t('pendingInbound')}</SelectItem>
            <SelectItem value="partially_received">{t('partiallyReceived')}</SelectItem>
            <SelectItem value="fully_received">{t('fullyReceived')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('filterBySupplier')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allSuppliers')}</SelectItem>
            {suppliers.map(supplier => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Incoming Stock Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('incomingStockEntries')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Top Pagination */}
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />

          {loading ? (
            <div className="space-y-2 mt-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : incomingStock.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noIncomingStockFound')}
            </div>
          ) : (
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    label={String(t('invoiceNumber'))}
                    sortKey="invoice_number"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('supplier'))}
                    sortKey="supplier_id"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('quality'))}
                    sortKey="quality"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('color'))}
                    sortKey="color"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('expected'))}
                    sortKey="expected_meters"
                    currentSort={currentSort}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableTableHead
                    label={String(t('received'))}
                    sortKey="received_meters"
                    currentSort={currentSort}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableTableHead
                    label={String(t('reserved'))}
                    sortKey="reserved_meters"
                    currentSort={currentSort}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableTableHead
                    label={String(t('open'))}
                    sortKey="expected_meters"
                    currentSort={currentSort}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableTableHead
                    label={String(t('progressLabel'))}
                    sortKey="received_meters"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('arrivalDate'))}
                    sortKey="expected_arrival_date"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('status'))}
                    sortKey="status"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('actions'))}
                    sortKey=""
                    currentSort={null}
                    onSort={() => {}}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomingStock.map((item) => {
                  const openMeters = item.expected_meters - item.received_meters;
                  const progress = (item.received_meters / item.expected_meters) * 100;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.invoice_number}</TableCell>
                      <TableCell>{item.suppliers.name}</TableCell>
                      <TableCell>{item.quality}</TableCell>
                      <TableCell>{item.color}</TableCell>
                      <TableCell className="text-right">{item.expected_meters.toLocaleString()}m</TableCell>
                      <TableCell className="text-right">{item.received_meters.toLocaleString()}m</TableCell>
                      <TableCell className="text-right">
                        <span className="text-orange-600">{item.reserved_meters.toLocaleString()}m</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={openMeters > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                          {openMeters.toLocaleString()}m
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">{Math.round(progress)}%</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.expected_arrival_date ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {new Date(item.expected_arrival_date).toLocaleDateString()}
                            </span>
                            {isOverdue(item) && <Badge variant="destructive">{t('overdue')}</Badge>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.status === 'pending_inbound' && (
                          <Badge variant="outline" className="bg-blue-50">{t('pending')}</Badge>
                        )}
                        {item.status === 'partially_received' && (
                          <Badge variant="outline" className="bg-amber-50">{t('partial')}</Badge>
                        )}
                        {item.status === 'fully_received' && (
                          <Badge variant="outline" className="bg-green-50">{t('complete')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {hasPermission('reservations', 'create') && openMeters > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReserve(item)}
                            >
                              <BookmarkPlus className="h-3 w-3 mr-1" />
                              {t('reserve')}
                            </Button>
                          )}
                          {hasPermission('inventory', 'receiveincoming') && openMeters > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReceive(item)}
                            >
                              {t('receive')}
                            </Button>
                          )}
                          {hasPermission('inventory', 'createincoming') && (
                            <ViewDetailsButton onClick={() => handleEdit(item)} />
                          )}
                          {hasPermission('inventory', 'deleteincoming') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Bottom Pagination */}
          {!loading && incomingStock.length > 0 && (
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <IncomingStockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingStock={selectedStock}
        onSuccess={() => {
          fetchIncomingStock();
          setSelectedStock(null);
        }}
      />

      <IncomingBulkUpload
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onSuccess={fetchIncomingStock}
      />

      <ReceiveStockDialog
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        incomingStock={selectedStock}
        onSuccess={() => {
          fetchIncomingStock();
          setSelectedStock(null);
        }}
      />

      <ReservationDialog
        open={reservationDialogOpen}
        onOpenChange={setReservationDialogOpen}
        onSuccess={() => {
          fetchIncomingStock();
          setReservationDialogOpen(false);
        }}
        preSelectedIncomingStock={selectedStock ? {
          id: selectedStock.id,
          quality: selectedStock.quality,
          color: selectedStock.color,
          available_meters: selectedStock.expected_meters - selectedStock.received_meters - selectedStock.reserved_meters,
          invoice_number: selectedStock.invoice_number,
          supplier_name: selectedStock.suppliers.name
        } : undefined}
      />
    </div>
  );
};

export default IncomingStock;
