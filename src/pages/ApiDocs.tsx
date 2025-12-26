import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Book, Code, Key, Database, Webhook, Shield, Copy, ExternalLink, 
  Check, ChevronRight, Server, Lock, Zap, FileJson, ArrowRight
} from 'lucide-react';

const SUPABASE_URL = 'https://kwcwbyfzzordqwudixvl.supabase.co';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: 'API Key' | 'JWT' | 'CRON' | 'Admin';
  requestBody?: string;
  responseBody?: string;
  category: string;
}

const ENDPOINTS: Endpoint[] = [
  // Public API Endpoints
  {
    method: 'GET',
    path: '/functions/v1/api-get-inventory',
    description: 'Retrieve inventory summary grouped by quality and color',
    auth: 'API Key',
    category: 'Inventory',
    requestBody: '// Query params: ?quality=SELENA&color=Navy',
    responseBody: `{
  "success": true,
  "data": [
    {
      "quality": "SELENA",
      "color": "Navy Blue",
      "total_meters": 2500,
      "available_meters": 2100,
      "reserved_meters": 400,
      "lot_count": 5
    }
  ],
  "meta": { "total": 45, "page": 1, "limit": 100 }
}`
  },
  {
    method: 'GET',
    path: '/functions/v1/api-get-catalog',
    description: 'Retrieve catalog items with filtering and pagination',
    auth: 'API Key',
    category: 'Catalog',
    requestBody: '// Query params: ?type=fabric&status=active&limit=50',
    responseBody: `{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "lastro_sku_code": "FAB-SEL-001",
      "code": "SELENA",
      "color_name": "Navy Blue",
      "type": "fabric",
      "status": "active",
      "weight_g_m2": 280,
      "composition": { "cotton": 95, "elastane": 5 }
    }
  ]
}`
  },
  {
    method: 'POST',
    path: '/functions/v1/api-create-order',
    description: 'Create a new order with line items',
    auth: 'API Key',
    category: 'Orders',
    requestBody: `{
  "customer_name": "ACME Textiles",
  "po_number": "PO-2025-001",
  "notes": "Urgent delivery",
  "lines": [
    {
      "quality": "SELENA",
      "color": "Navy Blue",
      "meters": 500,
      "roll_count": 5
    }
  ]
}`,
    responseBody: `{
  "success": true,
  "order_id": "uuid",
  "order_number": "ORD-2025-0042",
  "lines_created": 1
}`
  },
  // Webhook Events
  {
    method: 'POST',
    path: '/functions/v1/webhook-dispatcher',
    description: 'Dispatch webhook events to registered endpoints',
    auth: 'API Key',
    category: 'Webhooks',
    requestBody: `{
  "event": "order.created",
  "data": {
    "order_id": "uuid",
    "customer_name": "ACME"
  }
}`,
    responseBody: `{
  "success": true,
  "dispatched_to": 3,
  "results": [
    { "endpoint": "https://...", "status": 200 }
  ]
}`
  },
  // AI Features
  {
    method: 'POST',
    path: '/functions/v1/extract-order',
    description: 'AI-powered order extraction from text or images',
    auth: 'JWT',
    category: 'AI Features',
    requestBody: `{
  "text": "Order: 500m SELENA Navy, 300m MONTANA Black",
  "source_type": "manual"
}`,
    responseBody: `{
  "success": true,
  "draft_id": "uuid",
  "lines": [
    {
      "quality": "SELENA",
      "color": "Navy",
      "meters": 500,
      "confidence_score": 0.95
    }
  ]
}`
  },
  {
    method: 'POST',
    path: '/functions/v1/forecast-engine',
    description: 'Run demand forecasting calculations',
    auth: 'JWT',
    category: 'Forecast',
    requestBody: `{
  "run_type": "full",
  "quality_filter": ["SELENA", "MONTANA"]
}`,
    responseBody: `{
  "success": true,
  "run_id": "uuid",
  "processed_combinations": 156,
  "alerts_generated": 12
}`
  }
];

const WEBHOOK_EVENTS = [
  { event: 'order.created', description: 'Fired when a new order is created' },
  { event: 'order.updated', description: 'Fired when an order is modified' },
  { event: 'order.fulfilled', description: 'Fired when an order is marked complete' },
  { event: 'inventory.low_stock', description: 'Fired when stock falls below threshold' },
  { event: 'inventory.updated', description: 'Fired when inventory quantities change' },
  { event: 'lot.received', description: 'Fired when a new lot is received' },
  { event: 'catalog.updated', description: 'Fired when catalog items are modified' },
];

const ApiDocs: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast({ title: t('copied') as string, description: `${label} copied to clipboard` });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
      PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    return <Badge className={`${colors[method]} font-mono text-xs`}>{method}</Badge>;
  };

  const categories = [...new Set(ENDPOINTS.map(e => e.category))];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b bg-gradient-to-b from-muted/50 to-background">
        <div className="container max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Book className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('apiDocumentation')}</h1>
              <p className="text-muted-foreground">{t('apiDocumentationSubtitle')}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Card className="bg-card/50 backdrop-blur border-muted">
              <CardContent className="p-4 flex items-start gap-3">
                <Server className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{t('baseUrl')}</p>
                  <code className="text-xs text-muted-foreground">{SUPABASE_URL}</code>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-muted">
              <CardContent className="p-4 flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{t('authentication')}</p>
                  <p className="text-xs text-muted-foreground">{t('apiKeyOrJwt')}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-muted">
              <CardContent className="p-4 flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{t('rateLimit')}</p>
                  <p className="text-xs text-muted-foreground">{t('rateLimitDescription')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="endpoints" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="endpoints" className="gap-2">
              <Code className="h-4 w-4" />
              {t('endpoints')}
            </TabsTrigger>
            <TabsTrigger value="authentication" className="gap-2">
              <Key className="h-4 w-4" />
              {t('auth')}
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="h-4 w-4" />
              {t('webhooks')}
            </TabsTrigger>
            <TabsTrigger value="examples" className="gap-2">
              <FileJson className="h-4 w-4" />
              {t('examples')}
            </TabsTrigger>
          </TabsList>

          {/* Endpoints Tab */}
          <TabsContent value="endpoints" className="space-y-6">
            {categories.map(category => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg">{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Accordion type="multiple" className="w-full">
                    {ENDPOINTS.filter(e => e.category === category).map((endpoint, idx) => (
                      <AccordionItem key={idx} value={`${category}-${idx}`} className="border rounded-lg mb-2 px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-3 text-left">
                            {getMethodBadge(endpoint.method)}
                            <code className="text-sm font-mono">{endpoint.path}</code>
                            <Badge variant="outline" className="ml-2 text-xs">{endpoint.auth}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <p className="text-muted-foreground mb-4">{endpoint.description}</p>
                          
                          {endpoint.requestBody && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                  {t('requestBody')}
                                </Label>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => copyToClipboard(endpoint.requestBody!, 'Request')}
                                >
                                  {copiedText === 'Request' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                                <code>{endpoint.requestBody}</code>
                              </pre>
                            </div>
                          )}
                          
                          {endpoint.responseBody && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                  {t('responseBody')}
                                </Label>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => copyToClipboard(endpoint.responseBody!, 'Response')}
                                >
                                  {copiedText === 'Response' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                                <code>{endpoint.responseBody}</code>
                              </pre>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Authentication Tab */}
          <TabsContent value="authentication" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  {t('apiKeyAuth')}
                </CardTitle>
                <CardDescription>{t('apiKeyAuthDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
                    {t('requestHeader')}
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background p-2 rounded text-sm font-mono">
                      x-api-key: lot_crm_xxxxxxxxxxxxxxxxxxxxxxxx
                    </code>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard('x-api-key: lot_crm_xxxxxxxxxxxxxxxxxxxxxxxx', 'Header')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">{t('keyPrefixes')}</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li><code className="text-primary">lot_crm_*</code> - CRM Integration</li>
                      <li><code className="text-primary">lot_portal_*</code> - Customer Portal</li>
                      <li><code className="text-primary">lot_erp_*</code> - ERP System</li>
                      <li><code className="text-primary">lot_custom_*</code> - Custom Integration</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">{t('permissions')}</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li><code className="text-primary">inventory.read</code> - Read inventory</li>
                      <li><code className="text-primary">catalog.read</code> - Read catalog</li>
                      <li><code className="text-primary">orders.read</code> - View orders</li>
                      <li><code className="text-primary">orders.create</code> - Create orders</li>
                      <li><code className="text-primary">webhooks.manage</code> - Manage webhooks</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t('jwtAuth')}
                </CardTitle>
                <CardDescription>{t('jwtAuthDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
                    {t('requestHeader')}
                  </Label>
                  <code className="bg-background p-2 rounded text-sm font-mono block">
                    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                  </code>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  {t('availableEvents')}
                </CardTitle>
                <CardDescription>{t('webhookEventsDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {WEBHOOK_EVENTS.map(event => (
                    <div key={event.event} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">{event.event}</Badge>
                        <span className="text-sm text-muted-foreground">{event.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('webhookPayloadFormat')}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{`{
  "event": "order.created",
  "timestamp": "2025-01-10T14:30:00Z",
  "data": {
    "order_id": "uuid",
    "customer_name": "ACME Textiles",
    "total_meters": 500,
    "lines": [...]
  },
  "signature": "sha256=xxxxxxxxxxxxxxxx"
}`}</code>
                </pre>
                <p className="text-sm text-muted-foreground mt-4">
                  {t('webhookSignatureNote')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('curlExamples')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
                    {t('getInventory')}
                  </Label>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{`curl -X GET "${SUPABASE_URL}/functions/v1/api-get-inventory?quality=SELENA" \\
  -H "x-api-key: lot_crm_your_api_key_here"`}</code>
                    </pre>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(`curl -X GET "${SUPABASE_URL}/functions/v1/api-get-inventory?quality=SELENA" \\\n  -H "x-api-key: lot_crm_your_api_key_here"`, 'GET curl')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
                    {t('createOrder')}
                  </Label>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{`curl -X POST "${SUPABASE_URL}/functions/v1/api-create-order" \\
  -H "x-api-key: lot_crm_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name": "ACME Textiles",
    "lines": [
      { "quality": "SELENA", "color": "Navy", "meters": 500 }
    ]
  }'`}</code>
                    </pre>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(`curl command`, 'POST curl')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('javascriptExamples')}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{`// Using fetch
const response = await fetch(
  '${SUPABASE_URL}/functions/v1/api-get-inventory',
  {
    headers: {
      'x-api-key': 'lot_crm_your_api_key_here'
    }
  }
);
const data = await response.json();
console.log(data);

// Using Supabase client (for JWT auth)
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.functions.invoke('extract-order', {
  body: { text: 'Order: 500m SELENA Navy' }
});`}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ApiDocs;
