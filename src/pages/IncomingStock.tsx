import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, TruckIcon, PackageIcon, AlertCircle, CheckCircle, Edit, Trash2 } from 'lucide-react';
import { IncomingStockDialog } from '@/components/IncomingStockDialog';
import { IncomingBulkUpload } from '@/components/IncomingBulkUpload';
import { ReceiveStockDialog } from '@/components/ReceiveStockDialog';

interface IncomingStock {
  id: string;
  quality: string;
  color: string;
  expected_meters: number;
  received_meters: number;
  reserved_meters: number;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  expected_arrival_date: string | null;
  notes: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface IncomingStockWithSupplier extends IncomingStock {
  suppliers: {
    id: string;
    name: string;
  };
}

const IncomingStock: React.FC = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [incomingStock, setIncomingStock] = useState<IncomingStockWithSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<IncomingStockWithSupplier | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    if (hasPermission('inventory', 'viewincoming')) {
      fetchIncomingStock();
      fetchSuppliers();
    }
  }, [statusFilter, supplierFilter]);

  const fetchIncomingStock = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('incoming_stock')
        .select(`
          *,
          suppliers (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (supplierFilter !== 'all') {
        query = query.eq('supplier_id', supplierFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setIncomingStock(data || []);
    } catch (error) {
      console.error('Error fetching incoming stock:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch incoming stock.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const calculateSummaryStats = () => {
    const totalIncoming = incomingStock
      .filter(s => s.status !== 'fully_received')
      .reduce((sum, s) => sum + (s.expected_meters - s.received_meters), 0);

    const pendingCount = incomingStock.filter(s => s.status === 'pending_inbound').length;
    const partialCount = incomingStock.filter(s => s.status === 'partially_received').length;

    const overdueCount = incomingStock.filter(s =>
      s.status !== 'fully_received' &&
      s.expected_arrival_date &&
      new Date(s.expected_arrival_date) < new Date()
    ).length;

    return { totalIncoming, pendingCount, partialCount, overdueCount };
  };

  const isOverdue = (item: IncomingStockWithSupplier) => {
    return item.status !== 'fully_received' &&
      item.expected_arrival_date &&
      new Date(item.expected_arrival_date) < new Date();
  };

  const handleEdit = (item: IncomingStockWithSupplier) => {
    setSelectedStock(item);
    setDialogOpen(true);
  };

  const handleReceive = (item: IncomingStockWithSupplier) => {
    setSelectedStock(item);
    setReceiveDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this incoming stock entry?')) return;

    try {
      const { error } = await supabase
        .from('incoming_stock')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Incoming stock entry deleted successfully.'
      });

      fetchIncomingStock();
    } catch (error: any) {
      console.error('Error deleting incoming stock:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete incoming stock entry.',
        variant: 'destructive'
      });
    }
  };

  const stats = calculateSummaryStats();

  if (permissionsLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!hasPermission('inventory', 'viewincoming')) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            You don't have permission to access incoming stock.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Incoming Stock</h1>
        <div className="flex gap-2">
          {hasPermission('inventory', 'createincoming') && (
            <>
              <Button onClick={() => setBulkUploadOpen(true)} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              <Button onClick={() => {
                setSelectedStock(null);
                setDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TruckIcon className="h-4 w-4 text-muted-foreground" />
              Total Incoming Meters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalIncoming.toLocaleString()}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Expected stock on the way
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
              Pending Shipments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.pendingCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting arrival
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              Partially Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.partialCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              In progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Past expected date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending_inbound">Pending Inbound</SelectItem>
            <SelectItem value="partially_received">Partially Received</SelectItem>
            <SelectItem value="fully_received">Fully Received</SelectItem>
          </SelectContent>
        </Select>

        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map(supplier => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Incoming Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Incoming Stock Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : incomingStock.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No incoming stock entries found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Arrival Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomingStock.map((item) => {
                  const openMeters = item.expected_meters - item.received_meters;
                  const progress = (item.received_meters / item.expected_meters) * 100;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.invoice_number}</TableCell>
                      <TableCell>{item.suppliers.name}</TableCell>
                      <TableCell>{item.quality}</TableCell>
                      <TableCell>{item.color}</TableCell>
                      <TableCell className="text-right">{item.expected_meters.toLocaleString()}m</TableCell>
                      <TableCell className="text-right">{item.received_meters.toLocaleString()}m</TableCell>
                      <TableCell className="text-right">
                        <span className="text-orange-600">{item.reserved_meters.toLocaleString()}m</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={openMeters > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                          {openMeters.toLocaleString()}m
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">{Math.round(progress)}%</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.expected_arrival_date ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {new Date(item.expected_arrival_date).toLocaleDateString()}
                            </span>
                            {isOverdue(item) && <Badge variant="destructive">Overdue</Badge>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.status === 'pending_inbound' && (
                          <Badge variant="outline" className="bg-blue-50">Pending</Badge>
                        )}
                        {item.status === 'partially_received' && (
                          <Badge variant="outline" className="bg-amber-50">Partial</Badge>
                        )}
                        {item.status === 'fully_received' && (
                          <Badge variant="outline" className="bg-green-50">Complete</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {hasPermission('inventory', 'receiveincoming') && openMeters > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReceive(item)}
                            >
                              Receive
                            </Button>
                          )}
                          {hasPermission('inventory', 'createincoming') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(item)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          {hasPermission('inventory', 'deleteincoming') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <IncomingStockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingStock={selectedStock}
        onSuccess={() => {
          fetchIncomingStock();
          setSelectedStock(null);
        }}
      />

      <IncomingBulkUpload
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onSuccess={fetchIncomingStock}
      />

      <ReceiveStockDialog
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        incomingStock={selectedStock}
        onSuccess={() => {
          fetchIncomingStock();
          setSelectedStock(null);
        }}
      />
    </div>
  );
};

export default IncomingStock;
