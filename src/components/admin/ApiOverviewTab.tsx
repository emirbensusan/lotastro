import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Book, Code, Key, Copy, ExternalLink, CheckCircle, 
  AlertCircle, Activity, Clock, Zap, ArrowRight, RefreshCw,
  Database, Shield, HardDrive, Server
} from 'lucide-react';
import { Link } from 'react-router-dom';

const SUPABASE_URL = 'https://kwcwbyfzzordqwudixvl.supabase.co';

interface ApiStats {
  total_keys: number;
  active_keys: number;
  total_requests_24h: number;
  error_rate_24h: number;
  active_webhooks: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: 'pass' | 'fail'; latency_ms?: number };
    auth: { status: 'pass' | 'fail'; latency_ms?: number };
    storage: { status: 'pass' | 'fail'; latency_ms?: number };
    functions: { status: 'pass' | 'fail'; latency_ms?: number };
  };
}

const ApiOverviewTab: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [stats, setStats] = useState<ApiStats>({
    total_keys: 0,
    active_keys: 0,
    total_requests_24h: 0,
    error_rate_24h: 0,
    active_webhooks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/health-check`);
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'fail' },
          auth: { status: 'fail' },
          storage: { status: 'fail' },
          functions: { status: 'fail' },
        },
      });
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Fetch API key stats
      const { data: apiKeys } = await supabase
        .from('api_keys')
        .select('id, is_active');
      
      // Fetch webhook stats
      const { data: webhooks } = await supabase
        .from('webhook_subscriptions')
        .select('id, is_active');

      // Fetch request logs from last 24h
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: requestLogs } = await supabase
        .from('api_request_logs')
        .select('id, status_code')
        .gte('created_at', yesterday.toISOString());

      const totalRequests = requestLogs?.length || 0;
      const errorRequests = requestLogs?.filter(r => r.status_code && r.status_code >= 400).length || 0;
      
      setStats({
        total_keys: apiKeys?.length || 0,
        active_keys: apiKeys?.filter(k => k.is_active).length || 0,
        total_requests_24h: totalRequests,
        error_rate_24h: totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0,
        active_webhooks: webhooks?.filter(w => w.is_active).length || 0,
      });
    } catch (error) {
      console.error('Error fetching API stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('copied') as string });
  };

  return (
    <div className="space-y-6">
      {/* System Health */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {t('systemHealth')}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchHealth}
              disabled={healthLoading}
            >
              <RefreshCw className={`h-4 w-4 ${healthLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge 
              variant={health?.status === 'healthy' ? 'default' : health?.status === 'degraded' ? 'secondary' : 'destructive'}
              className={health?.status === 'healthy' ? 'bg-emerald-500' : ''}
            >
              {health?.status === 'healthy' ? t('allSystemsOperational') : 
               health?.status === 'degraded' ? t('partialOutage') : t('systemDown')}
            </Badge>
            {health?.timestamp && (
              <span className="text-xs text-muted-foreground">
                {t('lastChecked')}: {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'database', icon: Database, label: t('healthDatabase') },
              { key: 'auth', icon: Shield, label: t('healthAuth') },
              { key: 'storage', icon: HardDrive, label: t('healthStorage') },
              { key: 'functions', icon: Zap, label: t('healthFunctions') },
            ].map(({ key, icon: Icon, label }) => {
              const check = health?.checks?.[key as keyof typeof health.checks];
              return (
                <div 
                  key={key}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    check?.status === 'pass' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${check?.status === 'pass' ? 'text-emerald-500' : 'text-destructive'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{label}</p>
                    {check?.latency_ms !== undefined && (
                      <p className="text-[10px] text-muted-foreground">{check.latency_ms}ms</p>
                    )}
                  </div>
                  {check?.status === 'pass' ? (
                    <CheckCircle className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active_keys}/{stats.total_keys}</p>
                <p className="text-xs text-muted-foreground">{t('activeApiKeys')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_requests_24h.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t('requests24h')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.error_rate_24h > 5 ? 'bg-destructive/10' : 'bg-emerald-500/10'}`}>
                {stats.error_rate_24h > 5 ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.error_rate_24h.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{t('errorRate')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active_webhooks}</p>
                <p className="text-xs text-muted-foreground">{t('activeWebhooks')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            {t('quickStartGuide')}
          </CardTitle>
          <CardDescription>{t('quickStartDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-2">{t('step1CreateApiKey')}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {t('step1Description')}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin?tab=api-keys">
                  {t('goToApiKeys')} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-2">{t('step2MakeRequest')}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {t('step2Description')}
              </p>
              <div className="bg-muted p-3 rounded-lg relative">
                <pre className="text-xs overflow-x-auto">
                  <code>{`curl -X GET "${SUPABASE_URL}/functions/v1/api-get-inventory" \\
  -H "x-api-key: YOUR_API_KEY"`}</code>
                </pre>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute top-1 right-1"
                  onClick={() => copyToClipboard(`curl -X GET "${SUPABASE_URL}/functions/v1/api-get-inventory" -H "x-api-key: YOUR_API_KEY"`)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-2">{t('step3SetupWebhooks')}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {t('step3Description')}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin?tab=webhooks">
                  {t('configureWebhooks')} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Endpoints Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                {t('availableEndpoints')}
              </CardTitle>
              <CardDescription>{t('availableEndpointsDescription')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/api-docs">
                {t('viewFullDocs')} <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {[
              { method: 'GET', path: '/api-get-inventory', desc: t('getInventoryDesc') },
              { method: 'GET', path: '/api-get-catalog', desc: t('getCatalogDesc') },
              { method: 'POST', path: '/api-create-order', desc: t('createOrderDesc') },
              { method: 'POST', path: '/webhook-dispatcher', desc: t('dispatchWebhookDesc') },
            ].map((endpoint, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Badge 
                  variant="outline" 
                  className={`font-mono text-xs ${endpoint.method === 'GET' ? 'border-emerald-500 text-emerald-500' : 'border-blue-500 text-blue-500'}`}
                >
                  {endpoint.method}
                </Badge>
                <code className="text-sm font-mono flex-1">{endpoint.path}</code>
                <span className="text-sm text-muted-foreground hidden md:block">{endpoint.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Base URL & Auth Info */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('baseUrl')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-2 rounded text-sm truncate">{SUPABASE_URL}/functions/v1</code>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`${SUPABASE_URL}/functions/v1`)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('rateLimits')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{t('perKeyLimit')}</span>
              </div>
              <Badge variant="secondary">{t('configurablePerKey')}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApiOverviewTab;
