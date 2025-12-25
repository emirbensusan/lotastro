import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Key, Plus, RefreshCw, Trash2, Copy, Eye, EyeOff, Loader2, Shield, Clock, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  service: string;
  permissions: Record<string, boolean> | null;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  rate_limit_per_minute: number | null;
}

const AVAILABLE_PERMISSIONS = [
  { key: 'inventory.read', label: 'Read Inventory', description: 'Access inventory data' },
  { key: 'catalog.read', label: 'Read Catalog', description: 'Access catalog items' },
  { key: 'orders.read', label: 'Read Orders', description: 'View order data' },
  { key: 'orders.create', label: 'Create Orders', description: 'Create new orders' },
  { key: 'webhooks.manage', label: 'Manage Webhooks', description: 'Register webhook endpoints' },
];

const SERVICES = [
  { value: 'crm', label: 'CRM Integration' },
  { value: 'portal', label: 'Customer Portal' },
  { value: 'erp', label: 'ERP System' },
  { value: 'custom', label: 'Custom Integration' },
];

const ApiKeyManagementTab: React.FC = () => {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKeyVisible, setNewKeyVisible] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [keyName, setKeyName] = useState('');
  const [keyService, setKeyService] = useState('crm');
  const [keyPermissions, setKeyPermissions] = useState<Record<string, boolean>>({});
  const [keyExpiresIn, setKeyExpiresIn] = useState('never');
  const [keyRateLimit, setKeyRateLimit] = useState('60');

  useEffect(() => {
    fetchApiKeys();
  }, []);

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

  const generateApiKey = (service: string): string => {
    const prefix = `lot_${service}_`;
    const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `${prefix}${randomPart}`;
  };

  const hashApiKey = async (apiKey: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a name for the API key',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const newKey = generateApiKey(keyService);
      const keyHash = await hashApiKey(newKey);
      const keyPrefix = newKey.substring(0, 12);

      let expiresAt: string | null = null;
      if (keyExpiresIn !== 'never') {
        const days = parseInt(keyExpiresIn);
        const expireDate = new Date();
        expireDate.setDate(expireDate.getDate() + days);
        expiresAt = expireDate.toISOString();
      }

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('api_keys')
        .insert({
          name: keyName,
          service: keyService,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          permissions: keyPermissions,
          expires_at: expiresAt,
          rate_limit_per_minute: parseInt(keyRateLimit),
          created_by: userData?.user?.id,
        });

      if (error) throw error;

      setGeneratedKey(newKey);
      setNewKeyVisible(true);
      toast({
        title: 'API Key Created',
        description: 'Your new API key has been created. Copy it now - it won\'t be shown again!',
      });

      fetchApiKeys();
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRotateKey = async () => {
    if (!selectedKey) return;

    setCreating(true);
    try {
      const newKey = generateApiKey(selectedKey.service);
      const keyHash = await hashApiKey(newKey);
      const keyPrefix = newKey.substring(0, 12);

      const { error } = await supabase
        .from('api_keys')
        .update({
          key_hash: keyHash,
          key_prefix: keyPrefix,
        })
        .eq('id', selectedKey.id);

      if (error) throw error;

      setGeneratedKey(newKey);
      setNewKeyVisible(true);
      setRotateDialogOpen(false);
      toast({
        title: 'API Key Rotated',
        description: 'Your API key has been rotated. Copy the new key now!',
      });

      fetchApiKeys();
    } catch (error) {
      console.error('Error rotating API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to rotate API key',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!selectedKey) return;

    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', selectedKey.id);

      if (error) throw error;

      toast({
        title: 'API Key Revoked',
        description: 'The API key has been revoked and can no longer be used.',
      });

      setDeleteDialogOpen(false);
      setSelectedKey(null);
      fetchApiKeys();
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke API key',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteKey = async () => {
    if (!selectedKey) return;

    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', selectedKey.id);

      if (error) throw error;

      toast({
        title: 'API Key Deleted',
        description: 'The API key has been permanently deleted.',
      });

      setDeleteDialogOpen(false);
      setSelectedKey(null);
      fetchApiKeys();
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard',
    });
  };

  const resetForm = () => {
    setKeyName('');
    setKeyService('crm');
    setKeyPermissions({});
    setKeyExpiresIn('never');
    setKeyRateLimit('60');
    setGeneratedKey(null);
    setNewKeyVisible(false);
  };

  const getStatusBadge = (key: ApiKey) => {
    if (!key.is_active) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Key Management
            </CardTitle>
            <CardDescription>
              Create and manage API keys for external integrations
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  Create a new API key for external system integration
                </DialogDescription>
              </DialogHeader>

              {generatedKey ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg border-2 border-primary">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Your API Key</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewKeyVisible(!newKeyVisible)}
                      >
                        {newKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-background p-2 rounded break-all">
                        {newKeyVisible ? generatedKey : '••••••••••••••••••••••••••••••••'}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(generatedKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <p className="text-sm text-destructive">
                      Make sure to copy your API key now. You won't be able to see it again!
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => {
                      setCreateDialogOpen(false);
                      resetForm();
                    }}>
                      Done
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="e.g., Production CRM Key"
                    />
                  </div>

                  <div>
                    <Label htmlFor="key-service">Service Type</Label>
                    <Select value={keyService} onValueChange={setKeyService}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICES.map((service) => (
                          <SelectItem key={service.value} value={service.value}>
                            {service.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Permissions</Label>
                    <div className="mt-2 space-y-2">
                      {AVAILABLE_PERMISSIONS.map((perm) => (
                        <div key={perm.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={perm.key}
                            checked={keyPermissions[perm.key] || false}
                            onCheckedChange={(checked) =>
                              setKeyPermissions((prev) => ({
                                ...prev,
                                [perm.key]: checked === true,
                              }))
                            }
                          />
                          <Label htmlFor={perm.key} className="text-sm font-normal cursor-pointer">
                            {perm.label}
                            <span className="text-muted-foreground ml-1">- {perm.description}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="key-expires">Expires In</Label>
                      <Select value={keyExpiresIn} onValueChange={setKeyExpiresIn}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="rate-limit">Rate Limit (req/min)</Label>
                      <Input
                        id="rate-limit"
                        type="number"
                        value={keyRateLimit}
                        onChange={(e) => setKeyRateLimit(e.target.value)}
                        min="1"
                        max="1000"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateKey} disabled={creating}>
                      {creating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Key className="mr-2 h-4 w-4" />
                          Create Key
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Existing API Keys</CardTitle>
          <CardDescription>
            {apiKeys.length} API key{apiKeys.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys created yet</p>
              <p className="text-sm">Create your first API key to enable external integrations</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rate Limit</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {key.key_prefix}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SERVICES.find((s) => s.value === key.service)?.label || key.service}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(key)}</TableCell>
                    <TableCell>
                      {key.rate_limit_per_minute || 60}/min
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {key.last_used_at
                        ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(key.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedKey(key);
                            setRotateDialogOpen(true);
                          }}
                          disabled={!key.is_active}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedKey(key);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rotate Key Dialog */}
      <AlertDialog open={rotateDialogOpen} onOpenChange={setRotateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new secret for "{selectedKey?.name}". The old key will stop working immediately.
              Make sure to update your integration with the new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRotateKey} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rotating...
                </>
              ) : (
                'Rotate Key'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete/Revoke Key Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke "{selectedKey?.name}"? This will immediately prevent any integrations using this key from accessing the API.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={selectedKey?.is_active ? handleRevokeKey : handleDeleteKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {selectedKey?.is_active ? 'Revoke Key' : 'Delete Key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ApiKeyManagementTab;
