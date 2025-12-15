import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Package, Truck, AlertTriangle, TrendingUp, TruckIcon, Lock, PackageCheck, Calendar, Factory, Palette, BookOpen, PackageX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useIsMobile } from '@/hooks/use-mobile';

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
  metersInProduction: number;
  inStockQualityColorPairs: number;
  outOfStockQualityColorPairs: number;
  activeCatalogItems: number;
}

const Dashboard = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { success: hapticSuccess } = useHapticFeedback();
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
    metersInProduction: 0,
    inStockQualityColorPairs: 0,
    outOfStockQualityColorPairs: 0,
    activeCatalogItems: 0,
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

  const fetchDashboardStats = useCallback(async () => {
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

      // Get meters in production from manufacturing orders (not shipped/cancelled)
      const { data: moData } = await supabase
        .from('manufacturing_orders')
        .select('ordered_amount')
        .not('status', 'in', '("SHIPPED","CANCELLED")');

      const metersInProduction = moData?.reduce((sum, mo) => sum + Number(mo.ordered_amount || 0), 0) || 0;

      // Count distinct quality-color pairs for in-stock lots
      const { data: inStockPairs } = await supabase
        .from('lots')
        .select('quality, color')
        .eq('status', 'in_stock');
      const inStockQualityColorPairs = new Set(inStockPairs?.map(l => `${l.quality}|${l.color}`)).size;

      // Count distinct quality-color pairs for out-of-stock lots
      const { data: outOfStockPairs } = await supabase
        .from('lots')
        .select('quality, color')
        .eq('status', 'out_of_stock');
      const outOfStockQualityColorPairs = new Set(outOfStockPairs?.map(l => `${l.quality}|${l.color}`)).size;

      // Count active catalog items
      const { count: activeCatalogItems } = await supabase
        .from('catalog_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

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
        metersInProduction,
        inStockQualityColorPairs,
        outOfStockQualityColorPairs,
        activeCatalogItems,
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
        metersInProduction,
        inStockQualityColorPairs,
        outOfStockQualityColorPairs,
        activeCatalogItems: activeCatalogItems || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await fetchDashboardStats();
    hapticSuccess();
  }, [fetchDashboardStats, hapticSuccess]);

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
      link: '/orders',
    },
    {
      title: t('incomingStockLabel'),
      value: `${stats.incomingMeters.toLocaleString()}m`,
      description: t('expectedMetersPendingReceipt'),
      icon: TruckIcon,
      color: 'text-cyan-600',
      link: '/incoming-stock',
    },
    {
      title: t('reservedStock'),
      value: `${stats.reservedMeters.toLocaleString()}m`,
      description: `${stats.activeReservations} ${t('reservedStockCount')}`,
      icon: Lock,
      color: 'text-amber-600',
      link: '/reservations',
    },
    {
      title: t('inProduction'),
      value: `${stats.metersInProduction.toLocaleString()}m`,
      description: t('metersBeingManufactured'),
      icon: Factory,
      color: 'text-indigo-600',
      link: '/manufacturing-orders',
    },
    {
      title: t('pendingReceipts'),
      value: stats.pendingReceipts.toString(),
      description: t('shipmentsAwaitingGoodsReceipt'),
      icon: PackageCheck,
      color: 'text-green-600',
      link: '/goods-receipt',
    },
    {
      title: t('inStockVarieties'),
      value: stats.inStockQualityColorPairs.toString(),
      description: t('inStockVarietiesDesc'),
      icon: Palette,
      color: 'text-emerald-600',
      link: '/inventory',
    },
    {
      title: t('outOfStockVarieties'),
      value: stats.outOfStockQualityColorPairs.toString(),
      description: t('outOfStockVarietiesDesc'),
      icon: PackageX,
      color: 'text-rose-600',
    },
    {
      title: t('activeCatalogItems'),
      value: stats.activeCatalogItems.toString(),
      description: t('activeCatalogItemsDesc'),
      icon: BookOpen,
      color: 'text-violet-600',
      link: '/catalog',
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

  const content = (
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
              className={stat.link ? 'cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-primary/50' : ''}
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
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/lot-intake')}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {t('generateQrCodes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('generateQrCodesDesc')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToLotIntake')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/qr-scan')}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {t('scanQrCodes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('scanQrCodesDesc')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToQrScanner')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/orders')}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {t('fulfillOrders')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('fulfillOrdersDesc')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToOrders')}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {profile?.role === 'accounting' && (
          <>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/goods-receipt')}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {t('receiveGoodsAction')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('receiveGoodsDesc')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToGoodsReceipt')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/orders?tab=reservations')}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {t('manageReservationsAction')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('manageReservationsDesc')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToReservations')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/incoming-stock')}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {t('trackIncomingStockAction')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('trackIncomingStockDesc')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToIncomingStock')}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {profile?.role === 'senior_manager' && (
          <>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/approvals')}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {t('reviewApprovals')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('reviewApprovalsDesc')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToApprovals')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/reports')}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {t('viewReports')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('viewReportsDesc')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToReports')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/incoming-stock')}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {t('viewIncomingStockAction')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('viewIncomingStockDesc')}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('goToIncomingStock')}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {profile?.role === 'admin' && (
          <>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/suppliers')}>
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

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/inventory')}>
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

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50" onClick={() => navigate('/lot-intake')}>
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

  // Wrap with pull-to-refresh on mobile
  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleRefresh} className="h-full">
        {content}
      </PullToRefresh>
    );
  }

  return content;
};

export default Dashboard;