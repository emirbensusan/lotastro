import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, Eye, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface QueueItem {
  id: string;
  order_id: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  submitted_at: string;
  submitted_by: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  order: {
    id: string;
    order_number: string;
    customer_name: string;
    created_at: string;
    order_lots: Array<{
      id: string;
      quality: string;
      color: string;
      roll_count: number;
      lot_id: string;
      lots: {
        lot_number: string;
        meters: number;
        entry_date: string;
      };
    }>;
  };
}

const OrderQueue: React.FC = () => {
  const { hasRole, profile, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingItem, setProcessingItem] = useState<string | null>(null);

  const canCreateOrders = hasPermission('orders', 'createorders');

  useEffect(() => {
    if (!permissionsLoading) {
      fetchQueueItems();
    }
  }, [permissionsLoading]);

  const fetchQueueItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_queue')
        .select(`
          *,
          order:orders(
            id,
            order_number,
            customer_name,
            created_at,
            order_lots(
              id,
              quality,
              color,
              roll_count,
              lot_id,
              lots(
                lot_number,
                meters,
                entry_date
              )
            )
          )
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setQueueItems((data || []) as QueueItem[]);
    } catch (error) {
      console.error('Error fetching queue items:', error);
      toast.error('Failed to fetch queue items');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (itemId: string, approved: boolean) => {
    if (!profile?.user_id) return;
    
    setProcessingItem(itemId);
    try {
      const updateData: any = {
        status: approved ? 'approved' : 'rejected',
        approved_by: profile.user_id,
        approved_at: new Date().toISOString(),
      };

      if (!approved && rejectionReason.trim()) {
        updateData.rejection_reason = rejectionReason.trim();
      }

      const { error: updateError } = await supabase
        .from('order_queue')
        .update(updateData)
        .eq('id', itemId);

      if (updateError) throw updateError;

      if (approved) {
        // Update inventory status for approved orders
        const item = queueItems.find(q => q.id === itemId);
        if (item?.order.order_lots) {
          for (const orderLot of item.order.order_lots) {
            await supabase
              .from('lots')
              .update({ status: 'out_of_stock' })
              .eq('id', orderLot.lot_id);
          }
        }
      }

      toast.success(approved ? 'Order approved successfully' : 'Order rejected');
      setRejectionReason('');
      setSelectedItem(null);
      fetchQueueItems();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error('Failed to process approval');
    } finally {
      setProcessingItem(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || permissionsLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!canCreateOrders) {
    return (
      <Alert>
        <AlertDescription>
          You don't have permission to access the order queue. Contact your administrator.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const pendingItems = queueItems.filter(item => item.status === 'pending_approval');
  const processedItems = queueItems.filter(item => item.status !== 'pending_approval');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Order Approval Queue</h1>
        <div className="flex gap-2">
          <Badge variant="secondary">{pendingItems.length} Pending</Badge>
          <Badge variant="outline">{processedItems.length} Processed</Badge>
        </div>
      </div>

      {/* Pending Approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Approvals ({pendingItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No orders pending approval</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Lots</TableHead>
                  <TableHead>Total Rolls</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.order.order_number}</TableCell>
                    <TableCell>{item.order.customer_name}</TableCell>
                    <TableCell>{item.order.order_lots?.length || 0} lots</TableCell>
                    <TableCell>
                      {item.order.order_lots?.reduce((sum, lot) => sum + lot.roll_count, 0) || 0}
                    </TableCell>
                    <TableCell>{formatDate(item.submitted_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedItem(item)}>
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>Order Details - {item.order.order_number}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Customer</Label>
                                  <p className="text-sm text-muted-foreground">{item.order.customer_name}</p>
                                </div>
                                <div>
                                  <Label>Submitted At</Label>
                                  <p className="text-sm text-muted-foreground">{formatDate(item.submitted_at)}</p>
                                </div>
                              </div>
                              
                              <div>
                                <Label>Order Lots</Label>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Lot Number</TableHead>
                                      <TableHead>Quality</TableHead>
                                      <TableHead>Color</TableHead>
                                      <TableHead>Rolls</TableHead>
                                      <TableHead>Meters</TableHead>
                                      <TableHead>Age (days)</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {item.order.order_lots?.map((lot) => (
                                      <TableRow key={lot.id}>
                                        <TableCell>{lot.lots.lot_number}</TableCell>
                                        <TableCell>{lot.quality}</TableCell>
                                        <TableCell>{lot.color}</TableCell>
                                        <TableCell>{lot.roll_count}</TableCell>
                                        <TableCell>{lot.lots.meters}</TableCell>
                                        <TableCell>
                                          {Math.floor(
                                            (new Date().getTime() - new Date(lot.lots.entry_date).getTime()) / 
                                            (1000 * 60 * 60 * 24)
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>

                              <div className="space-y-2">
                                <Label>Rejection Reason (optional)</Label>
                                <Textarea
                                  placeholder="Enter reason for rejection..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                />
                              </div>

                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="destructive"
                                  onClick={() => handleApproval(item.id, false)}
                                  disabled={processingItem === item.id}
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                                <Button
                                  onClick={() => handleApproval(item.id, true)}
                                  disabled={processingItem === item.id}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Processed Orders */}
      {processedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedItems.slice(0, 10).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.order.order_number}</TableCell>
                    <TableCell>{item.order.customer_name}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>{item.approved_at ? formatDate(item.approved_at) : '-'}</TableCell>
                    <TableCell>
                      {item.rejection_reason && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Rejection Reason</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-muted-foreground">{item.rejection_reason}</p>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrderQueue;