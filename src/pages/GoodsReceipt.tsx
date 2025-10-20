import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertTriangle
} from 'lucide-react';
import { format, isToday, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

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
  
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasPermission('inventory', 'receiveincoming')) {
      if (viewMode === 'pending') {
        fetchPendingStock();
      } else {
        fetchReceiptHistory();
      }
    }
  }, [viewMode]);

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
          Goods Receipt
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
              Pending Shipments
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
              Total Pending Meters
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
              Expected Today
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
              Overdue
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
            Pending Receipts ({totalPendingShipments})
          </TabsTrigger>
          <TabsTrigger value="history">
            Receipt History
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
                            Invoice: {item.invoice_number}
                          </p>
                        )}
                      </div>
                      
                      {isOverdue(item) ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : isExpectedToday(item) ? (
                        <Badge className="bg-blue-600 text-white">Today</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
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
                        <span className="text-muted-foreground">Expected:</span>
                        <span className="font-medium">{item.expected_meters}m</span>
                      </div>

                      {item.received_meters > 0 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Received:</span>
                            <span className="font-medium text-green-600">{item.received_meters}m</span>
                          </div>
                          <Progress 
                            value={(item.received_meters / item.expected_meters) * 100}
                            className="h-2"
                          />
                        </>
                      )}

                      <div className="flex justify-between text-sm pt-1 border-t">
                        <span className="font-semibold">Remaining:</span>
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
                    <CardFooter>
                      <Button 
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReceiveClick(item);
                        }}
                      >
                        <PackageCheck className="h-4 w-4 mr-2" />
                        Receive Stock
                      </Button>
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
    </div>
  );
}
