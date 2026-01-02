import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Webhook, Plus, Trash2, Eye, Loader2, CheckCircle, XCircle, Copy, Play, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WebhookSubscription {
  id: string;
  name: string;
  endpoint_url: string;
  event_type: string;
  events: string[];
  is_active: boolean;
  secret: string;
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
  max_retries: number;
}

interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event: string;
  event_type: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  response_status: number | null;
  error_message: string | null;
  delivered_at: string | null;
  duration_ms: number | null;
  success: boolean;
  retry_count: number;
  next_retry_at: string | null;
}

const AVAILABLE_EVENTS = [
  { key: 'order.created', label: 'Order Created', description: 'When a new order is created' },
  { key: 'order.fulfilled', label: 'Order Fulfilled', description: 'When an order is marked fulfilled' },
  { key: 'order.cancelled', label: 'Order Cancelled', description: 'When an order is cancelled' },
  { key: 'lot.received', label: 'Lot Received', description: 'When new stock is received' },
  { key: 'inventory.updated', label: 'Inventory Updated', description: 'When inventory levels change' },
  { key: 'inventory.low_stock', label: 'Low Stock Alert', description: 'When stock falls below threshold' },
  { key: 'catalog.updated', label: 'Catalog Updated', description: 'When catalog items change' },
  { key: 'reservation.created', label: 'Reservation Created', description: 'When a reservation is made' },
  { key: 'reservation.fulfilled', label: 'Reservation Fulfilled', description: 'When a reservation is fulfilled' },
];

const WebhookSubscriptionsTab: React.FC = () => {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deliveriesDialogOpen, setDeliveriesDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<WebhookSubscription | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const [webhookName, setWebhookName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['order.created']);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('webhook_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map legacy event_type to events array if needed
      const mapped = (data || []).map(sub => ({
        ...sub,
        events: sub.events || (sub.event_type ? [sub.event_type] : ['order.created']),
      }));
      
      setSubscriptions(mapped as WebhookSubscription[]);
    } catch (error) {
      console.error('Error fetching webhook subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveries = async (subscriptionId: string) => {
    setLoadingDeliveries(true);
    try {
      const { data, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('delivered_at', { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) throw error;
      setDeliveries((data || []) as unknown as WebhookDelivery[]);
    } catch (error) {
      console.error('Error fetching webhook deliveries:', error);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const generateSecret = (): string => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleCreateSubscription = async () => {
    if (!webhookName.trim() || !endpointUrl.trim()) {
      toast({ title: 'Validation Error', description: 'Please fill all fields', variant: 'destructive' });
      return;
    }

    if (selectedEvents.length === 0) {
      toast({ title: 'Validation Error', description: 'Please select at least one event', variant: 'destructive' });
      return;
    }

    try { new URL(endpointUrl); } catch {
      toast({ title: 'Validation Error', description: 'Please enter a valid URL', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('webhook_subscriptions').insert({
        name: webhookName,
        endpoint_url: endpointUrl,
        event_type: selectedEvents[0], // Keep for backward compatibility
        events: selectedEvents,
        secret: generateSecret(),
        is_active: true,
        failure_count: 0,
        max_retries: 5,
      });

      if (error) throw error;
      toast({ title: 'Webhook Created', description: 'Your webhook subscription has been created.' });
      setCreateDialogOpen(false);
      resetForm();
      fetchSubscriptions();
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({ title: 'Error', description: 'Failed to create webhook', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleTestWebhook = async (sub: WebhookSubscription) => {
    setTestingWebhook(sub.id);
    try {
      const testEvent = sub.events?.[0] || sub.event_type || 'test.ping';
      const testPayload = {
        event: testEvent,
        data: {
          test: true,
          message: 'This is a test webhook from LotAstro',
          subscription_id: sub.id,
          subscription_name: sub.name,
          timestamp: new Date().toISOString(),
        },
      };

      const { data, error } = await supabase.functions.invoke('webhook-dispatcher', {
        body: testPayload,
      });

      if (error) throw error;

      if (data?.delivered > 0) {
        toast({
          title: 'Test Successful',
          description: `Webhook delivered to ${sub.endpoint_url}`,
        });
      } else if (data?.failed > 0) {
        toast({
          title: 'Test Failed',
          description: 'Webhook delivery failed. Check the delivery history for details.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'No Match',
          description: 'No active subscriptions matched the test event.',
          variant: 'default',
        });
      }

      fetchSubscriptions();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error testing webhook:', error);
      toast({
        title: 'Test Failed',
        description: errorMessage || 'Failed to send test webhook',
        variant: 'destructive',
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleToggleActive = async (sub: WebhookSubscription) => {
    try {
      const { error } = await supabase.from('webhook_subscriptions').update({ is_active: !sub.is_active }).eq('id', sub.id);
      if (error) throw error;
      fetchSubscriptions();
    } catch (error) {
      console.error('Error toggling webhook:', error);
    }
  };

  const handleDeleteSubscription = async () => {
    if (!selectedSubscription) return;
    try {
      const { error } = await supabase.from('webhook_subscriptions').delete().eq('id', selectedSubscription.id);
      if (error) throw error;
      toast({ title: 'Webhook Deleted' });
      setDeleteDialogOpen(false);
      setSelectedSubscription(null);
      fetchSubscriptions();
    } catch (error) {
      console.error('Error deleting webhook:', error);
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    try {
      // Set next_retry_at to now to make it eligible for immediate retry
      const { error } = await supabase
        .from('webhook_deliveries')
        .update({ next_retry_at: new Date().toISOString() })
        .eq('id', deliveryId);
      
      if (error) throw error;
      toast({ title: 'Retry Scheduled', description: 'The delivery will be retried shortly.' });
      
      if (selectedSubscription) {
        fetchDeliveries(selectedSubscription.id);
      }
    } catch (error) {
      console.error('Error scheduling retry:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Secret copied to clipboard' });
  };

  const resetForm = () => {
    setWebhookName('');
    setEndpointUrl('');
    setSelectedEvents(['order.created']);
  };

  const toggleEvent = (eventKey: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventKey)
        ? prev.filter(e => e !== eventKey)
        : [...prev, eventKey]
    );
  };

  const getStatusBadge = (sub: WebhookSubscription) => {
    if (!sub.is_active) return <Badge variant="secondary">Disabled</Badge>;
    if (sub.failure_count >= 5) return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="default">Active</Badge>;
  };

  const getDeliveryStatus = (delivery: WebhookDelivery) => {
    if (delivery.success) {
      return <Badge className="bg-green-500 text-white">Delivered</Badge>;
    }
    if (delivery.error_message?.startsWith('Dead letter')) {
      return <Badge variant="destructive">Dead Letter</Badge>;
    }
    if (delivery.next_retry_at) {
      return <Badge variant="secondary">Pending Retry</Badge>;
    }
    return <Badge variant="destructive">Failed</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" />Webhook Subscriptions</CardTitle>
            <CardDescription>Register endpoints to receive real-time event notifications</CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Webhook</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Webhook</DialogTitle><DialogDescription>Register an endpoint to receive events</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={webhookName} onChange={(e) => setWebhookName(e.target.value)} placeholder="My CRM Webhook" /></div>
                <div><Label>Endpoint URL</Label><Input value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://..." /></div>
                <div>
                  <Label className="mb-2 block">Events to Subscribe</Label>
                  <div className="grid gap-2 max-h-60 overflow-y-auto border rounded-md p-3">
                    {AVAILABLE_EVENTS.map((event) => (
                      <div key={event.key} className="flex items-start space-x-3">
                        <Checkbox 
                          id={event.key}
                          checked={selectedEvents.includes(event.key)}
                          onCheckedChange={() => toggleEvent(event.key)}
                        />
                        <div className="grid gap-0.5 leading-none">
                          <label htmlFor={event.key} className="text-sm font-medium cursor-pointer">
                            {event.label}
                          </label>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateSubscription} disabled={creating}>{creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create'}</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registered Webhooks</CardTitle>
              <CardDescription>{subscriptions.length} webhook{subscriptions.length !== 1 ? 's' : ''} configured</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSubscriptions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No webhooks registered</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell><code className="text-xs truncate max-w-xs block">{sub.endpoint_url}</code></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(sub.events || [sub.event_type]).slice(0, 2).map((event, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{event.split('.')[1]}</Badge>
                        ))}
                        {(sub.events || []).length > 2 && (
                          <Badge variant="secondary" className="text-xs">+{sub.events.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(sub)}</TableCell>
                    <TableCell><Switch checked={sub.is_active} onCheckedChange={() => handleToggleActive(sub)} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleTestWebhook(sub)}
                          disabled={testingWebhook === sub.id || !sub.is_active}
                          title="Test webhook"
                        >
                          {testingWebhook === sub.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(sub.secret)} title="Copy secret"><Copy className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedSubscription(sub); fetchDeliveries(sub.id); setDeliveriesDialogOpen(true); }} title="View deliveries"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedSubscription(sub); setDeleteDialogOpen(true); }} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={deliveriesDialogOpen} onOpenChange={setDeliveriesDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Delivery History - {selectedSubscription?.name}</DialogTitle>
            <DialogDescription>Recent webhook deliveries for this subscription</DialogDescription>
          </DialogHeader>
          {loadingDeliveries ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : deliveries.length === 0 ? <p className="text-center py-8 text-muted-foreground">No deliveries yet</p> : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{getDeliveryStatus(d)}</TableCell>
                      <TableCell><Badge variant="outline">{d.event || d.event_type}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={(d.status_code || d.response_status) && (d.status_code || d.response_status)! < 300 ? 'default' : 'destructive'}>
                          {d.status_code || d.response_status || 'Error'}
                        </Badge>
                        {d.error_message && (
                          <span className="text-xs text-muted-foreground ml-2 truncate max-w-[100px] block" title={d.error_message}>
                            {d.error_message.slice(0, 50)}...
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.retry_count || 0}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.duration_ms ? `${d.duration_ms}ms` : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.delivered_at ? formatDistanceToNow(new Date(d.delivered_at), { addSuffix: true }) : '-'}
                      </TableCell>
                      <TableCell>
                        {!d.success && !d.error_message?.startsWith('Dead letter') && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleRetryDelivery(d.id)}
                            title="Retry now"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>This will stop all event deliveries to this endpoint.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSubscription} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WebhookSubscriptionsTab;
