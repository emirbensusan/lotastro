import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import { usePOCart } from '@/contexts/POCartProvider';
import { toast } from "sonner";
import { Truck, Plus, CheckCircle, FileText, Trash2, FileSpreadsheet, FlaskConical, ChevronDown, Layers, Share2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import OrderPrintDialog from '@/components/OrderPrintDialog';
import OrderBulkUpload from '@/components/OrderBulkUpload';
import AIOrderInput from '@/components/AIOrderInput';
import { InlineEditableField } from '@/components/InlineEditableField';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocation, useNavigate } from 'react-router-dom';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';
import { TableExportButton, exportToCSV } from '@/components/ui/table-export-button';
import { ViewDetailsButton } from '@/components/ui/view-details-button';
import ShareOrderDialog from '@/components/ShareOrderDialog';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  created_at: string;
  fulfilled_at: string | null;
  created_by: string;
  fulfilled_by: string | null;
  order_lots: Array<{
    id: string;
    quality: string;
    color: string;
    roll_count: number;
    line_type: 'sample' | 'standard';
    selected_roll_meters: string | null;
    selected_roll_ids: string | null;
    lot: {
      lot_number: string;
      meters: number;
    };
  }>;
}

const Orders = () => {
  const { profile } = useAuth();
  const { logAction } = useAuditLog();
  const { clearCart } = usePOCart();
  const { t } = useLanguage();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [orderToShare, setOrderToShare] = useState<Order | null>(null);

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

  // Create order form state
  const [customerName, setCustomerName] = useState('');
  const [selectedLots, setSelectedLots] = useState<Array<{
    lotId: string;
    quality: string;
    color: string;
    lotNumber: string;
    meters: number;
    availableRolls: number;
    rollCount: number;
    lineType: 'sample' | 'standard';
    rollMeters?: string;
    rollIds?: string;
  }>>([]);

  // Check for pre-filled data from cart
  useEffect(() => {
    if (location.state?.selectedLots && location.state?.fromCart) {
      const convertedLots = location.state.selectedLots.map((cartItem: any) => ({
        lotId: cartItem.id,
        quality: cartItem.quality,
        color: cartItem.color,
        lotNumber: cartItem.lot_number,
        meters: cartItem.selectedRollsData.reduce((total: number, roll: any) => total + roll.meters, 0),
        availableRolls: cartItem.roll_count,
        rollCount: cartItem.selectedRollIds?.length || 0,
        lineType: cartItem.lineType || 'standard' as const,
        rollMeters: cartItem.lineType === 'sample' && cartItem.selectedRollMeters 
          ? cartItem.selectedRollMeters.join(',') 
          : cartItem.selectedRollsData?.map((roll: any) => roll.meters.toString()).join(',') || '',
        rollIds: cartItem.selectedRollIds?.join(',') || '',
      }));
      
      setSelectedLots(convertedLots);
      setShowCreateDialog(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    fetchOrders();
  }, [page, pageSize, currentSort, filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Get total count first
      let countQuery = supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });
      
      // Apply filters to count query
      if (filters.order_number) {
        countQuery = countQuery.ilike('order_number', `%${filters.order_number}%`);
      }
      if (filters.customer_name) {
        countQuery = countQuery.ilike('customer_name', `%${filters.customer_name}%`);
      }
      if (filters.status) {
        if (filters.status === 'fulfilled') {
          countQuery = countQuery.not('fulfilled_at', 'is', null);
        } else if (filters.status === 'pending') {
          countQuery = countQuery.is('fulfilled_at', null);
        }
      }
      
      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Fetch paginated data
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_lots (
            id,
            quality,
            color,
            roll_count,
            line_type,
            selected_roll_meters,
            selected_roll_ids,
            lot:lots (
              lot_number,
              meters
            )
          )
        `);

      // Apply filters
      if (filters.order_number) {
        query = query.ilike('order_number', `%${filters.order_number}%`);
      }
      if (filters.customer_name) {
        query = query.ilike('customer_name', `%${filters.customer_name}%`);
      }
      if (filters.status) {
        if (filters.status === 'fulfilled') {
          query = query.not('fulfilled_at', 'is', null);
        } else if (filters.status === 'pending') {
          query = query.is('fulfilled_at', null);
        }
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

      setOrders(data || []);
    } catch (error: any) {
      toast.error(`Error loading orders: ${error.message}`);
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

  const handleExport = () => {
    const exportData = orders.map(order => ({
      order_number: order.order_number,
      customer_name: order.customer_name,
      lots_count: order.order_lots.length,
      status: order.fulfilled_at ? 'Fulfilled' : 'Pending',
      created_at: new Date(order.created_at).toLocaleDateString(),
      fulfilled_at: order.fulfilled_at ? new Date(order.fulfilled_at).toLocaleDateString() : '',
    }));
    
    exportToCSV(exportData, [
      { key: 'order_number', label: t('orderNumberField') as string },
      { key: 'customer_name', label: t('customer') as string },
      { key: 'lots_count', label: t('lotsCount') as string },
      { key: 'status', label: t('status') as string },
      { key: 'created_at', label: t('created') as string },
      { key: 'fulfilled_at', label: t('fulfilled') as string },
    ], 'orders');
  };

  const handleCreateOrder = async () => {
    if (!customerName || selectedLots.length === 0) {
      toast.error(t('fillAllFields') as string);
      return;
    }

    try {
      for (const selectedLot of selectedLots) {
        const { data: currentLot, error: fetchError } = await supabase
          .from('lots')
          .select('roll_count, status')
          .eq('id', selectedLot.lotId)
          .single();

        if (fetchError) throw fetchError;
        
        if (currentLot.status !== 'in_stock') {
          toast.error(`Lot ${selectedLot.lotNumber} is no longer available`);
          return;
        }
        
        if (currentLot.roll_count < selectedLot.rollCount) {
          toast.error(`Insufficient rolls for lot ${selectedLot.lotNumber}. Available: ${currentLot.roll_count}, Requested: ${selectedLot.rollCount}`);
          return;
        }
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: customerName,
          created_by: profile?.user_id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      for (const selectedLot of selectedLots) {
        await supabase
          .from('order_lots')
          .insert({
            order_id: orderData.id,
            lot_id: selectedLot.lotId,
            roll_count: selectedLot.rollCount,
            line_type: selectedLot.lineType,
            quality: selectedLot.quality,
            color: selectedLot.color,
            selected_roll_meters: selectedLot.rollMeters || '',
            selected_roll_ids: selectedLot.rollIds || '',
          });

        if (selectedLot.rollIds) {
          const rollIds = selectedLot.rollIds.split(',').filter(id => id.trim());
          if (rollIds.length > 0) {
            await supabase
              .from('rolls')
              .update({ status: 'allocated' })
              .in('id', rollIds);
          }
        }
      }

      toast.success(`${t('orderCreatedSuccessfully')} ${orderData.order_number}`);

      const totalMeters = selectedLots.reduce((sum, lot) => {
        const meters = lot.rollMeters?.split(',').reduce((s, m) => s + parseFloat(m), 0) || 0;
        return sum + meters;
      }, 0);
      const totalRolls = selectedLots.reduce((sum, lot) => sum + lot.rollCount, 0);

      await logAction(
        'CREATE',
        'order',
        orderData.id,
        orderData.order_number,
        null,
        { ...orderData, order_lots: selectedLots, customer_name: customerName },
        String(t('createdOrderNote'))
          .replace('{orderNumber}', orderData.order_number)
          .replace('{customerName}', customerName)
          .replace('{lotCount}', String(selectedLots.length))
          .replace('{rollCount}', String(totalRolls))
          .replace('{meters}', totalMeters.toFixed(2))
      );

      const newOrder = await supabase
        .from('orders')
        .select(`
          *,
          order_lots (
            id,
            quality,
            color,
            roll_count,
            line_type,
            selected_roll_meters,
            selected_roll_ids,
            lot:lots (
              lot_number,
              meters
            )
          )
        `)
        .eq('id', orderData.id)
        .single();
      
      if (newOrder.data) {
        setOrderToPrint(newOrder.data);
        setShowPrintDialog(true);
      }

      setShowCreateDialog(false);
      setCustomerName('');
      setSelectedLots([]);
      
      if (location.state?.fromCart) {
        clearCart();
      }
      
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleFulfillOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          fulfilled_by: profile?.user_id,
          fulfilled_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;

      const order = orders.find(o => o.id === orderId);
      if (order) {
        for (const orderLot of order.order_lots) {
          const selectedRollIds = orderLot.selected_roll_ids?.split(',').filter(id => id.trim()) || [];
          
          if (selectedRollIds.length > 0) {
            await supabase
              .from('rolls')
              .update({ status: 'fulfilled' })
              .in('id', selectedRollIds);

            const { data: fulfilledRolls } = await supabase
              .from('rolls')
              .select('meters')
              .in('id', selectedRollIds);

            const totalFulfilledMeters = fulfilledRolls?.reduce((sum, roll) => sum + Number(roll.meters), 0) || 0;

            const { data: currentLot } = await supabase
              .from('lots')
              .select('roll_count, meters, id')
              .eq('lot_number', orderLot.lot.lot_number)
              .single();

            if (currentLot) {
              const newRollCount = currentLot.roll_count - selectedRollIds.length;
              const newMeters = Math.max(0, currentLot.meters - totalFulfilledMeters);

              const updateData: any = {
                roll_count: Math.max(0, newRollCount),
                meters: newMeters
              };

              if (newRollCount <= 0) {
                updateData.status = 'out_of_stock';
              }

              await supabase
                .from('lots')
                .update(updateData)
                .eq('lot_number', orderLot.lot.lot_number);
            }
          }
        }
      }

      toast.success(t('orderMarkedFulfilled') as string);

      await logAction(
        'FULFILL',
        'order',
        orderId,
        order?.order_number || orderId,
        { fulfilled_at: null, fulfilled_by: null },
        { fulfilled_at: new Date().toISOString(), fulfilled_by: profile?.user_id },
        String(t('fulfilledOrderNote'))
          .replace('{orderNumber}', order?.order_number || orderId)
          .replace('{customerName}', order?.customer_name || '')
      );

      fetchOrders();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePrintOrder = (order: Order) => {
    setOrderToPrint(order);
    setShowPrintDialog(true);
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    try {
      const order = orders.find(o => o.id === orderId);

      if (order) {
        const totalRolls = order.order_lots.reduce((sum, ol) => sum + ol.roll_count, 0);
        await logAction(
          'DELETE',
          'order',
          orderId,
          orderNumber,
          order,
          null,
          String(t('deletedOrderNote'))
            .replace('{orderNumber}', orderNumber)
            .replace('{rollCount}', String(totalRolls))
        );
      }

      if (order && !order.fulfilled_at) {
        for (const orderLot of order.order_lots) {
          const selectedRollIds = orderLot.selected_roll_ids?.split(',').filter(id => id.trim()) || [];
          
          if (selectedRollIds.length > 0) {
            await supabase
              .from('rolls')
              .update({ status: 'available' })
              .in('id', selectedRollIds)
              .eq('status', 'allocated');
          }
        }
      }

      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      toast.success(`Order ${orderNumber} deleted successfully`);
      fetchOrders();
    } catch (error: any) {
      toast.error('Failed to delete order: ' + error.message);
    }
  };

  const handleUpdateOrder = async (orderId: string, updates: Record<string, any>) => {
    try {
      const oldOrder = orders.find(o => o.id === orderId);

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      if (oldOrder) {
        await logAction(
          'UPDATE',
          'order',
          orderId,
          oldOrder.order_number,
          { [Object.keys(updates)[0]]: oldOrder[Object.keys(updates)[0] as keyof typeof oldOrder] },
          updates,
          `Updated order field: ${Object.keys(updates).join(', ')}`
        );
      }

      toast.success('Order updated successfully');
      fetchOrders();
    } catch (error: any) {
      toast.error('Failed to update order: ' + error.message);
    }
  };

  // Check permissions
  const canCreateOrders = profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'senior_manager';
  const canFulfillOrders = profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'senior_manager';
  const canDeleteOrders = profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'senior_manager';
  const canUseAIExtraction = hasPermission('orders', 'useaiextraction');

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('orders')}</h1>
          <Truck className="h-8 w-8 text-primary" />
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
        <h1 className="text-3xl font-bold">{t('orders')}</h1>
        <div className="flex space-x-2 items-center">
          {canCreateOrders && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createOrder')}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate('/inventory?mode=single')}>
                <Plus className="mr-2 h-4 w-4" />
                {t('standardOrder')}
              </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/inventory?mode=multi')}>
                  <Layers className="mr-2 h-4 w-4" />
                  {t('multiQualityOrder')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/inventory?mode=sample')}>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  {t('sampleOrder')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/inventory?mode=multi-sample')}>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  {t('multipleSamples')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBulkUpload(true)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {t('bulkUpload')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Truck className="h-8 w-8 text-primary" />
        </div>
      </div>

      {/* Create Order Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('createOrder')}</DialogTitle>
            <DialogDescription>
              kalite/renk/lot seçip müşteri detaylarını LOGO ile uyumlu olacak şekilde giriniz
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">{t('customerNameField')}</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Inc."
              />
            </div>

            {selectedLots.length > 0 && (
              <div className="space-y-2">
                <Label>{t('selectedLots')} ({selectedLots.length})</Label>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {selectedLots.map((lot) => (
                    <div key={lot.lotId} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1">
                        <span className="font-mono text-sm">{lot.lotNumber}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {lot.quality} - {lot.color} - {lot.rollCount} {t('rolls')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedLots.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Navigate to inventory → select quality/color → add lots to cart → return here to create PO
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setCustomerName('');
                setSelectedLots([]);
              }}>
                {t('cancel')}
              </Button>
              <Button 
                onClick={() => {
                  if (selectedLots.length === 0) {
                    navigate('/inventory');
                  } else {
                    handleCreateOrder();
                  }
                }}
                disabled={!customerName}
              >
                {t('createOrder')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Order Input */}
      {canUseAIExtraction && <AIOrderInput />}
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{t('allOrders')}</CardTitle>
              <CardDescription>
                {t('viewManageOrders')}
              </CardDescription>
            </div>
            <TableExportButton onExport={handleExport} />
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
                  label={t('orderNumberField') as string}
                  sortKey="order_number"
                  currentSort={currentSort}
                  onSort={handleSort}
                  filterable
                  filterType="text"
                  filterValue={filters.order_number || ''}
                  onFilterChange={(value) => handleFilter('order_number', value)}
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
                  label={t('lotsCount') as string}
                  sortKey="lots_count"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={t('status') as string}
                  sortKey="fulfilled_at"
                  currentSort={currentSort}
                  onSort={handleSort}
                  filterable
                  filterType="select"
                  filterOptions={[
                    { value: 'fulfilled', label: t('fulfilled') as string },
                    { value: 'pending', label: t('pending') as string },
                  ]}
                  filterValue={filters.status || ''}
                  onFilterChange={(value) => handleFilter('status', value)}
                />
                <SortableTableHead
                  label={t('created') as string}
                  sortKey="created_at"
                  currentSort={currentSort}
                  onSort={handleSort}
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
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">
                    <InlineEditableField
                      value={order.order_number}
                      onSave={(newValue) => handleUpdateOrder(order.id, { order_number: newValue.toString() })}
                      disabled={!canCreateOrders}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineEditableField
                      value={order.customer_name}
                      onSave={(newValue) => handleUpdateOrder(order.id, { customer_name: newValue.toString() })}
                      disabled={!canCreateOrders}
                    />
                  </TableCell>
                  <TableCell>{order.order_lots.length}</TableCell>
                  <TableCell>
                    {order.fulfilled_at ? (
                      <Badge className="bg-green-100 text-green-800">
                        {t('fulfilled')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t('pending')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(order.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <ViewDetailsButton onClick={() => setSelectedOrder(order)} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintOrder(order)}
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                      {canCreateOrders && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOrderToShare(order);
                            setShareDialogOpen(true);
                          }}
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                      )}
                      {!order.fulfilled_at && canFulfillOrders && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFulfillOrder(order.id)}
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      )}
                      {canDeleteOrders && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Order</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete order "{order.order_number}" for customer "{order.customer_name}"? 
                                This action cannot be undone and will permanently remove the order and all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteOrder(order.id, order.order_number)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Order
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

      {/* Order Details Dialog */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Order Details - {selectedOrder.order_number}</DialogTitle>
              <DialogDescription>
                Customer: {selectedOrder.customer_name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Order Status</Label>
                  <div className="mt-1">
                    {selectedOrder.fulfilled_at ? (
                      <Badge className="bg-green-100 text-green-800">Fulfilled</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Created Date</Label>
                  <div className="mt-1">{new Date(selectedOrder.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <Label>Order Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell className="font-medium">Quality</TableCell>
                      <TableCell className="font-medium">Color</TableCell>
                      <TableCell className="font-medium">Lot Number</TableCell>
                      <TableCell className="font-medium">Rolls</TableCell>
                      <TableCell className="font-medium">Meters</TableCell>
                      <TableCell className="font-medium">Type</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.order_lots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell>{lot.quality}</TableCell>
                        <TableCell>{lot.color}</TableCell>
                        <TableCell>{lot.lot.lot_number}</TableCell>
                        <TableCell>{lot.roll_count}</TableCell>
                        <TableCell>
                          {lot.selected_roll_meters ? 
                            lot.selected_roll_meters.split(',').reduce((sum, meters) => sum + parseFloat(meters.trim()), 0).toFixed(1) + 'm' 
                            : '0m'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant={lot.line_type === 'sample' ? 'secondary' : 'default'}>
                            {lot.line_type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Print Dialog */}
      {orderToPrint && (
        <OrderPrintDialog
          order={orderToPrint}
          open={showPrintDialog}
          onOpenChange={setShowPrintDialog}
        />
      )}

      {/* Bulk Upload Dialog */}
      <OrderBulkUpload
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        onUpload={async (items) => {
          console.log('Bulk upload items:', items);
          setShowBulkUpload(false);
        }}
      />

      {/* Share Order Dialog */}
      {orderToShare && (
        <ShareOrderDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          orderId={orderToShare.id}
          orderNumber={orderToShare.order_number}
        />
      )}
    </div>
  );
};

export default Orders;
