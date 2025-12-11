import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';
import { TableExportButton, exportToCSV } from '@/components/ui/table-export-button';
import { ViewDetailsButton } from '@/components/ui/view-details-button';
import { format } from 'date-fns';

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
  const { t } = useLanguage();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingItem, setProcessingItem] = useState<string | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  
  // Sorting state
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>({
    key: 'submitted_at',
    direction: 'desc'
  });

  const canCreateOrders = hasPermission('orders', 'createorders');

  useEffect(() => {
    if (!permissionsLoading) {
      fetchQueueItems();
    }
  }, [permissionsLoading, page, pageSize, currentSort]);

  const fetchQueueItems = async () => {
    setLoading(true);
    try {
      // Get total count
      const { count } = await supabase
        .from('order_queue')
        .select('*', { count: 'exact', head: true });
      
      setTotalCount(count || 0);
      
      // Get paginated data
      let query = supabase
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
        `);

      // Apply sorting
      if (currentSort) {
        query = query.order(currentSort.key, { ascending: currentSort.direction === 'asc' });
      } else {
        query = query.order('submitted_at', { ascending: false });
      }
      
      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;
      setQueueItems((data || []) as QueueItem[]);
    } catch (error) {
      console.error('Error fetching queue items:', error);
      toast.error(String(t('orderQueue.fetchError')));
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

      toast.success(approved ? String(t('orderQueue.approvedSuccess')) : String(t('orderQueue.rejectedSuccess')));
      setRejectionReason('');
      setSelectedItem(null);
      fetchQueueItems();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error(String(t('orderQueue.processError')));
    } finally {
      setProcessingItem(null);
    }
  };
  
  const handleSort = (key: string, direction: SortDirection) => {
    setCurrentSort(direction ? { key, direction } : null);
    setPage(1);
  };
  
  const handleExport = () => {
    const exportData = queueItems.map(item => ({
      order_number: item.order.order_number,
      customer_name: item.order.customer_name,
      status: item.status,
      lots_count: item.order.order_lots?.length || 0,
      total_rolls: item.order.order_lots?.reduce((sum, lot) => sum + lot.roll_count, 0) || 0,
      submitted_at: format(new Date(item.submitted_at), 'yyyy-MM-dd HH:mm:ss'),
      approved_at: item.approved_at ? format(new Date(item.approved_at), 'yyyy-MM-dd HH:mm:ss') : '',
      rejection_reason: item.rejection_reason || ''
    }));
    
    exportToCSV(exportData, [
      { key: 'order_number', label: String(t('orderQueue.orderNumber')) },
      { key: 'customer_name', label: String(t('customer')) },
      { key: 'status', label: String(t('status')) },
      { key: 'lots_count', label: String(t('orderQueue.lotsCount')) },
      { key: 'total_rolls', label: String(t('orderQueue.totalRolls')) },
      { key: 'submitted_at', label: String(t('orderQueue.submitted')) },
      { key: 'approved_at', label: String(t('orderQueue.processedAt')) },
      { key: 'rejection_reason', label: String(t('orderQueue.rejectionReason')) }
    ], `order-queue-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />{String(t('orderQueue.statusPending'))}</Badge>;
      case 'approved':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />{String(t('orderQueue.statusApproved'))}</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{String(t('orderQueue.statusRejected'))}</Badge>;
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
    return <div className="text-sm text-muted-foreground">{String(t('loading'))}</div>;
  }

  if (!canCreateOrders) {
    return (
      <Alert>
        <AlertDescription>
          {String(t('orderQueue.noPermission'))}
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
        <h1 className="text-3xl font-bold">{String(t('orderQueue.title'))}</h1>
        <div className="flex gap-2">
          <Badge variant="secondary">{pendingItems.length} {String(t('orderQueue.pending'))}</Badge>
          <Badge variant="outline">{processedItems.length} {String(t('orderQueue.processed'))}</Badge>
          <TableExportButton onExport={handleExport} disabled={queueItems.length === 0} />
        </div>
      </div>

      {/* Pending Approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {String(t('orderQueue.pendingApprovals'))} ({pendingItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{String(t('orderQueue.noPending'))}</p>
          ) : (
            <>
              <DataTablePagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              />
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      label={String(t('orderQueue.orderNumber'))}
                      sortKey="order_id"
                      currentSort={currentSort}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label={String(t('customer'))}
                      sortKey="order_id"
                      currentSort={currentSort}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label={String(t('orderQueue.lotsCount'))}
                      sortKey=""
                      currentSort={currentSort}
                      onSort={() => {}}
                    />
                    <SortableTableHead
                      label={String(t('orderQueue.totalRolls'))}
                      sortKey=""
                      currentSort={currentSort}
                      onSort={() => {}}
                    />
                    <SortableTableHead
                      label={String(t('orderQueue.submitted'))}
                      sortKey="submitted_at"
                      currentSort={currentSort}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label={String(t('actions'))}
                      sortKey=""
                      currentSort={currentSort}
                      onSort={() => {}}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.order.order_number}</TableCell>
                      <TableCell>{item.order.customer_name}</TableCell>
                      <TableCell>{item.order.order_lots?.length || 0} {String(t('orderQueue.lots'))}</TableCell>
                      <TableCell>
                        {item.order.order_lots?.reduce((sum, lot) => sum + lot.roll_count, 0) || 0}
                      </TableCell>
                      <TableCell>{formatDate(item.submitted_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <div>
                                <ViewDetailsButton
                                  onClick={() => setSelectedItem(item)}
                                  showLabel={false}
                                />
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl">
                              <DialogHeader>
                                <DialogTitle>{String(t('orderQueue.orderDetails'))} - {item.order.order_number}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>{String(t('customer'))}</Label>
                                    <p className="text-sm text-muted-foreground">{item.order.customer_name}</p>
                                  </div>
                                  <div>
                                    <Label>{String(t('orderQueue.submittedAt'))}</Label>
                                    <p className="text-sm text-muted-foreground">{formatDate(item.submitted_at)}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label>{String(t('orderQueue.orderLots'))}</Label>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <SortableTableHead label={String(t('lotNumber'))} sortKey="" currentSort={null} onSort={() => {}} />
                                        <SortableTableHead label={String(t('quality'))} sortKey="" currentSort={null} onSort={() => {}} />
                                        <SortableTableHead label={String(t('color'))} sortKey="" currentSort={null} onSort={() => {}} />
                                        <SortableTableHead label={String(t('rolls'))} sortKey="" currentSort={null} onSort={() => {}} />
                                        <SortableTableHead label={String(t('meters'))} sortKey="" currentSort={null} onSort={() => {}} />
                                        <SortableTableHead label={String(t('orderQueue.ageDays'))} sortKey="" currentSort={null} onSort={() => {}} />
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
                                  <Label>{String(t('orderQueue.rejectionReasonOptional'))}</Label>
                                  <Textarea
                                    placeholder={String(t('orderQueue.enterRejectionReason'))}
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
                                    {String(t('reject'))}
                                  </Button>
                                  <Button
                                    onClick={() => handleApproval(item.id, true)}
                                    disabled={processingItem === item.id}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    {String(t('approve'))}
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
              
              <DataTablePagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Processed Orders */}
      {processedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{String(t('orderQueue.recentlyProcessed'))}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    label={String(t('orderQueue.orderNumber'))}
                    sortKey="order_id"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('customer'))}
                    sortKey=""
                    currentSort={currentSort}
                    onSort={() => {}}
                  />
                  <SortableTableHead
                    label={String(t('status'))}
                    sortKey="status"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('orderQueue.processedAt'))}
                    sortKey="approved_at"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('actions'))}
                    sortKey=""
                    currentSort={currentSort}
                    onSort={() => {}}
                  />
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
                              <DialogTitle>{String(t('orderQueue.rejectionReason'))}</DialogTitle>
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