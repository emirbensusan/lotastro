import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, Factory, PackageIcon, AlertCircle, Clock, Search, History, Edit } from 'lucide-react';
import ManufacturingOrderDialog from '@/components/ManufacturingOrderDialog';
import MOBulkUpload from '@/components/MOBulkUpload';
import MOStatusHistoryDialog from '@/components/MOStatusHistoryDialog';

interface ManufacturingOrder {
  id: string;
  mo_number: string;
  supplier_id: string;
  quality: string;
  color: string;
  ordered_amount: number;
  order_date: string;
  expected_completion_date: string | null;
  supplier_confirmation_number: string | null;
  price_per_meter: number | null;
  currency: string | null;
  notes: string | null;
  is_customer_order: boolean;
  customer_name: string | null;
  customer_agreed_date: string | null;
  reservation_id: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  incoming_stock_id: string | null;
  suppliers?: {
    id: string;
    name: string;
  };
}

const MO_STATUSES = ['ORDERED', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'CANCELLED'];

const ManufacturingOrders: React.FC = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [orders, setOrders] = useState<ManufacturingOrder[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ManufacturingOrder | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!permissionsLoading) {
      fetchOrders();
      fetchSuppliers();
    }
  }, [permissionsLoading, statusFilter, supplierFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('manufacturing_orders')
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
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching manufacturing orders:', error);
      toast({
        title: t('error') as string,
        description: t('mo.fetchError') as string,
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

  const calculateStats = () => {
    const activeOrders = orders.filter(o => !['SHIPPED', 'CANCELLED'].includes(o.status));
    const inProductionMeters = orders
      .filter(o => ['CONFIRMED', 'IN_PRODUCTION'].includes(o.status))
      .reduce((sum, o) => sum + o.ordered_amount, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const dueIn7Days = activeOrders.filter(o => {
      if (!o.expected_completion_date) return false;
      const eta = new Date(o.expected_completion_date);
      return eta >= today && eta <= nextWeek;
    });

    const overdueOrders = activeOrders.filter(o => {
      if (!o.expected_completion_date) return false;
      return new Date(o.expected_completion_date) < today;
    });

    return {
      inProductionMeters,
      activeOrdersCount: activeOrders.length,
      dueIn7DaysCount: dueIn7Days.length,
      dueIn7DaysMeters: dueIn7Days.reduce((sum, o) => sum + o.ordered_amount, 0),
      overdueCount: overdueOrders.length,
      overdueMeters: overdueOrders.reduce((sum, o) => sum + o.ordered_amount, 0),
    };
  };

  const getDaysToETA = (order: ManufacturingOrder) => {
    if (!order.expected_completion_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eta = new Date(order.expected_completion_date);
    const diffTime = eta.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ORDERED': return 'outline';
      case 'CONFIRMED': return 'secondary';
      case 'IN_PRODUCTION': return 'default';
      case 'READY_TO_SHIP': return 'default';
      case 'SHIPPED': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ORDERED': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CONFIRMED': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'IN_PRODUCTION': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'READY_TO_SHIP': return 'bg-green-50 text-green-700 border-green-200';
      case 'SHIPPED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELLED': return 'bg-red-50 text-red-700 border-red-200';
      default: return '';
    }
  };

  const handleEdit = (order: ManufacturingOrder) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleViewHistory = (order: ManufacturingOrder) => {
    setSelectedOrder(order);
    setHistoryDialogOpen(true);
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.mo_number.toLowerCase().includes(query) ||
      order.quality.toLowerCase().includes(query) ||
      order.color.toLowerCase().includes(query) ||
      order.suppliers?.name.toLowerCase().includes(query) ||
      order.customer_name?.toLowerCase().includes(query)
    );
  });

  const stats = calculateStats();

  if (permissionsLoading) {
    return <div className="text-sm text-muted-foreground">{t('loading')}</div>;
  }

  const canView = hasPermission('inventory', 'viewincoming') || hasPermission('orders', 'vieworders');
  const canCreate = hasPermission('orders', 'createorders');

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            {t('mo.noPermission')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('mo.title')}</h1>
        <div className="flex gap-2">
          {canCreate && (
            <>
              <Button onClick={() => setBulkUploadOpen(true)} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                {t('bulkUpload')}
              </Button>
              <Button onClick={() => {
                setSelectedOrder(null);
                setDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                {t('mo.createNew')}
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
              <Factory className="h-4 w-4 text-muted-foreground" />
              {t('mo.inProduction')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.inProductionMeters.toLocaleString()}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('mo.metersInProduction')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
              {t('mo.activeOrders')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.activeOrdersCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('mo.ordersNotCompleted')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t('mo.dueIn7Days')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.dueIn7DaysCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.dueIn7DaysMeters.toLocaleString()}m {t('mo.meters')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              {t('overdue')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.overdueMeters.toLocaleString()}m {t('mo.meters')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('mo.searchPlaceholder') as string}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatusFilter')}</SelectItem>
            {MO_STATUSES.map(status => (
              <SelectItem key={status} value={status}>
                {t(`mo.status.${status.toLowerCase()}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filterBySupplier')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allSuppliers')}</SelectItem>
            {suppliers.map(supplier => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('mo.ordersList')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('mo.noOrdersFound')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('mo.moNumber')}</TableHead>
                  <TableHead>{t('supplier')}</TableHead>
                  <TableHead>{t('quality')}</TableHead>
                  <TableHead>{t('color')}</TableHead>
                  <TableHead className="text-right">{t('mo.orderedMeters')}</TableHead>
                  <TableHead>{t('mo.orderDate')}</TableHead>
                  <TableHead>{t('mo.eta')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('mo.daysToEta')}</TableHead>
                  <TableHead>{t('customer')}</TableHead>
                  <TableHead>{t('mo.lastUpdated')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const daysToETA = getDaysToETA(order);
                  const isOverdue = daysToETA !== null && daysToETA < 0 && !['SHIPPED', 'CANCELLED'].includes(order.status);

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.mo_number}</TableCell>
                      <TableCell>{order.suppliers?.name || '-'}</TableCell>
                      <TableCell>{order.quality}</TableCell>
                      <TableCell>{order.color}</TableCell>
                      <TableCell className="text-right">{order.ordered_amount.toLocaleString()}m</TableCell>
                      <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {order.expected_completion_date 
                          ? new Date(order.expected_completion_date).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadgeClass(order.status)}>
                          {t(`mo.status.${order.status.toLowerCase()}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {daysToETA !== null ? (
                          <span className={`font-medium ${isOverdue ? 'text-red-600' : daysToETA <= 7 ? 'text-amber-600' : 'text-green-600'}`}>
                            {isOverdue ? `${t('overdue')} ${Math.abs(daysToETA)}d` : `+${daysToETA}d`}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {order.is_customer_order ? (
                          <span className="text-sm">{order.customer_name}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(order.updated_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {canCreate && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(order)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewHistory(order)}
                          >
                            <History className="h-3 w-3" />
                          </Button>
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
      <ManufacturingOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingOrder={selectedOrder}
        suppliers={suppliers}
        onSuccess={() => {
          fetchOrders();
          setSelectedOrder(null);
        }}
      />

      <MOBulkUpload
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        suppliers={suppliers}
        onSuccess={fetchOrders}
      />

      <MOStatusHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        order={selectedOrder}
      />
    </div>
  );
};

export default ManufacturingOrders;