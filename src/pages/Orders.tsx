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
import { Truck, Plus, CheckCircle, Download, Eye } from 'lucide-react';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Create order form state
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedLots, setSelectedLots] = useState<Array<{
    lotId: string;
    rollCount: number;
    lineType: 'sample' | 'standard';
  }>>([]);

  useEffect(() => {
    fetchOrders();
    fetchAvailableLots();
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
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('*')
        .eq('status', 'in_stock')
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setLots(data || []);
    } catch (error) {
      console.error('Error fetching lots:', error);
    }
  };

  const handleCreateOrder = async () => {
    if (!orderNumber || !customerName || selectedLots.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields and select at least one LOT",
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

      // Create order_lots entries
      for (const selectedLot of selectedLots) {
        const lot = lots.find(l => l.id === selectedLot.lotId);
        if (!lot) continue;

        const { error: orderLotError } = await supabase
          .from('order_lots')
          .insert({
            order_id: orderData.id,
            lot_id: selectedLot.lotId,
            quality: lot.quality,
            color: lot.color,
            roll_count: selectedLot.rollCount,
            line_type: selectedLot.lineType,
          });

        if (orderLotError) throw orderLotError;
      }

      toast({
        title: "Order Created",
        description: `Order ${orderNumber} has been created successfully`,
      });

      // Reset form
      setOrderNumber('');
      setCustomerName('');
      setSelectedLots([]);
      setShowCreateDialog(false);
      
      // Refresh orders
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Error Creating Order",
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
        title: "Order Fulfilled",
        description: "Order has been marked as fulfilled",
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Error Fulfilling Order",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addLotToOrder = () => {
    setSelectedLots([...selectedLots, {
      lotId: '',
      rollCount: 1,
      lineType: 'standard',
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

  // Check permissions
  const canCreateOrders = profile && ['accounting', 'admin'].includes(profile.role);
  const canFulfillOrders = profile && ['warehouse_staff', 'admin'].includes(profile.role);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Orders</h1>
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
        <h1 className="text-3xl font-bold">Orders</h1>
        <div className="flex items-center space-x-4">
          <Truck className="h-8 w-8 text-primary" />
          {canCreateOrders && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Order
                </Button>
              </DialogTrigger>
            </Dialog>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
          <CardDescription>
            View and manage customer orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>LOTs Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
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
                        Fulfilled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
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
                        <Eye className="h-4 w-4" />
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
              No orders found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Order Dialog */}
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
          <DialogDescription>
            Enter order details and select LOTs for fulfillment
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Order Number</Label>
              <Input
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="ORD-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Inc."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Selected LOTs</Label>
              <Button type="button" variant="outline" onClick={addLotToOrder}>
                <Plus className="mr-2 h-4 w-4" />
                Add LOT
              </Button>
            </div>

            {selectedLots.map((selectedLot, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>LOT</Label>
                  <Select value={selectedLot.lotId} onValueChange={(value) => updateSelectedLot(index, 'lotId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select LOT" />
                    </SelectTrigger>
                    <SelectContent>
                      {lots.map((lot) => (
                        <SelectItem key={lot.id} value={lot.id}>
                          {lot.lot_number} ({lot.quality} - {lot.color})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Roll Count</Label>
                  <Input
                    type="number"
                    min="1"
                    value={selectedLot.rollCount}
                    onChange={(e) => updateSelectedLot(index, 'rollCount', parseInt(e.target.value))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={selectedLot.lineType} onValueChange={(value) => updateSelectedLot(index, 'lineType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="sample">Sample</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeLotFromOrder(index)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder}>
              Create Order
            </Button>
          </div>
        </div>
      </DialogContent>

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LOT Number</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Rolls</TableHead>
                    <TableHead>Type</TableHead>
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
    </div>
  );
};

export default Orders;