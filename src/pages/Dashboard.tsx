import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Package, Truck, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  totalLots: number;
  totalRolls: number;
  totalMeters: number;
  inStockLots: number;
  outOfStockLots: number;
  pendingOrders: number;
  oldestLotDays: number;
}

const Dashboard = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    totalLots: 0,
    totalRolls: 0,
    totalMeters: 0,
    inStockLots: 0,
    outOfStockLots: 0,
    pendingOrders: 0,
    oldestLotDays: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch inventory aggregated data directly
      const { data: aggregatedData, error: aggregatedError } = await supabase
        .from('lots')
        .select('roll_count, meters')
        .eq('status', 'in_stock');

      if (aggregatedError) throw aggregatedError;

      // Fetch all lots for counts and aging
      const { data: lots, error: lotsError } = await supabase
        .from('lots')
        .select('status, entry_date');

      if (lotsError) throw lotsError;

      // Fetch pending orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .is('fulfilled_at', null);

      if (ordersError) throw ordersError;

      // Calculate statistics
      const totalLots = lots?.length || 0;
      const inStockLots = lots?.filter(lot => lot.status === 'in_stock').length || 0;
      const outOfStockLots = lots?.filter(lot => lot.status === 'out_of_stock').length || 0;
      const pendingOrders = orders?.length || 0;

      // Calculate totals from aggregated data
      const totalRolls = aggregatedData?.reduce((sum, lot) => sum + (lot.roll_count || 0), 0) || 0;
      const totalMeters = aggregatedData?.reduce((sum, lot) => sum + Number(lot.meters || 0), 0) || 0;

      // Calculate oldest LOT age
      let oldestLotDays = 0;
      if (lots && lots.length > 0) {
        const oldestDate = Math.min(
          ...lots.map(lot => new Date(lot.entry_date).getTime())
        );
        oldestLotDays = Math.floor((Date.now() - oldestDate) / (1000 * 60 * 60 * 24));
      }

      setStats({
        totalLots,
        totalRolls,
        totalMeters,
        inStockLots,
        outOfStockLots,
        pendingOrders,
        oldestLotDays,
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
      description: 'Total lots in system',
      icon: Package,
      color: 'text-primary',
    },
    {
      title: 'Total Rolls',
      value: stats.totalRolls.toLocaleString(),
      description: 'Total rolls in inventory',
      icon: Package,
      color: 'text-purple-600',
    },
    {
      title: 'Total Meters',
      value: stats.totalMeters.toLocaleString(),
      description: 'Total meters in inventory',
      icon: TrendingUp,
      color: 'text-orange-600',
    },
    {
      title: t('inStock'),
      value: stats.inStockLots.toString(),
      description: 'Available for orders',
      icon: Package,
      color: 'text-green-600',
    },
    {
      title: t('outOfStock'),
      value: stats.outOfStockLots.toString(),
      description: 'Fulfilled or dispatched',
      icon: Package,
      color: 'text-red-600',
    },
    {
      title: t('pendingOrders'),
      value: stats.pendingOrders.toString(),
      description: 'Awaiting fulfillment',
      icon: Truck,
      color: 'text-blue-600',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title as string}>
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
            </Card>
          );
        })}
      </div>

      {/* Lot Aging Alert */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
            {t('lotAgingAlert')}
          </CardTitle>
          <CardDescription>
            {t('monitorOldInventory')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.oldestLotDays > 0 ? (
            <div className="space-y-2">
              <div className="text-2xl font-bold">{stats.oldestLotDays} {t('days')}</div>
              <p className="text-sm text-muted-foreground">
                {t('oldestLot')}
              </p>
              {stats.oldestLotDays > 90 && (
                <Badge variant="destructive">
                  {t('considerReviewing')}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('noLotsInInventory')}
            </p>
          )}
        </CardContent>
      </Card>

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
                  Go to Lot Intake
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
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/lot-queue'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  🚛 Check Lot Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Monitor pending lot processing queue</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Lot Queue
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/orders'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📦 Create Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Create new customer orders</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Orders
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/inventory'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📈 Check Stock Levels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Monitor inventory and stock levels</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Inventory
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
                  📦 Manage Suppliers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Add, edit, and manage supplier information</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Suppliers
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/inventory'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📦 Delete Lots
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Remove lots from inventory system</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Inventory
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/lot-intake'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  📦 Reprint QR Codes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Regenerate and print QR codes for lots</p>
                <Button variant="outline" size="sm" className="w-full">
                  Go to Lot Intake
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