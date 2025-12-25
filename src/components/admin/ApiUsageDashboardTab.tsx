import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Activity, BarChart3, Clock, AlertTriangle, CheckCircle, TrendingUp, Loader2, Key, Zap, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  service: string;
  is_active: boolean;
  rate_limit_per_minute: number | null;
  last_used_at: string | null;
}

interface RequestLog {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number | null;
  response_time_ms: number | null;
  created_at: string;
  error_message: string | null;
}

interface UsageStats {
  keyId: string;
  keyName: string;
  keyPrefix: string;
  service: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  rateLimit: number;
  currentUsage: number;
  lastUsed: string | null;
  isActive: boolean;
}

interface DailyStats {
  date: string;
  requests: number;
  errors: number;
}

const ApiUsageDashboardTab: React.FC = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('7');
  const [totalRequests, setTotalRequests] = useState(0);
  const [errorRate, setErrorRate] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);

  const fetchData = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const days = parseInt(selectedPeriod);
      const startDate = startOfDay(subDays(new Date(), days)).toISOString();
      
      // Fetch API keys and request logs in parallel
      const [keysResult, logsResult] = await Promise.all([
        supabase
          .from('api_keys')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('api_request_logs')
          .select('*')
          .gte('created_at', startDate)
          .order('created_at', { ascending: false })
          .limit(10000) // Limit for performance
      ]);

      if (keysResult.error) throw keysResult.error;
      if (logsResult.error) throw logsResult.error;

      const keys = (keysResult.data || []) as ApiKey[];
      const logs = (logsResult.data || []) as RequestLog[];
      
      setApiKeys(keys);
      setRequestLogs(logs);
      
      // Calculate stats from real data
      calculateStatsFromLogs(keys, logs, days);
    } catch (error) {
      console.error('Error fetching API usage data:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'API kullanım verileri alınamadı' : 'Failed to fetch API usage data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, language, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateStatsFromLogs = (keys: ApiKey[], logs: RequestLog[], days: number) => {
    // Calculate usage stats per key
    const statsMap = new Map<string, UsageStats>();
    
    // Initialize stats for each key
    keys.forEach((key) => {
      statsMap.set(key.id, {
        keyId: key.id,
        keyName: key.name,
        keyPrefix: key.key_prefix,
        service: key.service,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        rateLimit: key.rate_limit_per_minute || 60,
        currentUsage: 0,
        lastUsed: key.last_used_at,
        isActive: key.is_active,
      });
    });

    // Aggregate logs by key
    const responseTimes: Map<string, number[]> = new Map();
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    
    logs.forEach((log) => {
      const stat = statsMap.get(log.api_key_id);
      if (stat) {
        stat.totalRequests++;
        
        if (log.status_code && log.status_code >= 200 && log.status_code < 400) {
          stat.successfulRequests++;
        } else {
          stat.failedRequests++;
        }
        
        if (log.response_time_ms) {
          if (!responseTimes.has(log.api_key_id)) {
            responseTimes.set(log.api_key_id, []);
          }
          responseTimes.get(log.api_key_id)!.push(log.response_time_ms);
        }
        
        // Count requests in the last minute for current rate limit usage
        if (log.created_at >= oneMinuteAgo) {
          stat.currentUsage++;
        }
      }
    });

    // Calculate average response times
    responseTimes.forEach((times, keyId) => {
      const stat = statsMap.get(keyId);
      if (stat && times.length > 0) {
        stat.avgResponseTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      }
    });

    const statsArray = Array.from(statsMap.values());
    setUsageStats(statsArray);

    // Calculate totals
    const total = statsArray.reduce((sum, stat) => sum + stat.totalRequests, 0);
    const errors = statsArray.reduce((sum, stat) => sum + stat.failedRequests, 0);
    const avgTime = statsArray.filter(s => s.avgResponseTime > 0).length > 0
      ? statsArray.filter(s => s.avgResponseTime > 0).reduce((sum, stat) => sum + stat.avgResponseTime, 0) / statsArray.filter(s => s.avgResponseTime > 0).length
      : 0;

    setTotalRequests(total);
    setErrorRate(total > 0 ? (errors / total) * 100 : 0);
    setAvgResponseTime(Math.round(avgTime));

    // Calculate daily stats
    const dailyMap = new Map<string, { requests: number; errors: number }>();
    
    // Initialize all days
    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyMap.set(date, { requests: 0, errors: 0 });
    }
    
    // Aggregate logs by day
    logs.forEach((log) => {
      const date = format(parseISO(log.created_at), 'yyyy-MM-dd');
      const dayStats = dailyMap.get(date);
      if (dayStats) {
        dayStats.requests++;
        if (!log.status_code || log.status_code >= 400) {
          dayStats.errors++;
        }
      }
    });

    const dailyData: DailyStats[] = [];
    dailyMap.forEach((stats, date) => {
      dailyData.push({
        date: format(parseISO(date), 'MMM dd'),
        requests: stats.requests,
        errors: stats.errors,
      });
    });
    
    setDailyStats(dailyData);
  };

  const getUsagePercentage = (current: number, limit: number) => {
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-destructive';
    if (percentage >= 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getServiceLabel = (service: string) => {
    const labels: Record<string, string> = {
      crm: 'CRM',
      portal: 'Portal',
      erp: 'ERP',
      custom: 'Custom',
    };
    return labels[service] || service;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {language === 'tr' ? 'API Kullanım Paneli' : 'API Usage Dashboard'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === 'tr' ? 'API isteklerini, hız limitlerini ve performansı izleyin' : 'Monitor API requests, rate limits, and performance'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {language === 'tr' ? 'Yenile' : 'Refresh'}
          </Button>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{language === 'tr' ? 'Son 24 saat' : 'Last 24 hours'}</SelectItem>
              <SelectItem value="7">{language === 'tr' ? 'Son 7 gün' : 'Last 7 days'}</SelectItem>
              <SelectItem value="30">{language === 'tr' ? 'Son 30 gün' : 'Last 30 days'}</SelectItem>
              <SelectItem value="90">{language === 'tr' ? 'Son 90 gün' : 'Last 90 days'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'tr' ? 'Toplam İstek' : 'Total Requests'}
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'tr' ? `Son ${selectedPeriod} gün` : `Last ${selectedPeriod} day${selectedPeriod !== '1' ? 's' : ''}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'tr' ? 'Başarı Oranı' : 'Success Rate'}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests > 0 ? (100 - errorRate).toFixed(1) : '100'}%</div>
            <p className="text-xs text-muted-foreground">
              {errorRate.toFixed(2)}% {language === 'tr' ? 'hata oranı' : 'error rate'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'tr' ? 'Ort. Yanıt Süresi' : 'Avg Response Time'}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              {language === 'tr' ? 'Ortalama gecikme' : 'Average latency'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'tr' ? 'Aktif Anahtarlar' : 'Active Keys'}
            </CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiKeys.filter(k => k.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {language === 'tr' ? `toplam ${apiKeys.length} anahtar` : `of ${apiKeys.length} total keys`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {language === 'tr' ? 'Günlük İstek Hacmi' : 'Daily Request Volume'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' ? 'Seçilen dönem için API istekleri' : 'API requests over the selected period'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyStats.length === 0 || dailyStats.every(d => d.requests === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{language === 'tr' ? 'Seçilen dönem için veri yok' : 'No data available for the selected period'}</p>
              <p className="text-sm">{language === 'tr' ? 'API istekleri yapıldığında burada görünecek' : 'API requests will appear here once made'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dailyStats.map((day, index) => {
                const maxRequests = Math.max(...dailyStats.map(d => d.requests));
                const percentage = maxRequests > 0 ? (day.requests / maxRequests) * 100 : 0;
                
                return (
                  <div key={index} className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16">{day.date}</span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-20 text-right">
                      {day.requests.toLocaleString()}
                    </span>
                    {day.errors > 0 && (
                      <span className="text-xs text-destructive w-16 text-right">
                        ({day.errors} {language === 'tr' ? 'hata' : 'errors'})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Per Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {language === 'tr' ? 'API Anahtarına Göre Kullanım' : 'Usage by API Key'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' ? 'Her API anahtarı için istek sayısı ve hız limit durumu' : 'Request counts and rate limit status per API key'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{language === 'tr' ? 'API anahtarı yapılandırılmadı' : 'No API keys configured'}</p>
              <p className="text-sm">{language === 'tr' ? 'Kullanımı izlemeye başlamak için bir API anahtarı oluşturun' : 'Create an API key to start tracking usage'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'tr' ? 'Anahtar Adı' : 'Key Name'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Servis' : 'Service'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Durum' : 'Status'}</TableHead>
                  <TableHead>{language === 'tr' ? 'İstekler' : 'Requests'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Başarı Oranı' : 'Success Rate'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Ort. Yanıt' : 'Avg Response'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Hız Limiti' : 'Rate Limit Usage'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageStats.map((stat) => {
                  const successRate = stat.totalRequests > 0
                    ? ((stat.successfulRequests / stat.totalRequests) * 100).toFixed(1)
                    : '100';
                  const rateLimitPercentage = getUsagePercentage(stat.currentUsage, stat.rateLimit);

                  return (
                    <TableRow key={stat.keyId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{stat.keyName}</p>
                          <code className="text-xs text-muted-foreground">{stat.keyPrefix}...</code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getServiceLabel(stat.service)}</Badge>
                      </TableCell>
                      <TableCell>
                        {stat.isActive ? (
                          <Badge variant="default">{language === 'tr' ? 'Aktif' : 'Active'}</Badge>
                        ) : (
                          <Badge variant="secondary">{language === 'tr' ? 'Pasif' : 'Inactive'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{stat.totalRequests.toLocaleString()}</span>
                          {stat.failedRequests > 0 && (
                            <span className="text-destructive ml-2">
                              ({stat.failedRequests} {language === 'tr' ? 'hata' : 'errors'})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={parseFloat(successRate) < 95 ? 'text-yellow-500' : 'text-green-500'}>
                          {successRate}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={stat.avgResponseTime > 200 ? 'text-yellow-500' : ''}>
                          {stat.avgResponseTime > 0 ? `${stat.avgResponseTime}ms` : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={getUsageColor(rateLimitPercentage)}>
                              {stat.currentUsage}/{stat.rateLimit}
                            </span>
                            <span className="text-muted-foreground">
                              {rateLimitPercentage.toFixed(0)}%
                            </span>
                          </div>
                          <Progress 
                            value={rateLimitPercentage} 
                            className={`h-2 ${rateLimitPercentage >= 90 ? '[&>div]:bg-destructive' : rateLimitPercentage >= 70 ? '[&>div]:bg-yellow-500' : ''}`}
                          />
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

      {/* Rate Limit Alerts */}
      {usageStats.some(stat => getUsagePercentage(stat.currentUsage, stat.rateLimit) >= 70) && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              {language === 'tr' ? 'Hız Limiti Uyarıları' : 'Rate Limit Warnings'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usageStats
                .filter(stat => getUsagePercentage(stat.currentUsage, stat.rateLimit) >= 70)
                .map((stat) => (
                  <div key={stat.keyId} className="flex items-center justify-between p-3 bg-background rounded-lg">
                    <div>
                      <p className="font-medium">{stat.keyName}</p>
                      <p className="text-sm text-muted-foreground">
                        {language === 'tr' 
                          ? `Dakika başına ${stat.rateLimit} istekten ${stat.currentUsage} kullanılıyor`
                          : `Using ${stat.currentUsage} of ${stat.rateLimit} requests/minute`
                        }
                      </p>
                    </div>
                    <Badge variant={getUsagePercentage(stat.currentUsage, stat.rateLimit) >= 90 ? 'destructive' : 'secondary'}>
                      {getUsagePercentage(stat.currentUsage, stat.rateLimit).toFixed(0)}% {language === 'tr' ? 'kullanıldı' : 'used'}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApiUsageDashboardTab;
