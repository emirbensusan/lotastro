import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ReceiveStockDialog } from '@/components/ReceiveStockDialog';
import BatchReceiveDialog from '@/components/BatchReceiveDialog';
import { 
  PackageCheck, 
  Building2, 
  Calendar, 
  AlertCircle, 
  CheckSquare,
  Package,
  Eye,
  TruckIcon,
  Timer,
  AlertTriangle,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { format, isToday, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface IncomingStockWithSupplier {
  id: string;
  quality: string;
  color: string;
  expected_meters: number;
  received_meters: number;
  reserved_meters: number;
  supplier_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  expected_arrival_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  suppliers: {
    id: string;
    name: string;
  };
}

interface GoodsInReceipt {
  id: string;
  incoming_stock_id: string | null;
  received_at: string;
  received_by: string;
  defect_notes: string | null;
  incoming_stock?: {
    invoice_number: string | null;
    quality: string;
    color: string;
  };
  profiles?: {
    full_name: string | null;
  };
}

export default function GoodsReceipt() {
  const [pendingStock, setPendingStock] = useState<IncomingStockWithSupplier[]>([]);
  const [receipts, setReceipts] = useState<GoodsInReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<IncomingStockWithSupplier | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  
  // Unreceive & Delete dialogs
  const [unreceiveDialogOpen, setUnreceiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedForUnreceive, setSelectedForUnreceive] = useState<IncomingStockWithSupplier | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<IncomingStockWithSupplier | null>(null);
  const [unreceiveLots, setUnreceiveLots] = useState<any[]>([]);
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set());
  const [deleteReason, setDeleteReason] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    if (!permissionsLoading) {
      if (hasPermission('inventory', 'receiveincoming')) {
        if (viewMode === 'pending') {
          fetchPendingStock();
        } else {
          fetchReceiptHistory();
        }
      } else {
        setLoading(false);
      }
    }
  }, [viewMode, permissionsLoading, hasPermission]);

  const fetchPendingStock = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('incoming_stock')
        .select(`
          *,
          suppliers (
            id,
            name
          )
        `)
        .in('status', ['pending_inbound', 'partially_received'])
        .order('expected_arrival_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      
      // Filter to only show items with remaining meters
      const filtered = (data || []).filter(item => 
        item.expected_meters - item.received_meters > 0
      );
      
      setPendingStock(filtered as IncomingStockWithSupplier[]);
    } catch (error: any) {
      console.error('Error fetching pending stock:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending receipts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReceiptHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('goods_in_receipts')
        .select(`
          *,
          incoming_stock (
            invoice_number,
            quality,
            color
          ),
          profiles (
            full_name
          )
        `)
        .order('received_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setReceipts(data as GoodsInReceipt[]);
    } catch (error: any) {
      console.error('Error fetching receipt history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load receipt history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (item: IncomingStockWithSupplier) => {
    if (!item.expected_arrival_date) return false;
    return isPast(new Date(item.expected_arrival_date)) && !isToday(new Date(item.expected_arrival_date));
  };

  const isExpectedToday = (item: IncomingStockWithSupplier) => {
    if (!item.expected_arrival_date) return false;
    return isToday(new Date(item.expected_arrival_date));
  };

  const handleReceiveClick = (item: IncomingStockWithSupplier) => {
    setSelectedStock(item);
    setReceiveDialogOpen(true);
  };

  const toggleBatchSelection = (id: string) => {
    const newSelection = new Set(selectedForBatch);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedForBatch(newSelection);
  };

  const handleBatchReceive = () => {
    const selected = pendingStock.filter(item => selectedForBatch.has(item.id));
    if (selected.length === 0) return;
    setBatchDialogOpen(true);
  };

  const refreshData = () => {
    setSelectedForBatch(new Set());
    setBatchMode(false);
    if (viewMode === 'pending') {
      fetchPendingStock();
    } else {
      fetchReceiptHistory();
    }
  };

  // Fetch lots for unreceiving
  const fetchLotsForUnreceive = async (incomingStockId: string): Promise<any[]> => {
    try {
      // Query lots via goods_in_receipts and goods_in_rows
      const result: any = await supabase
        .from('goods_in_rows')
        .select(`
          lot_id,
          lots!inner (
            id,
            lot_number,
            quality,
            color,
            meters,
            roll_count,
            entry_date,
            status
          ),
          goods_in_receipts!inner (
            incoming_stock_id
          )
        `)
        .eq('goods_in_receipts.incoming_stock_id', incomingStockId)
        .eq('lots.status', 'in_stock');
      
      const { data, error } = result;

      if (error) throw error;
      
      // Transform the data to extract just the lots
      const lots = data?.map((row: any) => row.lots).filter(Boolean) || [];
      return lots;
    } catch (error: any) {
      console.error('Error fetching lots:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to load lots',
        variant: 'destructive'
      });
      return [];
    }
  };

  // Handle unreceive button click
  const handleUnreceiveClick = async (item: IncomingStockWithSupplier) => {
    const lots = await fetchLotsForUnreceive(item.id);
    setUnreceiveLots(lots);
    setSelectedForUnreceive(item);
    setSelectedLotIds(new Set());
    setUnreceiveDialogOpen(true);
  };

  // Handle unreceive submit
  const handleUnreceiveSubmit = async () => {
    if (selectedLotIds.size === 0) {
      toast({
        title: String(t('validationError')),
        description: String(t('selectAtLeastOneLot')),
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);

    try {
      // For each selected lot, reverse its creation via the reverse-audit-action edge function
      for (const lotId of selectedLotIds) {
        // Find the CREATE audit entry for this lot
        const { data: auditEntry, error: auditError } = await supabase
          .from('audit_logs')
          .select('id')
          .eq('entity_type', 'lot')
          .eq('entity_id', lotId)
          .eq('action', 'CREATE')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (auditError || !auditEntry) {
          throw new Error(`Could not find audit entry for lot ${lotId}`);
        }

        // Call the reverse-audit-action edge function
        const { error: reverseError } = await supabase.functions.invoke('reverse-audit-action', {
          body: {
            audit_id: auditEntry.id,
            reason: `Unreceived from Goods Receipt for incoming stock ${selectedForUnreceive?.invoice_number || selectedForUnreceive?.id}`
          }
        });

        if (reverseError) {
          throw reverseError;
        }
      }

      toast({
        description: String(t('stockUnreceivedSuccess'))
      });

      setUnreceiveDialogOpen(false);
      setSelectedForUnreceive(null);
      setSelectedLotIds(new Set());
      refreshData();
    } catch (error: any) {
      console.error('Error unreceiving stock:', error);
      toast({
        title: String(t('error')),
        description: error.message || 'Failed to unreceive stock',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  // Handle delete button click
  const handleDeleteClick = (item: IncomingStockWithSupplier) => {
    setSelectedForDelete(item);
    setDeleteReason('');
    setDeleteDialogOpen(true);
  };

  // Handle delete submit
  const handleDeleteSubmit = async () => {
    if (!selectedForDelete) return;

    if (selectedForDelete.received_meters > 0) {
      toast({
        title: String(t('validationError')),
        description: String(t('cannotDeleteReceived')),
        variant: 'destructive'
      });
      return;
    }

    if (selectedForDelete.reserved_meters > 0) {
      const msg = t('cannotDeleteReserved') as string;
      toast({
        title: String(t('validationError')),
        description: msg.replace('{reserved}', selectedForDelete.reserved_meters.toString()),
        variant: 'destructive'
      });
      return;
    }

    if (!deleteReason.trim()) {
      toast({
        title: String(t('validationError')),
        description: String(t('reasonForReversal')),
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);

    try {
      // Delete the incoming stock entry
      const { error: deleteError } = await supabase
        .from('incoming_stock')
        .delete()
        .eq('id', selectedForDelete.id);

      if (deleteError) throw deleteError;

      // Log audit action
      await logAction(
        'DELETE',
        'incoming_stock',
        selectedForDelete.id,
        selectedForDelete.invoice_number || `${selectedForDelete.quality}-${selectedForDelete.color}`,
        selectedForDelete,
        null,
        String(t('deletedIncomingStockNote'))
          .replace('{invoice}', selectedForDelete.invoice_number || 'N/A')
          .replace('{quality}', selectedForDelete.quality)
          .replace('{color}', selectedForDelete.color)
          .replace('{meters}', selectedForDelete.expected_meters.toString())
          + ` | ${String(t('reason'))}: ${deleteReason}`
      );

      toast({
        description: String(t('incomingStockDeleted'))
      });

      setDeleteDialogOpen(false);
      setSelectedForDelete(null);
      setDeleteReason('');
      refreshData();
    } catch (error: any) {
      console.error('Error deleting incoming stock:', error);
      toast({
        title: String(t('error')),
        description: error.message || 'Failed to delete incoming stock',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const toggleLotSelection = (lotId: string) => {
    const newSelection = new Set(selectedLotIds);
    if (newSelection.has(lotId)) {
      newSelection.delete(lotId);
    } else {
      newSelection.add(lotId);
    }
    setSelectedLotIds(newSelection);
  };

  // Calculate summary stats
  const totalPendingShipments = pendingStock.length;
  const totalPendingMeters = pendingStock.reduce((sum, item) => 
    sum + (item.expected_meters - item.received_meters), 0
  );
  const expectedToday = pendingStock.filter(isExpectedToday).length;
  const overdue = pendingStock.filter(isOverdue).length;

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPermission('inventory', 'receiveincoming')) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Goods Receipt</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access the goods receipt module.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <PackageCheck className="h-8 w-8" />
          {t('goodsReceipt')}
        </h1>
        
        {viewMode === 'pending' && (
          <div className="flex gap-2">
            <Button
              variant={batchMode ? "default" : "outline"}
              onClick={() => {
                setBatchMode(!batchMode);
                setSelectedForBatch(new Set());
              }}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Batch Mode {batchMode && selectedForBatch.size > 0 && `(${selectedForBatch.size})`}
            </Button>
            
            {batchMode && selectedForBatch.size > 0 && (
              <Button onClick={handleBatchReceive}>
                <Package className="h-4 w-4 mr-2" />
                Receive Selected
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pendingShipments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TruckIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalPendingShipments}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalPendingMeters')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalPendingMeters.toFixed(2)}m</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('expectedToday')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">{expectedToday}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('overdue')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold text-destructive">{overdue}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'pending' | 'history')}>
        <TabsList>
          <TabsTrigger value="pending">
            {t('pendingReceipts')} ({totalPendingShipments})
          </TabsTrigger>
          <TabsTrigger value="history">
            {t('receiptHistory')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : pendingStock.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PackageCheck className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  No pending receipts
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  All incoming stock has been received
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingStock.map((item) => (
                <Card 
                  key={item.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-lg relative",
                    batchMode && selectedForBatch.has(item.id) && "ring-2 ring-primary"
                  )}
                  onClick={() => {
                    if (batchMode) {
                      toggleBatchSelection(item.id);
                    }
                  }}
                >
                  {batchMode && (
                    <div className="absolute top-3 right-3 z-10">
                      <Checkbox
                        checked={selectedForBatch.has(item.id)}
                        onCheckedChange={() => toggleBatchSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  <CardHeader>
                    <div className="flex justify-between items-start pr-8">
                      <div>
                        <CardTitle className="text-lg">{item.quality} - {item.color}</CardTitle>
                        {item.invoice_number && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('invoice')} {item.invoice_number}
                          </p>
                        )}
                      </div>
                      
                      {isOverdue(item) ? (
                        <Badge variant="destructive">{t('overdue')}</Badge>
                      ) : isExpectedToday(item) ? (
                        <Badge className="bg-blue-600 text-white">{t('expectedToday')}</Badge>
                      ) : (
                        <Badge variant="outline">{t('pending')}</Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{item.suppliers.name}</span>
                    </div>

                    {item.expected_arrival_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Expected: {format(new Date(item.expected_arrival_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('expected')}</span>
                        <span className="font-medium">{item.expected_meters}m</span>
                      </div>

                      {item.received_meters > 0 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('received')}</span>
                            <span className="font-medium text-green-600">{item.received_meters}m</span>
                          </div>
                          <Progress 
                            value={(item.received_meters / item.expected_meters) * 100}
                            className="h-2"
                          />
                        </>
                      )}

                      <div className="flex justify-between text-sm pt-1 border-t">
                        <span className="font-semibold">{t('remaining')}</span>
                        <span className="font-bold text-primary">
                          {(item.expected_meters - item.received_meters).toFixed(2)}m
                        </span>
                      </div>
                    </div>

                    {item.reserved_meters > 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {item.reserved_meters}m reserved
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>

                  {!batchMode && (
                    <CardFooter className="flex flex-col gap-2">
                      <Button 
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReceiveClick(item);
                        }}
                      >
                        <PackageCheck className="h-4 w-4 mr-2" />
                        {t('receiveStock')}
                      </Button>
                      
                      <div className="flex gap-2 w-full">
                        {/* Unreceive button - only show if stock has been received and user has permission */}
                        {item.received_meters > 0 && hasPermission('inventory', 'unreceiveincoming') && (
                          <Button 
                            variant="outline"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnreceiveClick(item);
                            }}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            {t('unreceiveStock')}
                          </Button>
                        )}
                        
                        {/* Delete button - only show if no stock received and user has permission */}
                        {hasPermission('inventory', 'deleteincoming') && (
                          <Button 
                            variant="destructive"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(item);
                            }}
                            disabled={item.reserved_meters > 0}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('deleteIncomingStock')}
                          </Button>
                        )}
                      </div>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-6">
          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent Receipts</CardTitle>
              </CardHeader>
              <CardContent>
                {receipts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No receipt history available
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt Date</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Received By</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.map((receipt) => (
                        <TableRow key={receipt.id}>
                          <TableCell>
                            {format(new Date(receipt.received_at), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            {receipt.incoming_stock?.invoice_number || '-'}
                          </TableCell>
                          <TableCell>{receipt.incoming_stock?.quality || '-'}</TableCell>
                          <TableCell>{receipt.incoming_stock?.color || '-'}</TableCell>
                          <TableCell>
                            {receipt.profiles?.full_name || 'Unknown'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {receipt.defect_notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ReceiveStockDialog
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        incomingStock={selectedStock}
        onSuccess={refreshData}
      />

      <BatchReceiveDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        selectedStock={pendingStock.filter(item => selectedForBatch.has(item.id))}
        onSuccess={refreshData}
      />

      {/* Unreceive Stock Dialog */}
      <Dialog open={unreceiveDialogOpen} onOpenChange={setUnreceiveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{String(t('unreceiveStockTitle'))}</DialogTitle>
            <DialogDescription>
              {selectedForUnreceive && String(t('unreceiveStockDesc'))
                .replace('{quality}', selectedForUnreceive.quality)
                .replace('{color}', selectedForUnreceive.color)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {String(t('unreceivingWillDelete'))}
              </AlertDescription>
            </Alert>

            <div>
              <div className="flex justify-between items-center mb-3">
                <Label className="text-base font-semibold">{String(t('lotsFromThisReceipt'))}</Label>
                {unreceiveLots.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedLotIds.size === unreceiveLots.length) {
                        setSelectedLotIds(new Set());
                      } else {
                        setSelectedLotIds(new Set(unreceiveLots.map(l => l.id)));
                      }
                    }}
                  >
                    {selectedLotIds.size === unreceiveLots.length ? 'Deselect All' : String(t('selectAll'))}
                  </Button>
                )}
              </div>

              {unreceiveLots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{String(t('noLotsFound'))}</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>{String(t('lotNumber'))}</TableHead>
                        <TableHead>{String(t('quality'))}</TableHead>
                        <TableHead>{String(t('color'))}</TableHead>
                        <TableHead className="text-right">{String(t('meters'))}</TableHead>
                        <TableHead className="text-right">{String(t('rolls'))}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unreceiveLots.map((lot) => (
                        <TableRow 
                          key={lot.id}
                          className={cn(
                            "cursor-pointer hover:bg-accent",
                            selectedLotIds.has(lot.id) && "bg-accent"
                          )}
                          onClick={() => toggleLotSelection(lot.id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedLotIds.has(lot.id)}
                              onCheckedChange={() => toggleLotSelection(lot.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{lot.lot_number}</TableCell>
                          <TableCell>{lot.quality}</TableCell>
                          <TableCell>{lot.color}</TableCell>
                          <TableCell className="text-right">{lot.meters}m</TableCell>
                          <TableCell className="text-right">{lot.roll_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnreceiveDialogOpen(false)}
              disabled={processing}
            >
              {String(t('cancel'))}
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnreceiveSubmit}
              disabled={processing || selectedLotIds.size === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {processing ? String(t('unreceiving')) : String(t('unreceiveButton'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Incoming Stock Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t('deleteIncomingStockTitle'))}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedForDelete && String(t('deleteIncomingStockDesc'))
                .replace('{quality}', selectedForDelete.quality)
                .replace('{color}', selectedForDelete.color)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {selectedForDelete && (
              <>
                {selectedForDelete.received_meters > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {String(t('cannotDeleteReceived'))}
                    </AlertDescription>
                  </Alert>
                )}

                {selectedForDelete.reserved_meters > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {String(t('cannotDeleteReserved')).replace('{reserved}', selectedForDelete.reserved_meters.toString())}
                    </AlertDescription>
                  </Alert>
                )}

                {selectedForDelete.received_meters === 0 && selectedForDelete.reserved_meters === 0 && (
                  <>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {String(t('deleteIncomingStockWarning'))}
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="deleteReason">{String(t('reasonForReversal'))} *</Label>
                      <Textarea
                        id="deleteReason"
                        placeholder={String(t('enterReasonForReversal'))}
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>
              {String(t('cancel'))}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmit}
              disabled={
                processing || 
                !selectedForDelete || 
                selectedForDelete.received_meters > 0 || 
                selectedForDelete.reserved_meters > 0 ||
                !deleteReason.trim()
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {processing ? String(t('deleting')) : String(t('deleteIncomingStockButton'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
