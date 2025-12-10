import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { CheckCircle, XCircle, Eye, Clock, AlertTriangle, Package } from 'lucide-react';

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

interface FieldEditQueueItem {
  id: string;
  table_name: string;
  record_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string;
  submitted_by: string;
  submitted_at: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

interface CatalogQueueItem {
  id: string;
  code: string;
  color_name: string;
  lastro_sku_code: string;
  type: string;
  created_at: string;
  created_by_user_id: string | null;
}

export const ApprovalQueue: React.FC = () => {
  const navigate = useNavigate();
  const [lotQueue, setLotQueue] = useState<LotQueueItem[]>([]);
  const [orderQueue, setOrderQueue] = useState<OrderQueueItem[]>([]);
  const [fieldEditQueue, setFieldEditQueue] = useState<FieldEditQueueItem[]>([]);
  const [catalogQueue, setCatalogQueue] = useState<CatalogQueueItem[]>([]);
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

      // Fetch field edit queue
      const { data: fieldEditData, error: fieldEditError } = await supabase
        .from('field_edit_queue')
        .select('*')
        .eq('status', 'pending_approval')
        .order('submitted_at', { ascending: false });

      if (fieldEditError) throw fieldEditError;

      // Fetch pending catalog items
      const { data: catalogData, error: catalogError } = await supabase
        .from('catalog_items')
        .select('id, code, color_name, lastro_sku_code, type, created_at, created_by_user_id')
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      if (catalogError) throw catalogError;

      setLotQueue(lotData || []);
      setOrderQueue(orderData || []);
      setFieldEditQueue(fieldEditData || []);
      setCatalogQueue(catalogData || []);
    } catch (error) {
      console.error('Error fetching queues:', error);
        toast({
          title: t('error') as string,
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
        title: t('approved') as string,
        description: `${t('lotNumber')} ${lotItem.lot_number} ${t('lotApprovedToast')}`
      });

      fetchQueues();
    } catch (error: any) {
      toast({
        title: t('error') as string,
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
        title: t('rejected') as string,
        description: `${t('lotNumber')} ${lotItem.lot_number} ${t('lotRejectedToast')}`
      });

      setShowRejectDialog(false);
      setRejectionReason('');
      fetchQueues();
    } catch (error: any) {
      toast({
        title: t('error') as string,
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
        title: t('approved') as string,
        description: t('orderApprovedToast') as string
      });

      fetchQueues();
    } catch (error: any) {
      toast({
        title: t('error') as string,
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
        title: t('rejected') as string,
        description: t('orderRejectedToast') as string
      });

      setShowRejectDialog(false);
      setRejectionReason('');
      fetchQueues();
    } catch (error: any) {
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleApproveFieldEdit = async (fieldEditItem: FieldEditQueueItem) => {
    try {
      // Apply the field change to the actual table
      if (fieldEditItem.table_name === 'lots') {
        if (fieldEditItem.field_name === 'quality') {
          // Update all lots with the old quality to the new quality
          const { error } = await supabase
            .from('lots')
            .update({ quality: fieldEditItem.new_value })
            .eq('quality', fieldEditItem.old_value);
          if (error) throw error;
        } else if (fieldEditItem.field_name === 'color') {
          // This would need more context about which quality to update
          // For now, just approve the change in the queue
        } else if (fieldEditItem.record_id) {
          // Update specific record
          const { error } = await supabase
            .from('lots')
            .update({ [fieldEditItem.field_name]: fieldEditItem.new_value })
            .eq('id', fieldEditItem.record_id);
          if (error) throw error;
        }
      }

      // Mark as approved in the queue
      const { error: updateError } = await supabase
        .from('field_edit_queue')
        .update({
          status: 'approved',
          approved_by: profile?.user_id,
          approved_at: new Date().toISOString()
        })
        .eq('id', fieldEditItem.id);

      if (updateError) throw updateError;

      toast({
        title: t('approved') as string,
        description: `Field change for ${fieldEditItem.field_name} has been approved`
      });

      fetchQueues();
    } catch (error: any) {
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRejectFieldEdit = async (fieldEditItem: FieldEditQueueItem) => {
    try {
      const { error } = await supabase
        .from('field_edit_queue')
        .update({
          status: 'rejected',
          approved_by: profile?.user_id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', fieldEditItem.id);

      if (error) throw error;

      toast({
        title: t('rejected') as string,
        description: `Field change for ${fieldEditItem.field_name} has been rejected`
      });

      setShowRejectDialog(false);
      setRejectionReason('');
      fetchQueues();
    } catch (error: any) {
      toast({
        title: t('error') as string,
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
        {t('approvalPermissionDenied')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('approvalQueues')}</h2>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {lotQueue.length + orderQueue.length + fieldEditQueue.length + catalogQueue.length} {t('pendingCount')}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            {t('inventoryChanges')}
            {lotQueue.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {lotQueue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            {t('orderChanges')}
            {orderQueue.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {orderQueue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('catalogItemsTab')}
            {catalogQueue.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {catalogQueue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="fields" className="flex items-center gap-2">
            {t('fieldChanges')}
            {fieldEditQueue.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {fieldEditQueue.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>{t('pendingInventoryChanges')}</CardTitle>
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
                  {t('noPendingInventoryChanges')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('lotNumber')}</TableHead>
                      <TableHead>{t('quality')}</TableHead>
                      <TableHead>{t('color')}</TableHead>
                      <TableHead>{t('meters')}</TableHead>
                      <TableHead>{t('location')}</TableHead>
                      <TableHead>{t('submitted')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
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
                              {t('approve')}
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
                              {t('reject')}
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
              <CardTitle>{t('pendingOrderChanges')}</CardTitle>
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
                  {t('noPendingOrderChanges')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('orderId')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>{t('submitted')}</TableHead>
                      <TableHead>{t('submittedBy')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
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
                              {t('approve')}
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
                              {t('reject')}
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

        <TabsContent value="catalog">
          <Card>
            <CardHeader>
              <CardTitle>{t('pendingCatalogItems')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : catalogQueue.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t('noPendingCatalogItems')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('catalog.skuCode')}</TableHead>
                      <TableHead>{t('qualityCode')}</TableHead>
                      <TableHead>{t('color')}</TableHead>
                      <TableHead>{t('type')}</TableHead>
                      <TableHead>{t('submitted')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogQueue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.lastro_sku_code}</TableCell>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.color_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.type}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(item.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/catalog/${item.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {t('view')}
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

        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <CardTitle>{t('pendingFieldChanges')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : fieldEditQueue.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t('noPendingFieldChanges')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('field')}</TableHead>
                      <TableHead>{t('from')}</TableHead>
                      <TableHead>{t('to')}</TableHead>
                      <TableHead>{t('table')}</TableHead>
                      <TableHead>{t('submitted')}</TableHead>
                      <TableHead>{t('submittedBy')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fieldEditQueue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.field_name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.old_value || '-'}</TableCell>
                        <TableCell className="font-medium">{item.new_value}</TableCell>
                        <TableCell>{item.table_name}</TableCell>
                        <TableCell>{formatDate(item.submitted_at)}</TableCell>
                        <TableCell>{item.submitted_by}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproveFieldEdit(item)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {t('approve')}
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
                              {t('reject')}
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
            <DialogTitle>{t('rejectItem')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('rejectionReason')}</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('rejectionReasonPlaceholder') as string}
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedItem) {
                    if ('lot_number' in selectedItem) {
                      handleRejectLot(selectedItem);
                    } else if ('order_id' in selectedItem) {
                      handleRejectOrder(selectedItem);
                    } else {
                      handleRejectFieldEdit(selectedItem);
                    }
                  }
                }}
                disabled={!rejectionReason.trim()}
              >
                {t('reject')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};