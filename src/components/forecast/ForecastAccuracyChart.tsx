import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine
} from 'recharts';
import { 
  Target, TrendingUp, TrendingDown, Activity, 
  Loader2, RefreshCw, AlertCircle 
} from 'lucide-react';

interface AccuracyMetric {
  id: string;
  calculation_date: string;
  quality_code: string | null;
  color_code: string | null;
  mape: number | null;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  hit_rate: number | null;
  total_items: number;
}

interface AccuracyDetail {
  id: string;
  quality_code: string;
  color_code: string;
  period_start: string;
  period_end: string;
  forecasted_amount: number;
  actual_amount: number;
  percentage_error: number;
}

const ForecastAccuracyChart: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<AccuracyMetric[]>([]);
  const [details, setDetails] = useState<AccuracyDetail[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('3months');
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const periodMonths = selectedPeriod === '3months' ? 3 : 
                          selectedPeriod === '6months' ? 6 : 12;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - periodMonths);

      // Fetch aggregate metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('forecast_accuracy_metrics')
        .select('*')
        .gte('calculation_date', startDate.toISOString().split('T')[0])
        .order('calculation_date', { ascending: true });

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

      // Fetch detailed accuracy records (limited)
      const { data: detailsData, error: detailsError } = await supabase
        .from('forecast_accuracy')
        .select('*')
        .gte('period_start', startDate.toISOString().split('T')[0])
        .order('percentage_error', { ascending: false })
        .limit(50);

      if (detailsError) throw detailsError;
      setDetails(detailsData || []);

    } catch (error: any) {
      console.error('Error fetching accuracy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAccuracyCalculation = async () => {
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-forecast-accuracy', {
        body: { manual: true }
      });

      if (error) throw error;

      toast({
        title: String(t('success')),
        description: String(t('forecast.accuracyCalculated') || 'Accuracy metrics calculated'),
      });

      fetchData();
    } catch (error: any) {
      console.error('Error calculating accuracy:', error);
      toast({
        title: String(t('error')),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setCalculating(false);
    }
  };

  // Get global metrics (where quality_code is null)
  const globalMetrics = metrics.filter(m => m.quality_code === null);
  const latestGlobal = globalMetrics[globalMetrics.length - 1];

  // Prepare chart data
  const chartData = globalMetrics.map(m => ({
    date: new Date(m.calculation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    mape: m.mape ? parseFloat(m.mape.toFixed(1)) : null,
    hitRate: m.hit_rate ? parseFloat(m.hit_rate.toFixed(1)) : null,
    bias: m.bias ? parseFloat(m.bias.toFixed(1)) : null,
  }));

  // Get worst performers for improvement suggestions
  const worstPerformers = details.slice(0, 10);

  const getMapeColor = (mape: number | null) => {
    if (mape === null) return 'text-muted-foreground';
    if (mape <= 10) return 'text-green-600 dark:text-green-400';
    if (mape <= 20) return 'text-yellow-600 dark:text-yellow-400';
    if (mape <= 30) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getMapeLabel = (mape: number | null) => {
    if (mape === null) return t('forecast.noData') || 'No data';
    if (mape <= 10) return t('forecast.excellent') || 'Excellent';
    if (mape <= 20) return t('forecast.good') || 'Good';
    if (mape <= 30) return t('forecast.fair') || 'Fair';
    return t('forecast.needsImprovement') || 'Needs Improvement';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('forecast.accuracyTracking') || 'Forecast Accuracy'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('forecast.accuracyTrackingDesc') || 'Compare forecasts against actual demand to measure accuracy'}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">3 {t('months') || 'months'}</SelectItem>
              <SelectItem value="6months">6 {t('months') || 'months'}</SelectItem>
              <SelectItem value="12months">12 {t('months') || 'months'}</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={runAccuracyCalculation}
            disabled={calculating}
          >
            {calculating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t('forecast.calculate') || 'Calculate'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('forecast.mape') || 'MAPE'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMapeColor(latestGlobal?.mape ?? null)}`}>
              {latestGlobal?.mape != null ? `${latestGlobal.mape.toFixed(1)}%` : '--'}
            </div>
            <Badge variant="outline" className="mt-1">
              {getMapeLabel(latestGlobal?.mape ?? null)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('forecast.hitRate') || 'Hit Rate'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestGlobal?.hit_rate != null ? `${latestGlobal.hit_rate.toFixed(1)}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('forecast.hitRateDesc') || 'Forecasts within ±20%'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('forecast.bias') || 'Forecast Bias'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {latestGlobal?.bias != null ? (
                <>
                  {latestGlobal.bias > 0 ? '+' : ''}{latestGlobal.bias.toFixed(1)}%
                  {latestGlobal.bias > 5 && <TrendingUp className="h-4 w-4 text-yellow-500" />}
                  {latestGlobal.bias < -5 && <TrendingDown className="h-4 w-4 text-yellow-500" />}
                </>
              ) : '--'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {latestGlobal?.bias != null && latestGlobal.bias > 0 
                ? t('forecast.overForecasting') || 'Over-forecasting' 
                : t('forecast.underForecasting') || 'Under-forecasting'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('forecast.itemsTracked') || 'Items Tracked'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestGlobal?.total_items ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('forecast.qualityColorCombinations') || 'Quality-color combinations'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('forecast.overview') || 'Overview'}</TabsTrigger>
          <TabsTrigger value="trends">{t('forecast.trends') || 'Trends'}</TabsTrigger>
          <TabsTrigger value="worstPerformers">{t('forecast.worstPerformers') || 'Needs Attention'}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('forecast.accuracyOverTime') || 'Accuracy Over Time'}</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))' 
                      }} 
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="mape" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      name="MAPE %"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="hitRate" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Hit Rate %"
                      dot={false}
                    />
                    <ReferenceLine y={20} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mb-4" />
                  <p>{t('forecast.noAccuracyData') || 'No accuracy data available yet'}</p>
                  <p className="text-sm">{t('forecast.runAccuracyCalculation') || 'Run accuracy calculation to see results'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('forecast.biasTrend') || 'Bias Trend'}</CardTitle>
              <CardDescription>
                {t('forecast.biasTrendDesc') || 'Positive = over-forecasting, Negative = under-forecasting'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" domain={[-50, 50]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))' 
                      }} 
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                    <Bar 
                      dataKey="bias" 
                      fill="hsl(var(--primary))"
                      name="Bias %"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  {t('forecast.noData') || 'No data available'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="worstPerformers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('forecast.needsAttention') || 'Items Needing Attention'}</CardTitle>
              <CardDescription>
                {t('forecast.needsAttentionDesc') || 'Items with highest forecast errors - consider adjusting parameters'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {worstPerformers.length > 0 ? (
                <div className="space-y-2">
                  {worstPerformers.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <span className="font-medium">{item.quality_code}</span>
                        <span className="text-muted-foreground mx-2">|</span>
                        <span>{item.color_code}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({new Date(item.period_start).toLocaleDateString()} - {new Date(item.period_end).toLocaleDateString()})
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('forecast.forecasted') || 'Forecast'}:</span>{' '}
                          <span className="font-medium">{item.forecasted_amount.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('forecast.actual') || 'Actual'}:</span>{' '}
                          <span className="font-medium">{item.actual_amount.toLocaleString()}</span>
                        </div>
                        <Badge variant={item.percentage_error > 30 ? 'destructive' : 'secondary'}>
                          {item.percentage_error.toFixed(1)}% {t('forecast.error') || 'error'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  {t('forecast.noErrorsFound') || 'No significant errors found'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ForecastAccuracyChart;
