import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Activity, BarChart3, Clock, AlertTriangle, CheckCircle, TrendingUp, Loader2, Key, Zap } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Progress } from '@/components/ui/progress';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  service: string;
  is_active: boolean;
  rate_limit_per_minute: number | null;
  last_used_at: string | null;
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
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('7');
  const [totalRequests, setTotalRequests] = useState(0);
  const [errorRate, setErrorRate] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  useEffect(() => {
    if (apiKeys.length > 0) {
      calculateStats();
    }
  }, [apiKeys, selectedPeriod]);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys((data || []) as ApiKey[]);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch API keys',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async () => {
    // In a real implementation, you would fetch actual usage data from an api_requests_log table
    // For now, we'll generate mock statistics based on the API keys
    const days = parseInt(selectedPeriod);
    
    // Generate mock usage stats per key
    const mockUsageStats: UsageStats[] = apiKeys.map((key) => {
      const baseRequests = key.is_active ? Math.floor(Math.random() * 5000) + 100 : 0;
      const errorCount = Math.floor(baseRequests * (Math.random() * 0.05)); // 0-5% error rate
      
      return {
        keyId: key.id,
        keyName: key.name,
        keyPrefix: key.key_prefix,
        service: key.service,
        totalRequests: baseRequests,
        successfulRequests: baseRequests - errorCount,
        failedRequests: errorCount,
        avgResponseTime: Math.floor(Math.random() * 200) + 50,
        rateLimit: key.rate_limit_per_minute || 60,
        currentUsage: key.is_active ? Math.floor(Math.random() * (key.rate_limit_per_minute || 60)) : 0,
        lastUsed: key.last_used_at,
        isActive: key.is_active,
      };
    });

    setUsageStats(mockUsageStats);

    // Calculate totals
    const total = mockUsageStats.reduce((sum, stat) => sum + stat.totalRequests, 0);
    const errors = mockUsageStats.reduce((sum, stat) => sum + stat.failedRequests, 0);
    const avgTime = mockUsageStats.length > 0
      ? mockUsageStats.reduce((sum, stat) => sum + stat.avgResponseTime, 0) / mockUsageStats.length
      : 0;

    setTotalRequests(total);
    setErrorRate(total > 0 ? (errors / total) * 100 : 0);
    setAvgResponseTime(Math.round(avgTime));

    // Generate daily stats for the chart
    const dailyData: DailyStats[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const requests = Math.floor(Math.random() * (total / days) * 1.5);
      const errors = Math.floor(requests * (Math.random() * 0.05));
      dailyData.push({
        date: format(date, 'MMM dd'),
        requests,
        errors,
      });
    }
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
            API Usage Dashboard
          </h3>
          <p className="text-sm text-muted-foreground">Monitor API requests, rate limits, and performance</p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Last {selectedPeriod} day{selectedPeriod !== '1' ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(100 - errorRate).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {errorRate.toFixed(2)}% error rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              Average latency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiKeys.filter(k => k.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {apiKeys.length} total keys
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Usage Chart (Simple Bar Representation) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Request Volume
          </CardTitle>
          <CardDescription>API requests over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No data available for the selected period</p>
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
            Usage by API Key
          </CardTitle>
          <CardDescription>Request counts and rate limit status per API key</CardDescription>
        </CardHeader>
        <CardContent>
          {usageStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys configured</p>
              <p className="text-sm">Create an API key to start tracking usage</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key Name</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Avg Response</TableHead>
                  <TableHead>Rate Limit Usage</TableHead>
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
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{stat.totalRequests.toLocaleString()}</span>
                          {stat.failedRequests > 0 && (
                            <span className="text-destructive ml-2">
                              ({stat.failedRequests} errors)
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
                          {stat.avgResponseTime}ms
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
              Rate Limit Warnings
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
                        Using {stat.currentUsage} of {stat.rateLimit} requests/minute
                      </p>
                    </div>
                    <Badge variant={getUsagePercentage(stat.currentUsage, stat.rateLimit) >= 90 ? 'destructive' : 'secondary'}>
                      {getUsagePercentage(stat.currentUsage, stat.rateLimit).toFixed(0)}% used
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
