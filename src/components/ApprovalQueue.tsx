import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle, XCircle, Eye, Clock, AlertTriangle } from 'lucide-react';

interface LotQueueItem {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  warehouse_location: string;
  status: string;
  created_at: string;
  created_by: string;
}

interface OrderQueueItem {
  id: string;
  order_id: string;
  status: string;
  submitted_at: string;
  submitted_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

export const ApprovalQueue: React.FC = () => {
  const [lotQueue, setLotQueue] = useState<LotQueueItem[]>([]);
  const [orderQueue, setOrderQueue] = useState<OrderQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  
  const { hasRole, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (hasRole('senior_manager') || hasRole('admin')) {
      fetchQueues();
    }
  }, [hasRole]);

  const fetchQueues = async () => {
    setLoading(true);
    try {
      // Fetch lot queue
      const { data: lotData, error: lotError } = await supabase
        .from('lot_queue')
        .select('*')
        .eq('status', 'pending_completion')
        .order('created_at', { ascending: false });

      if (lotError) throw lotError;

      // Fetch order queue
      const { data: orderData, error: orderError } = await supabase
        .from('order_queue')
        .select('*')
        .eq('status', 'pending_approval')
        .order('submitted_at', { ascending: false });

      if (orderError) throw orderError;

      setLotQueue(lotData || []);
      setOrderQueue(orderData || []);
    } catch (error) {
      console.error('Error fetching queues:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch approval queues.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLot = async (lotItem: LotQueueItem) => {
    try {
      // Move from queue to main lots table
      const { error: insertError } = await supabase
        .from('lots')
        .insert({
          lot_number: lotItem.lot_number,
          quality: lotItem.quality,
          color: lotItem.color,
          meters: lotItem.meters,
          roll_count: 1,
          warehouse_location: lotItem.warehouse_location,
          status: 'in_stock',
          supplier_id: '00000000-0000-0000-0000-000000000000' // Default supplier
        });

      if (insertError) throw insertError;

      // Remove from queue
      const { error: deleteError } = await supabase
        .from('lot_queue')
        .delete()
        .eq('id', lotItem.id);

      if (deleteError) throw deleteError;

      toast({
        title: 'Approved',
        description: `Lot ${lotItem.lot_number} has been approved and added to inventory.`
      });

      fetchQueues();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRejectLot = async (lotItem: LotQueueItem) => {
    try {
      const { error } = await supabase
        .from('lot_queue')
        .update({
          status: 'rejected'
        })
        .eq('id', lotItem.id);

      if (error) throw error;

      toast({
        title: 'Rejected',
        description: `Lot ${lotItem.lot_number} has been rejected.`
      });

      setShowRejectDialog(false);
      setRejectionReason('');
      fetchQueues();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleApproveOrder = async (orderItem: OrderQueueItem) => {
    try {
      const { error } = await supabase
        .from('order_queue')
        .update({
          status: 'approved',
          approved_by: profile?.user_id,
          approved_at: new Date().toISOString()
        })
        .eq('id', orderItem.id);

      if (error) throw error;

      toast({
        title: 'Approved',
        description: 'Order has been approved.'
      });

      fetchQueues();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRejectOrder = async (orderItem: OrderQueueItem) => {
    try {
      const { error } = await supabase
        .from('order_queue')
        .update({
          status: 'rejected',
          approved_by: profile?.user_id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', orderItem.id);

      if (error) throw error;

      toast({
        title: 'Rejected',
        description: 'Order has been rejected.'
      });

      setShowRejectDialog(false);
      setRejectionReason('');
      fetchQueues();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  if (!hasRole('senior_manager') && !hasRole('admin')) {
    return (
      <div className="text-center text-muted-foreground">
        You don't have permission to view approval queues.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Approval Queues</h2>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {lotQueue.length + orderQueue.length} Pending
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            Inventory Changes
            {lotQueue.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {lotQueue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            Order Changes
            {orderQueue.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {orderQueue.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Pending Inventory Changes</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : lotQueue.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No pending inventory changes
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Meters</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotQueue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.lot_number}</TableCell>
                        <TableCell>{item.quality}</TableCell>
                        <TableCell>{item.color}</TableCell>
                        <TableCell>{item.meters}m</TableCell>
                        <TableCell>{item.warehouse_location}</TableCell>
                        <TableCell>{formatDate(item.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproveLot(item)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowRejectDialog(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Pending Order Changes</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : orderQueue.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No pending order changes
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderQueue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.order_id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.status}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(item.submitted_at)}</TableCell>
                        <TableCell>{item.submitted_by}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproveOrder(item)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowRejectDialog(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rejection Reason</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedItem) {
                    if ('lot_number' in selectedItem) {
                      handleRejectLot(selectedItem);
                    } else {
                      handleRejectOrder(selectedItem);
                    }
                  }
                }}
                disabled={!rejectionReason.trim()}
              >
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};