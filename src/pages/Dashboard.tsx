import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Package, Truck, AlertTriangle, TrendingUp, TruckIcon, Lock, PackageCheck, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  totalLots: number;
  totalRolls: number;
  totalMeters: number;
  inStockLots: number;
  outOfStockLots: number;
  pendingOrders: number;
  oldestLotDays: number;
  incomingMeters: number;
  reservedMeters: number;
  activeReservations: number;
  pendingReceipts: number;
}

const Dashboard = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalLots: 0,
    totalRolls: 0,
    totalMeters: 0,
    inStockLots: 0,
    outOfStockLots: 0,
    pendingOrders: 0,
    oldestLotDays: 0,
    incomingMeters: 0,
    reservedMeters: 0,
    activeReservations: 0,
    pendingReceipts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchDashboardStats();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Use DB-side aggregation to avoid client limits and ensure accuracy
      const { data, error } = await supabase
        .rpc('get_dashboard_stats')
        .single();

      if (error) throw error;

      // Count pending receipts (incoming stock with status pending/partial)
      const { count: pendingReceiptCount } = await supabase
        .from('incoming_stock')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending_inbound', 'partially_received']);

      const inStockLots = Number(data?.total_in_stock_lots || 0);
      const outOfStockLots = Number(data?.total_out_of_stock_lots || 0);
      const totalRolls = Number(data?.total_rolls || 0);
      const totalMeters = Number(data?.total_meters || 0);
      const oldestLotDays = Number(data?.oldest_lot_days || 0);
      const pendingOrders = Number(data?.pending_orders || 0);
      const incomingMeters = Number(data?.total_incoming_meters || 0);
      const reservedMeters = Number(data?.total_reserved_meters || 0);
      const activeReservations = Number(data?.active_reservations_count || 0);

      console.info('Dashboard Stats (DB Aggregated):', {
        inStockLots,
        totalRolls,
        totalMeters,
        oldestLotDays,
        pendingOrders,
        incomingMeters,
        reservedMeters,
        activeReservations,
        pendingReceipts: pendingReceiptCount,
      });

      setStats({
        totalLots: inStockLots,
        totalRolls,
        totalMeters,
        inStockLots,
        outOfStockLots,
        pendingOrders,
        oldestLotDays,
        incomingMeters,
        reservedMeters,
        activeReservations,
        pendingReceipts: pendingReceiptCount || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t('totalLots'),
      value: stats.totalLots.toString(),
      description: t('inStockLotsAvailable'),
      icon: Package,
      color: 'text-primary',
    },
    {
      title: t('totalRolls'),
      value: stats.totalRolls.toLocaleString(),
      description: t('totalRollsInventory'),
      icon: Package,
      color: 'text-purple-600',
    },
    {
      title: t('totalMeters'),
      value: stats.totalMeters.toLocaleString(),
      description: t('totalMetersInventory'),
      icon: TrendingUp,
      color: 'text-orange-600',
    },
    {
      title: t('pendingOrders'),
      value: stats.pendingOrders.toString(),
      description: t('awaitingFulfillment'),
      icon: Truck,
      color: 'text-blue-600',
    },
    {
      title: 'Incoming Stock',
      value: `${stats.incomingMeters.toLocaleString()}m`,
      description: 'Expected meters pending receipt',
      icon: TruckIcon,
      color: 'text-cyan-600',
      link: '/incoming-stock',
    },
    {
      title: 'Reserved Stock',
      value: `${stats.reservedMeters.toLocaleString()}m`,
      description: `${stats.activeReservations} active reservations`,
      icon: Lock,
      color: 'text-amber-600',
      link: '/orders?tab=reservations',
    },
    {
      title: 'Pending Receipts',
      value: stats.pendingReceipts.toString(),
      description: 'Shipments awaiting goods receipt',
      icon: PackageCheck,
      color: 'text-green-600',
      link: '/goods-receipt',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
        <div className="text-sm text-muted-foreground">
          {t('welcomeBack')}, {profile?.full_name || profile?.email}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const CardWrapper = stat.link ? 'button' : 'div';
          
          return (
            <Card 
              key={stat.title as string}
              className={stat.link ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}
              onClick={stat.link ? () => navigate(stat.link) : undefined}
            >
              <CardWrapper className="w-full text-left">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </CardWrapper>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions - 3 Cards per Role */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {profile?.role === 'warehouse_staff' && (
          <>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/lot-intake'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📦 Generate QR Codes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Create new lot entries with QR codes</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToLotIntake')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/qr-scan'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📦 Scan QR Codes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Scan existing QR codes for lot management</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to QR Scanner
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/orders'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  🚛 Fulfill Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Process and fulfill customer orders</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Orders
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {profile?.role === 'accounting' && (
          <>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/goods-receipt'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📦 Receive Goods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Process pending shipments</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Goods Receipt
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/orders?tab=reservations'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📅 Manage Reservations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Create and manage stock reservations</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Reservations
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/incoming-stock'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  🚚 Track Incoming Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Monitor expected deliveries</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Incoming Stock
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {profile?.role === 'senior_manager' && (
          <>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/approvals'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  ✅ Review Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Approve or reject pending changes</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Approvals
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/reports'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📊 View Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Access analytics and reports</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Reports
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/incoming-stock'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📊 View Incoming Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Monitor expected inventory</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Incoming Stock
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {profile?.role === 'admin' && (
          <>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/suppliers'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📦 {t('manageSuppliers')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('addEditManageSupplier')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToSuppliers')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/inventory'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📦 {t('deleteLots')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('removeLotsFromSystem')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToInventory')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/lot-intake'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📦 {t('reprintQrCodes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('regenerateAndPrintQr')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToLotIntake')}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;