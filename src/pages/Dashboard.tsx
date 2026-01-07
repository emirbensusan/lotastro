import React, { lazy, Suspense, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Package, Truck, AlertTriangle, TrendingUp, TruckIcon, Lock, PackageCheck, Calendar, Factory, Palette, BookOpen, PackageX, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useIsMobile } from '@/hooks/use-mobile';

// Lazy load dashboard widgets for better initial load
const InsightsWidget = lazy(() => import('@/components/dashboard/InsightsWidget').then(m => ({ default: m.InsightsWidget })));
const ActivityFeed = lazy(() => import('@/components/dashboard/ActivityFeed').then(m => ({ default: m.ActivityFeed })));
const TrendChart = lazy(() => import('@/components/dashboard/TrendChart').then(m => ({ default: m.TrendChart })));

// Widget loading skeleton
const WidgetSkeleton = () => (
  <Card>
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-24" />
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { success: hapticSuccess } = useHapticFeedback();
  
  // Use React Query for dashboard stats - with stale-while-revalidate
  const { stats, isLoading, isFetching, refresh } = useDashboardStats({
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  const handleRefresh = useCallback(async () => {
    await refresh();
    hapticSuccess();
  }, [refresh, hapticSuccess]);

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

  // Only show full skeleton on initial load (no cached data)
  if (isLoading && stats.totalLots === 0 && stats.totalRolls === 0) {
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
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
          {/* Show subtle refresh indicator when fetching in background */}
          {isFetching && !isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
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

      {/* Analytics Widgets - Lazy loaded */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Suspense fallback={<WidgetSkeleton />}>
          <InsightsWidget className="lg:col-span-1" />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton />}>
          <TrendChart className="lg:col-span-2" />
        </Suspense>
      </div>

      {/* Activity Feed */}
      <Suspense fallback={<WidgetSkeleton />}>
        <ActivityFeed className="max-h-80" />
      </Suspense>
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
