import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from "sonner";
import { Truck, Plus, CheckCircle, Download, Eye, FileText, Trash2, Upload, FlaskConical, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import OrderPrintDialog from '@/components/OrderPrintDialog';
import MultiQualityOrderDialog from '@/components/MultiQualityOrderDialog';
import OrderBulkUpload from '@/components/OrderBulkUpload';
import SampleOrderDialog from '@/components/SampleOrderDialog';
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
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMultiQualityDialog, setShowMultiQualityDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showSampleDialog, setShowSampleDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);

  // Create order form state
  const [orderNumber, setOrderNumber] = useState('');
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

  // Quality and color selection for new order flow
  const [selectedQuality, setSelectedQuality] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [availableColors, setAvailableColors] = useState<string[]>([]);

  // Check for pre-filled data from inventory
  useEffect(() => {
    if (location.state?.prefilledLots) {
      setSelectedLots(location.state.prefilledLots);
      setShowCreateDialog(true);
    }
  }, [location.state]);

  useEffect(() => {
    fetchOrders();
    fetchAvailableQualities();
  }, []);

  const fetchOrders = async () => {
    try {
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
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableQualities = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('quality, color')
        .eq('status', 'in_stock');

      if (error) throw error;
      
      const uniqueQualities = [...new Set(data?.map(lot => lot.quality) || [])];
      setAvailableQualities(uniqueQualities);
    } catch (error) {
      console.error('Error fetching qualities:', error);
    }
  };

  const fetchColorsForQuality = async (quality: string) => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('color')
        .eq('status', 'in_stock')
        .eq('quality', quality);

      if (error) throw error;
      
      const uniqueColors = [...new Set(data?.map(lot => lot.color) || [])];
      setAvailableColors(uniqueColors);
    } catch (error) {
      console.error('Error fetching colors:', error);
    }
  };

  const handleQualityChange = (quality: string) => {
    setSelectedQuality(quality);
    setSelectedColor('');
    setAvailableColors([]);
    if (quality) {
      fetchColorsForQuality(quality);
    }
  };

  const handleProceedToLotSelection = () => {
    if (!selectedQuality || !selectedColor) {
      toast.error("Please select both quality and color");
      return;
    }

    navigate(`/lot-selection?quality=${encodeURIComponent(selectedQuality)}&color=${encodeURIComponent(selectedColor)}`);
  };

  const handleCreateOrder = async () => {
    if (!orderNumber || !customerName || selectedLots.length === 0) {
      toast.error(t('fillAllFields') as string);
      return;
    }

    try {
      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
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
            quality: selectedLot.quality || lots.find(l => l.id === selectedLot.lotId)?.quality || '',
            color: selectedLot.color || lots.find(l => l.id === selectedLot.lotId)?.color || '',
          });
      }

      toast.success(`${t('orderCreatedSuccessfully')} ${orderNumber}`);

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
      setOrderNumber('');
      setCustomerName('');
      setSelectedLots([]);
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

      // Update lot statuses to out_of_stock
      const order = orders.find(o => o.id === orderId);
      if (order) {
        for (const orderLot of order.order_lots) {
          const { error: lotError } = await supabase
            .from('lots')
            .update({ status: 'out_of_stock' })
            .eq('id', orderLot.lot.lot_number); // Note: This should be lot ID, will fix in database query
        }
      }

      toast.success(t('orderMarkedFulfilled') as string);

      fetchOrders();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const addLotToOrder = () => {
    setSelectedLots([...selectedLots, {
      lotId: '',
      quality: '',
      color: '',
      lotNumber: '',
      meters: 0,
      availableRolls: 0,
      rollCount: 1,
      lineType: 'standard' as const,
    }]);
  };

  const removeLotFromOrder = (index: number) => {
    setSelectedLots(selectedLots.filter((_, i) => i !== index));
  };

  const updateSelectedLot = (index: number, field: string, value: any) => {
    setSelectedLots(prev => prev.map((lot, i) => 
      i === index ? { ...lot, [field]: value } : lot
    ));
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

  // Check permissions
  const canCreateOrders = profile && ['accounting', 'senior_manager', 'admin'].includes(profile.role);
  const canFulfillOrders = profile && ['warehouse_staff', 'accounting', 'senior_manager', 'admin'].includes(profile.role);
  const canDeleteOrders = profile && ['accounting', 'senior_manager', 'admin'].includes(profile.role);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('orders')}</h1>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('orders')}</h1>
        <div className="flex items-center space-x-4">
          <Truck className="h-8 w-8 text-primary" />
          {canCreateOrders && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('newOrder')}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('standardOrder')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowMultiQualityDialog(true)}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t('multiQualityOrder')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBulkUpload(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    {t('bulkUploadOrders')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowSampleDialog(true)}>
                    <FlaskConical className="mr-2 h-4 w-4" />
                    {t('sampleOrder')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                {selectedLots.length === 0 ? (
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t('selectQualityColor')}</DialogTitle>
                      <DialogDescription>
                        {t('selectQualityColorDescription')}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="quality">{t('quality')}</Label>
                        <Select value={selectedQuality} onValueChange={handleQualityChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectQuality')} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableQualities.map(quality => (
                              <SelectItem key={quality} value={quality}>
                                {quality}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="color">{t('color')}</Label>
                        <Select 
                          value={selectedColor} 
                          onValueChange={setSelectedColor}
                          disabled={!selectedQuality}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectColor')} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColors.map(color => (
                              <SelectItem key={color} value={color}>
                                <div className="flex items-center">
                                  <div 
                                    className="w-4 h-4 rounded mr-2 border"
                                    style={{ backgroundColor: color.toLowerCase() }}
                                  ></div>
                                  {color}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => {
                          setShowCreateDialog(false);
                          setSelectedQuality('');
                          setSelectedColor('');
                          setAvailableColors([]);
                        }}>
                          {t('cancel')}
                        </Button>
                        <Button 
                          onClick={handleProceedToLotSelection}
                          disabled={!selectedQuality || !selectedColor}
                        >
                          {t('selectLotsButton')}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                 ) : (
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{t('createOrderForm')}</DialogTitle>
                      <DialogDescription>
                        {t('enterCustomerDetails')}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="orderNumber">{t('orderNumberField')}</Label>
                          <Input
                            id="orderNumber"
                            value={orderNumber}
                            onChange={(e) => setOrderNumber(e.target.value)}
                            placeholder="ORD-001"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customerName">{t('customerNameField')}</Label>
                          <Input
                            id="customerName"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Customer Inc."
                          />
                        </div>
                      </div>

                      {/* Show selected lots summary */}
                      {selectedLots.length > 0 && (
                        <div className="space-y-2">
                          <Label>{t('selectedLotsLabel')}</Label>
                          <div className="border rounded p-4 bg-muted/50">
                            <div className="text-sm text-muted-foreground mb-2">
                              {t('quality')}: {selectedLots[0]?.quality} | {t('color')}: {selectedLots[0]?.color}
                            </div>
                            <div className="space-y-1">
                              {selectedLots.map((lot, index) => (
                                <div key={index} className="flex justify-between items-center text-sm">
                                  <span className="font-mono">{lot.lotNumber}</span>
                                  <span>{lot.rollCount} {t('rollsLabel')} ({lot.lineType})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                          {t('cancel')}
                        </Button>
                        <Button onClick={handleCreateOrder}>
                          {t('createOrderButton')}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                )}
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('orderManagementSection')}</CardTitle>
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
                  <TableCell className="font-mono">{order.order_number}</TableCell>
                  <TableCell>{order.customer_name}</TableCell>
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

          {orders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {t('noOrdersFound')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('orderDetailsField')} - {selectedOrder.order_number}</DialogTitle>
              <DialogDescription>
                {t('customer')}: {selectedOrder.customer_name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('lotNumberShort')}</TableHead>
                    <TableHead>{t('qualityField')}</TableHead>
                    <TableHead>{t('colorField')}</TableHead>
                    <TableHead>{t('rollsShort')}</TableHead>
                    <TableHead>{t('typeShort')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.order_lots.map((orderLot) => (
                    <TableRow key={orderLot.id}>
                      <TableCell className="font-mono">{orderLot.lot.lot_number}</TableCell>
                      <TableCell>{orderLot.quality}</TableCell>
                      <TableCell>{orderLot.color}</TableCell>
                      <TableCell>{orderLot.roll_count}</TableCell>
                      <TableCell>
                        <Badge variant={orderLot.line_type === 'sample' ? 'secondary' : 'outline'}>
                          {orderLot.line_type}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Print Dialog */}
      <OrderPrintDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        order={orderToPrint}
      />

      {/* Multi-Quality Order Dialog */}
      <MultiQualityOrderDialog
        open={showMultiQualityDialog}
        onOpenChange={setShowMultiQualityDialog}
        availableQualities={availableQualities}
        onProceed={(selections) => {
          // Navigate to lot selection with multiple quality/color combinations
          const params = new URLSearchParams();
          selections.forEach((selection, index) => {
            params.append(`quality_${index}`, selection.quality);
            params.append(`color_${index}`, selection.color);
          });
          navigate(`/lot-selection?multi=true&${params.toString()}`);
          setShowMultiQualityDialog(false);
        }}
      />

      {/* Bulk Upload Dialog */}
      <OrderBulkUpload
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        onUpload={async (items) => {
          try {
            // Group items by customer if they have the same customer
            const ordersByCustomer = new Map();
            
            items.forEach(item => {
              const customerKey = item.quality + '-' + item.color; // Group by quality-color for now
              if (!ordersByCustomer.has(customerKey)) {
                ordersByCustomer.set(customerKey, []);
              }
              ordersByCustomer.get(customerKey).push(item);
            });

            let createdOrders = 0;
            for (const [key, orderItems] of ordersByCustomer) {
              // Create order
              const orderNumber = `BULK-${Date.now()}-${createdOrders + 1}`;
              const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                  order_number: orderNumber,
                  customer_name: `Bulk Order ${createdOrders + 1}`,
                  created_by: profile?.user_id,
                })
                .select()
                .single();

              if (orderError) throw orderError;

              // Find and create order lots
              for (const item of orderItems) {
                const { data: lots, error: lotError } = await supabase
                  .from('lots')
                  .select('id')
                  .eq('lot_number', item.lot_number)
                  .eq('status', 'in_stock')
                  .gte('roll_count', item.roll_count)
                  .single();

                if (lotError || !lots) {
                  toast.error(`Lot ${item.lot_number} not found or insufficient stock`);
                  continue;
                }

                await supabase
                  .from('order_lots')
                  .insert({
                    order_id: orderData.id,
                    lot_id: lots.id,
                    roll_count: item.roll_count,
                    line_type: item.line_type,
                    quality: item.quality || '',
                    color: item.color || '',
                  });
              }
              createdOrders++;
            }

            toast.success(`Created ${createdOrders} orders from bulk upload`);
            fetchOrders();
            setShowBulkUpload(false);
          } catch (error: any) {
            toast.error('Bulk upload failed: ' + error.message);
          }
        }}
      />

      {/* Sample Order Dialog */}
      <SampleOrderDialog
        open={showSampleDialog}
        onOpenChange={setShowSampleDialog}
        onCreateSample={async (customerName, selectedLots) => {
          try {
            const orderNumber = `SAMPLE-${Date.now()}`;
            
            // Create sample order
            const { data: orderData, error: orderError } = await supabase
              .from('orders')
              .insert({
                order_number: orderNumber,
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

            toast.success(`Sample order ${orderNumber} created successfully`);
            fetchOrders();
            setShowSampleDialog(false);
          } catch (error: any) {
            toast.error('Failed to create sample order: ' + error.message);
          }
        }}
      />

      {/* Bulk Upload Dialog */}
      <OrderBulkUpload
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onUpload={async (items) => {
          try {
            if (!profile?.user_id) {
              toast.error('User not authenticated');
              return;
            }

            const { data: newOrder, error: orderError } = await supabase
              .from('orders')
              .insert([{
                order_number: `ORD-${Date.now()}`,
                customer_name: `Bulk Order - ${new Date().toLocaleDateString()}`,
                created_by: profile.user_id
              }])
              .select()
              .single();

            if (orderError || !newOrder) throw new Error('Failed to create order');

            for (const item of items) {
              const { data: lotData } = await supabase
                .from('lots')
                .select('id')
                .eq('lot_number', item.lot_number)
                .eq('status', 'in_stock')
                .single();

              if (lotData) {
                await supabase
                  .from('order_lots')
                  .insert({
                    order_id: newOrder.id,
                    lot_id: lotData.id,
                    quality: item.quality,
                    color: item.color,
                    roll_count: item.roll_count,
                    line_type: item.line_type
                  });
              }
            }

            await supabase
              .from('order_queue')
              .insert({
                order_id: newOrder.id,
                submitted_by: profile.user_id,
                status: 'pending_approval'
              });

            toast.success(`Bulk order created and sent to approval queue`);
            setBulkUploadOpen(false);
            setOrderToPrint(newOrder);
            setShowPrintDialog(true);
            fetchOrders();
          } catch (error) {
            console.error('Error creating bulk order:', error);
            toast.error('Failed to create bulk order');
          }
        }}
      />
    </div>
  );
};

export default Orders;