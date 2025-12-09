import React, { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Package,
  Loader2,
  Play,
  Download,
  Upload,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HistoricalImportModal from '@/components/forecast/HistoricalImportModal';
import ForecastDetailDrawer from '@/components/forecast/ForecastDetailDrawer';

interface ForecastRun {
  id: string;
  run_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  processed_combinations: number | null;
  total_combinations: number | null;
}

interface Recommendation {
  id: string;
  quality_code: string;
  color_code: string;
  unit: string;
  available_stock: number;
  incoming_stock: number;
  in_production_stock: number;
  total_stock_position: number;
  past_12m_demand: number;
  forecasted_lead_time_demand: number;
  safety_stock_value: number;
  conservative_recommendation: number;
  normal_recommendation: number;
  aggressive_recommendation: number;
  lead_time_days: number;
  target_coverage_weeks: number;
  has_quality_override: boolean;
  status: string;
  last_order_date: string | null;
  notes: string | null;
}

interface Alert {
  id: string;
  quality_code: string;
  color_code: string;
  alert_type: string;
  severity: string;
  current_stock: number;
  forecasted_demand: number;
  is_resolved: boolean;
}

const Forecast: React.FC = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [runningForecast, setRunningForecast] = useState(false);
  const [latestRun, setLatestRun] = useState<ForecastRun | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scenarioFilter, setScenarioFilter] = useState<'conservative' | 'normal' | 'aggressive'>('normal');
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (!permissionsLoading) {
      fetchData();
    }
  }, [permissionsLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch latest completed run
      const { data: runData } = await supabase
        .from('forecast_runs')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setLatestRun(runData);

      if (runData) {
        // Fetch recommendations for this run
        const { data: recData } = await supabase
          .from('purchase_recommendations')
          .select('*')
          .eq('run_id', runData.id)
          .order('normal_recommendation', { ascending: false });
        
        setRecommendations(recData || []);

        // Fetch active alerts
        const { data: alertData } = await supabase
          .from('forecast_alerts')
          .select('*')
          .eq('run_id', runData.id)
          .eq('is_resolved', false)
          .order('severity', { ascending: true });
        
        setAlerts(alertData || []);
      }
    } catch (error) {
      console.error('Error fetching forecast data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runForecast = async () => {
    setRunningForecast(true);
    try {
      const { data, error } = await supabase.functions.invoke('forecast-engine', {
        body: { 
          run_type: 'manual',
          triggered_by: user?.id
        }
      });

      if (error) throw error;

      toast({
        title: String(t('success')),
        description: String(t('forecast.runStarted') || 'Forecast calculation started'),
      });

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const { data: runStatus } = await supabase
          .from('forecast_runs')
          .select('status')
          .eq('id', data.run_id)
          .single();

        if (runStatus?.status === 'completed' || runStatus?.status === 'failed') {
          clearInterval(pollInterval);
          setRunningForecast(false);
          fetchData();
          
          if (runStatus.status === 'failed') {
            toast({
              title: String(t('error')),
              description: String(t('forecast.runFailed') || 'Forecast run failed'),
              variant: 'destructive'
            });
          } else {
            toast({
              title: String(t('success')),
              description: String(t('forecast.runCompleted') || 'Forecast calculation completed'),
            });
          }
        }
      }, 2000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setRunningForecast(false);
      }, 300000);

    } catch (error: any) {
      console.error('Error running forecast:', error);
      toast({
        title: String(t('error')),
        description: error.message,
        variant: 'destructive'
      });
      setRunningForecast(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Quality', 'Color', 'Unit', 'Available Stock', 'Incoming', 'In Production',
      'Total Position', '12M Demand', 'Lead Time Demand', 'Safety Stock',
      'Conservative', 'Normal', 'Aggressive', 'Lead Time (days)', 'Coverage (weeks)'
    ];
    
    const rows = filteredRecommendations.map(r => [
      r.quality_code, r.color_code, r.unit, r.available_stock, r.incoming_stock,
      r.in_production_stock, r.total_stock_position, r.past_12m_demand,
      r.forecasted_lead_time_demand, r.safety_stock_value,
      r.conservative_recommendation, r.normal_recommendation, r.aggressive_recommendation,
      r.lead_time_days, r.target_coverage_weeks
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Filtering
  const filteredRecommendations = recommendations.filter(r => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!r.quality_code.toLowerCase().includes(query) && !r.color_code.toLowerCase().includes(query)) {
        return false;
      }
    }
    if (statusFilter !== 'all' && r.status !== statusFilter) {
      return false;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRecommendations.length / pageSize);
  const paginatedRecommendations = filteredRecommendations.slice((page - 1) * pageSize, page * pageSize);

  // Summary stats
  const totalReorderNeeded = recommendations.filter(r => r.normal_recommendation > 0).length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
  const totalStockValue = recommendations.reduce((sum, r) => sum + r.total_stock_position, 0);

  const getRecommendationValue = (r: Recommendation) => {
    switch (scenarioFilter) {
      case 'conservative': return r.conservative_recommendation;
      case 'aggressive': return r.aggressive_recommendation;
      default: return r.normal_recommendation;
    }
  };

  const openDetail = (rec: Recommendation) => {
    setSelectedRecommendation(rec);
    setDetailDrawerOpen(true);
  };

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canViewForecasts = hasPermission('forecasting', 'viewforecasts');
  const canRunForecasts = hasPermission('forecasting', 'runforecasts');
  const canModifySettings = hasPermission('forecasting', 'modifysettings');

  if (!canViewForecasts) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            {t('noPermission') || 'You do not have permission to view this page.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            {t('forecast.title') || 'Demand Forecast'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {latestRun 
              ? `${t('forecast.lastRun') || 'Last run'}: ${new Date(latestRun.completed_at!).toLocaleString()}`
              : t('forecast.noRunsYet') || 'No forecast runs yet'
            }
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {t('forecast.importHistory') || 'Import History'}
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={recommendations.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {t('export') || 'Export'}
          </Button>
          {canModifySettings && (
            <Button variant="outline" onClick={() => navigate('/forecast-settings')}>
              <Settings className="h-4 w-4 mr-2" />
              {t('settings') || 'Settings'}
            </Button>
          )}
          {canRunForecasts && (
            <Button onClick={runForecast} disabled={runningForecast}>
              {runningForecast ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {t('forecast.runNow') || 'Run Forecast'}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('forecast.reorderNeeded') || 'Items Need Reorder'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReorderNeeded}</div>
            <p className="text-xs text-muted-foreground">
              {t('forecast.outOf') || 'out of'} {recommendations.length} {t('forecast.items') || 'items'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('forecast.criticalAlerts') || 'Critical Alerts'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {warningAlerts} {t('forecast.warnings') || 'warnings'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('forecast.totalStockPosition') || 'Total Stock Position'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStockValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('forecast.acrossAllItems') || 'across all items'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('forecast.runStatus') || 'Run Status'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {runningForecast ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">{t('forecast.running') || 'Running...'}</span>
                </>
              ) : latestRun ? (
                <>
                  <Badge variant={latestRun.status === 'completed' ? 'default' : 'destructive'}>
                    {latestRun.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {latestRun.processed_combinations}/{latestRun.total_combinations}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{t('forecast.noRuns') || 'No runs'}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('forecast.activeAlerts') || 'Active Alerts'} ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.slice(0, 5).map(alert => (
                <div 
                  key={alert.id} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    alert.severity === 'critical' ? 'bg-destructive/10' : 'bg-yellow-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>
                      {alert.severity}
                    </Badge>
                    <span className="font-medium">{alert.quality_code} - {alert.color_code}</span>
                    <span className="text-sm text-muted-foreground">{alert.alert_type}</span>
                  </div>
                  <div className="text-sm">
                    Stock: {alert.current_stock} | Demand: {alert.forecasted_demand}
                  </div>
                </div>
              ))}
              {alerts.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{alerts.length - 5} {t('more') || 'more'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={String(t('searchQualityColor') || 'Search quality or color...')}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                <SelectItem value="pending">{t('pending') || 'Pending'}</SelectItem>
                <SelectItem value="reviewed">{t('reviewed') || 'Reviewed'}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scenarioFilter} onValueChange={(v: any) => setScenarioFilter(v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">{t('forecast.conservative') || 'Conservative'}</SelectItem>
                <SelectItem value="normal">{t('forecast.normal') || 'Normal'}</SelectItem>
                <SelectItem value="aggressive">{t('forecast.aggressive') || 'Aggressive'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('forecast.purchaseRecommendations') || 'Purchase Recommendations'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('forecast.noRecommendations') || 'No recommendations available. Run a forecast first.'}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('quality') || 'Quality'}</TableHead>
                    <TableHead>{t('color') || 'Color'}</TableHead>
                    <TableHead className="text-right">{t('forecast.currentStock') || 'Current Stock'}</TableHead>
                    <TableHead className="text-right">{t('forecast.incoming') || 'Incoming'}</TableHead>
                    <TableHead className="text-right">{t('forecast.inProduction') || 'In Production'}</TableHead>
                    <TableHead className="text-right">{t('forecast.demand12m') || '12M Demand'}</TableHead>
                    <TableHead className="text-right">{t('forecast.recommendation') || 'Recommendation'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecommendations.map((rec) => {
                    const recValue = getRecommendationValue(rec);
                    return (
                      <TableRow 
                        key={rec.id} 
                        className={rec.has_quality_override ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                      >
                        <TableCell className="font-medium">
                          {rec.quality_code}
                          {rec.has_quality_override && (
                            <Badge variant="outline" className="ml-2 text-xs">Override</Badge>
                          )}
                        </TableCell>
                        <TableCell>{rec.color_code}</TableCell>
                        <TableCell className="text-right">{rec.available_stock.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{rec.incoming_stock.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{rec.in_production_stock.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{rec.past_12m_demand.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {recValue > 0 ? (
                            <span className="font-bold text-primary">{recValue.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rec.status === 'reviewed' ? 'default' : 'secondary'}>
                            {rec.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openDetail(rec)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('showing') || 'Showing'} {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRecommendations.length)} {t('of') || 'of'} {filteredRecommendations.length}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      {page} / {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <HistoricalImportModal 
        open={importModalOpen} 
        onOpenChange={setImportModalOpen}
        onSuccess={fetchData}
      />

      <ForecastDetailDrawer
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        recommendation={selectedRecommendation}
        latestRunId={latestRun?.id}
      />
    </div>
  );
};

export default Forecast;
