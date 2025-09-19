import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePOCart } from '@/contexts/POCartProvider';
import { toast } from "sonner";
import { Truck, Plus, CheckCircle, Download, Eye, FileText, Trash2, FileSpreadsheet, FlaskConical, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import OrderPrintDialog from '@/components/OrderPrintDialog';
import MultiQualityOrderDialog from '@/components/MultiQualityOrderDialog';
import OrderBulkUpload from '@/components/OrderBulkUpload';
import SampleOrderDialog from '@/components/SampleOrderDialog';
import InventoryPivotTable from '@/components/InventoryPivotTable';
import { InlineEditableField } from '@/components/InlineEditableField';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation, useNavigate } from 'react-router-dom';

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
    lot: {
      lot_number: string;
      meters: number;
    };
  }>;
}

interface Lot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  status: string;
}

const Orders = () => {
  const { profile } = useAuth();
  const { clearCart } = usePOCart();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMultiQualityDialog, setShowMultiQualityDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showSampleDialog, setShowSampleDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);

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
  }>>([]);

  // Check for pre-filled data from cart
  useEffect(() => {
    if (location.state?.selectedLots && location.state?.fromCart) {
      // Convert cart data to order format
      const convertedLots = location.state.selectedLots.map((cartItem: any) => ({
        lotId: cartItem.id,
        quality: cartItem.quality,
        color: cartItem.color,
        lotNumber: cartItem.lot_number,
        meters: cartItem.meters,
        availableRolls: cartItem.roll_count,
        rollCount: cartItem.selectedRollIds?.length || 0,
        lineType: 'standard' as const
      }));
      
      setSelectedLots(convertedLots);
      setShowCreateDialog(true);
      // Clear the location state to avoid re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_lots (
            id,
            quality,
            color,
            roll_count,
            line_type,
            lot:lots (
              lot_number,
              meters
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error: any) {
      toast.error(`Error loading orders: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!customerName || selectedLots.length === 0) {
      toast.error(t('fillAllFields') as string);
      return;
    }

    try {
      // Validate inventory availability
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

      // Create order with auto-generated order number
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: customerName,
          created_by: profile?.user_id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order lots
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
          });
      }

      toast.success(`${t('orderCreatedSuccessfully')} ${orderData.order_number}`);

      // Show print dialog for new order
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
      
      // Clear cart if order was created from cart
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

      // Properly deduct inventory from lots
      const order = orders.find(o => o.id === orderId);
      if (order) {
        for (const orderLot of order.order_lots) {
          // Get current lot data
          const { data: currentLot, error: fetchError } = await supabase
            .from('lots')
            .select('roll_count, meters')
            .eq('lot_number', orderLot.lot.lot_number)
            .single();

          if (fetchError) {
            console.error('Error fetching lot:', fetchError);
            continue;
          }

          const newRollCount = currentLot.roll_count - orderLot.roll_count;
          const rollRatio = orderLot.roll_count / currentLot.roll_count;
          const newMeters = Math.max(0, currentLot.meters - (currentLot.meters * rollRatio));

          // Update lot quantities or mark as out_of_stock
          const updateData: any = {
            roll_count: Math.max(0, newRollCount),
            meters: newMeters
          };

          // Only mark as out_of_stock if no rolls remaining
          if (newRollCount <= 0) {
            updateData.status = 'out_of_stock';
          }

          const { error: lotError } = await supabase
            .from('lots')
            .update(updateData)
            .eq('lot_number', orderLot.lot.lot_number);

          if (lotError) {
            console.error('Error updating lot:', lotError);
          }
        }
      }

      toast.success(t('orderMarkedFulfilled') as string);

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
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

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

  if (loading) {
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
                <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('standardOrder')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowMultiQualityDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('multiQualityOrder')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBulkUpload(true)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {t('bulkUpload')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSampleDialog(true)}>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  {t('sampleOrder')}
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

            {/* Show selected lots from cart */}
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

            {/* Instructions */}
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

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('allOrders')}</CardTitle>
          <CardDescription>
            {t('viewManageOrders')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('orderNumberField')}</TableHead>
                <TableHead>{t('customer')}</TableHead>
                <TableHead>{t('lotsCount')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('created')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {t('view')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintOrder(order)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        {t('print')}
                      </Button>
                      {!order.fulfilled_at && canFulfillOrders && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFulfillOrder(order.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeleteOrders && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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
                      <TableHead>Quality</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Rolls</TableHead>
                      <TableHead>Type</TableHead>
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

      {/* Multi Quality Order Dialog */}
      <MultiQualityOrderDialog
        open={showMultiQualityDialog}
        onOpenChange={setShowMultiQualityDialog}
        availableQualities={[]}
        onProceed={async (selections) => {
          console.log('Multi-quality selections:', selections);
          setShowMultiQualityDialog(false);
        }}
      />

      {/* Bulk Upload Dialog */}
      <OrderBulkUpload
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        onUpload={async (items) => {
          console.log('Bulk upload items:', items);
          setShowBulkUpload(false);
        }}
      />

      {/* Sample Order Dialog */}
      <SampleOrderDialog
        open={showSampleDialog}
        onOpenChange={setShowSampleDialog}
        onCreateSample={async (customerName, selectedLots) => {
          try {
            // Create sample order with auto-generated order number
            const { data: orderData, error: orderError } = await supabase
              .from('orders')
              .insert({
                customer_name: customerName,
                created_by: profile?.user_id,
              })
              .select()
              .single();

            if (orderError) throw orderError;

            // Create sample order lots
            for (const lot of selectedLots) {
              await supabase
                .from('order_lots')
                .insert({
                  order_id: orderData.id,
                  lot_id: lot.id,
                  roll_count: lot.roll_count,
                  line_type: 'sample',
                  quality: lot.quality || '',
                  color: lot.color || '',
                });
            }

            toast.success(`Sample order ${orderData.order_number} created successfully`);
            fetchOrders();
            setShowSampleDialog(false);
          } catch (error: any) {
            toast.error('Failed to create sample order: ' + error.message);
          }
        }}
      />
    </div>
  );
};

export default Orders;