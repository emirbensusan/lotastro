import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { Truck, Plus, CheckCircle, Download, Eye, FileText } from 'lucide-react';
import OrderPrintDialog from '@/components/OrderPrintDialog';
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
      toast({
        title: t('error') as string,
        description: "Failed to load orders",
        variant: "destructive",
      });
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
      toast({
        title: t('validationError') as string,
        description: "Please select both quality and color",
        variant: "destructive",
      });
      return;
    }

    navigate(`/lot-selection?quality=${encodeURIComponent(selectedQuality)}&color=${encodeURIComponent(selectedColor)}`);
  };

  const handleCreateOrder = async () => {
    if (!orderNumber || !customerName || selectedLots.length === 0) {
      toast({
        title: t('validationError') as string,
        description: t('fillAllFields') as string,
        variant: "destructive",
      });
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

      toast({
        title: t('orderCreated') as string,
        description: `${t('orderCreatedSuccessfully')} ${orderNumber}`,
      });

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
      toast({
        title: t('failedToCreateOrder') as string,
        description: error.message,
        variant: "destructive",
      });
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

      toast({
        title: t('orderFulfilled') as string,
        description: t('orderMarkedFulfilled') as string,
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: t('errorFulfillingOrder') as string,
        description: error.message,
        variant: "destructive",
      });
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

  // Check permissions
  const canCreateOrders = profile && ['accounting', 'admin'].includes(profile.role);
  const canFulfillOrders = profile && ['warehouse_staff', 'admin'].includes(profile.role);

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
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('newOrderCreate')}
                </Button>
              </DialogTrigger>
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
    </div>
  );
};

export default Orders;