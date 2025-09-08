import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, TrendingUp, Package, Truck, Download } from 'lucide-react';
import { DateRange } from 'react-day-picker';

interface SalesDataItem {
  orderNumber: string;
  customerName: string;
  createdAt: string;
  fulfilledAt?: string;
  lots: Array<{
    quality: string;
    color: string;
    rollCount: number;
    lotNumber?: string;
    meters?: number;
    lotEntryDate?: string;
    ageDays?: number;
  }>;
}

interface ReportData {
  totalLots: number;
  totalOrders: number;
  totalMeters: number;
  activeSuppliers: number;
  lotsByQuality: { [key: string]: number };
  ordersByStatus: { [key: string]: number };
  salesData?: SalesDataItem[];
}

const Reports: React.FC = () => {
  const { hasRole, loading: authLoading } = useAuth();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reportType, setReportType] = useState<string>('overview');

  useEffect(() => {
    fetchReportData();
  }, [dateRange, reportType]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (reportType === 'sales') {
        // Fetch detailed sales data
        const { data: salesData } = await supabase
          .from('orders')
          .select(`
            *,
            order_lots(
              id,
              quality,
              color,
              roll_count,
              lots(
                lot_number,
                meters,
                entry_date
              )
            )
          `)
          .gte('created_at', dateRange?.from?.toISOString() || '2023-01-01')
          .lte('created_at', dateRange?.to?.toISOString() || new Date().toISOString())
          .order('created_at', { ascending: false });

        if (salesData) {
          const processedSalesData = salesData.map(order => ({
            orderNumber: order.order_number,
            customerName: order.customer_name,
            createdAt: order.created_at,
            fulfilledAt: order.fulfilled_at,
            lots: order.order_lots?.map(lot => ({
              quality: lot.quality,
              color: lot.color,
              rollCount: lot.roll_count,
              lotNumber: lot.lots?.lot_number,
              meters: lot.lots?.meters,
              lotEntryDate: lot.lots?.entry_date,
              ageDays: lot.lots?.entry_date 
                ? Math.floor((new Date(order.created_at).getTime() - new Date(lot.lots.entry_date).getTime()) / (1000 * 60 * 60 * 24))
                : null
            })) || []
          }));

          setReportData({
            totalLots: 0,
            totalOrders: salesData.length,
            totalMeters: 0,
            activeSuppliers: 0,
            lotsByQuality: {},
            ordersByStatus: {},
            salesData: processedSalesData
          });
        }
      } else {
        // Fetch regular report data
        const { data: lots } = await supabase
          .from('lots')
          .select('*')
          .gte('entry_date', dateRange?.from?.toISOString() || '2023-01-01')
          .lte('entry_date', dateRange?.to?.toISOString() || new Date().toISOString());

        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .gte('created_at', dateRange?.from?.toISOString() || '2023-01-01')
          .lte('created_at', dateRange?.to?.toISOString() || new Date().toISOString());

        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('*');

        if (lots && orders && suppliers) {
          const totalMeters = lots.reduce((sum, lot) => sum + Number(lot.meters), 0);
          const lotsByQuality: { [key: string]: number } = {};
          lots.forEach(lot => {
            lotsByQuality[lot.quality] = (lotsByQuality[lot.quality] || 0) + 1;
          });

          const ordersByStatus: { [key: string]: number } = {};
          orders.forEach(order => {
            const status = order.fulfilled_at ? 'Fulfilled' : 'Pending';
            ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
          });

          setReportData({
            totalLots: lots.length,
            totalOrders: orders.length,
            totalMeters,
            activeSuppliers: suppliers.length,
            lotsByQuality,
            ordersByStatus
          });
        }
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!reportData) return;
    
    const csvContent = `Report Type: ${reportType}\nDate Range: ${dateRange?.from || 'All'} - ${dateRange?.to || 'All'}\n\nSummary:\nTotal Lots: ${reportData.totalLots}\nTotal Orders: ${reportData.totalOrders}\nTotal Meters: ${reportData.totalMeters}\nActive Suppliers: ${reportData.activeSuppliers}\n\nLots by Quality:\n${Object.entries(reportData.lotsByQuality).map(([quality, count]) => `${quality}: ${count}`).join('\n')}\n\nOrders by Status:\n${Object.entries(reportData.ordersByStatus).map(([status, count]) => `${status}: ${count}`).join('\n')}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!hasRole('admin')) {
    return <div className="text-sm text-muted-foreground">You are not authorized to access reports.</div>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <Button onClick={exportReport} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select report type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overview">Overview</SelectItem>
            <SelectItem value="inventory">Inventory Analysis</SelectItem>
            <SelectItem value="orders">Order Performance</SelectItem>
            <SelectItem value="sales">Sales Report</SelectItem>
            <SelectItem value="suppliers">Supplier Analysis</SelectItem>
          </SelectContent>
        </Select>
        <DatePickerWithRange date={dateRange} setDate={setDateRange} />
      </div>

      {reportData && (
        <>
          {reportType === 'sales' && reportData.salesData ? (
            /* Sales Report */
            <Card>
              <CardHeader>
                <CardTitle>Sales Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportData.salesData.map((sale, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Order #:</span>
                          <p className="text-muted-foreground">{sale.orderNumber}</p>
                        </div>
                        <div>
                          <span className="font-medium">Customer:</span>
                          <p className="text-muted-foreground">{sale.customerName}</p>
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>
                          <p className="text-muted-foreground">
                            {new Date(sale.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Shipped:</span>
                          <p className="text-muted-foreground">
                            {sale.fulfilledAt ? new Date(sale.fulfilledAt).toLocaleDateString() : 'Pending'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <span className="font-medium text-sm">Lots:</span>
                        <div className="grid gap-2 mt-1">
                          {sale.lots.map((lot, lotIndex) => (
                            <div key={lotIndex} className="flex items-center gap-4 text-xs bg-muted/50 p-2 rounded">
                              <span><strong>Quality:</strong> {lot.quality}</span>
                              <span><strong>Color:</strong> {lot.color}</span>
                              <span><strong>Lot:</strong> {lot.lotNumber}</span>
                              <span><strong>Rolls:</strong> {lot.rollCount}</span>
                              <span><strong>Meters:</strong> {lot.meters}</span>
                              {lot.ageDays && (
                                <Badge variant="outline" className="text-xs">
                                  {lot.ageDays}d old
                                </Badge>
                              )}
                              {lot.lotEntryDate && (
                                <span><strong>Lot Date:</strong> {new Date(lot.lotEntryDate).toLocaleDateString()}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Regular Reports */
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Lots</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reportData.totalLots}</div>
                    <p className="text-xs text-muted-foreground">
                      Active inventory items
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                    <Truck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reportData.totalOrders}</div>
                    <p className="text-xs text-muted-foreground">
                      Orders processed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Meters</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reportData.totalMeters.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Meters in inventory
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reportData.activeSuppliers}</div>
                    <p className="text-xs text-muted-foreground">
                      Active suppliers
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Analytics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Lots by Quality</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(reportData.lotsByQuality).map(([quality, count]) => (
                      <div key={quality} className="flex justify-between items-center">
                        <span className="text-sm">{quality}</span>
                        <Badge variant="secondary">{count} lots</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Order Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(reportData.ordersByStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-sm">{status}</span>
                        <Badge variant={status === 'Fulfilled' ? 'default' : 'destructive'}>
                          {count} orders
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;