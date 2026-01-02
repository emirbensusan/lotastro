import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Plus, Trash2, Shield, Loader2, Globe, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';

interface IPWhitelistEntry {
  id: string;
  ip_address: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

interface BulkImportResult {
  success: number;
  failed: number;
  errors: string[];
}

const IPWhitelistTab: React.FC = () => {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState<IPWhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEntry, setNewEntry] = useState({ ip_address: '', description: '' });
  const [bulkIPs, setBulkIPs] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);
  const [currentIP, setCurrentIP] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
    fetchCurrentIP();
  }, []);

  const fetchCurrentIP = async () => {
    try {
      // Use a public IP detection service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setCurrentIP(data.ip);
    } catch (error) {
      console.error('Failed to fetch current IP:', error);
    }
  };

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_ip_whitelist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      toast.error(`Failed to load IP whitelist: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const validateIP = (ip: string): boolean => {
    // Support IPv4, IPv4 with CIDR, and basic IPv6
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('/')[0].split('.');
      return parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
    }
    
    return ipv6Regex.test(ip);
  };

  const handleAddEntry = async () => {
    if (!newEntry.ip_address.trim()) {
      toast.error(t('ipAddressRequired') || 'IP address is required');
      return;
    }

    if (!validateIP(newEntry.ip_address.trim())) {
      toast.error(t('invalidIPFormat') || 'Invalid IP address format');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('admin_ip_whitelist')
        .insert({
          ip_address: newEntry.ip_address.trim(),
          description: newEntry.description.trim() || null,
          created_by: profile?.user_id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error(t('ipAlreadyExists') || 'This IP address is already in the whitelist');
        } else {
          throw error;
        }
        return;
      }

      toast.success(t('ipAddedSuccessfully') || 'IP address added to whitelist');
      setNewEntry({ ip_address: '', description: '' });
      setDialogOpen(false);
      fetchEntries();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add IP address');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_ip_whitelist')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setEntries(entries.map(e => e.id === id ? { ...e, is_active: isActive } : e));
      toast.success(isActive 
        ? (t('ipEnabled') || 'IP address enabled')
        : (t('ipDisabled') || 'IP address disabled')
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to update IP status');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_ip_whitelist')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEntries(entries.filter(e => e.id !== id));
      toast.success(t('ipDeletedSuccessfully') || 'IP address removed from whitelist');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete IP address');
    }
  };

  const handleAddCurrentIP = () => {
    if (currentIP) {
      setNewEntry({ ip_address: currentIP, description: 'My current IP' });
      setDialogOpen(true);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkIPs.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      toast.error(language === 'tr' ? 'IP adresi giriniz' : 'Enter at least one IP address');
      return;
    }

    setBulkImporting(true);
    setBulkResult(null);
    
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const line of lines) {
      const parts = line.split(/[,\t]/).map(p => p.trim());
      const ip = parts[0];
      const desc = parts[1] || 'Bulk import';

      if (!validateIP(ip)) {
        failed++;
        errors.push(`${ip}: Invalid format`);
        continue;
      }

      const { error } = await supabase
        .from('admin_ip_whitelist')
        .insert({
          ip_address: ip,
          description: desc,
          created_by: profile?.user_id,
        });

      if (error) {
        failed++;
        errors.push(`${ip}: ${error.code === '23505' ? 'Already exists' : error.message}`);
      } else {
        success++;
      }
    }

    setBulkResult({ success, failed, errors });
    setBulkImporting(false);
    
    if (success > 0) {
      fetchEntries();
      toast.success(`${success} IP(s) imported successfully`);
    }
  };

  const activeCount = entries.filter(e => e.is_active).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('ipWhitelist') || 'IP Whitelist'}
            </CardTitle>
            <CardDescription>
              {t('ipWhitelistDescription') || 'Manage allowed IP addresses for admin functions. Supports IPv4, IPv6, and CIDR notation.'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {currentIP && (
              <Button variant="outline" onClick={handleAddCurrentIP} size="sm">
                <Globe className="h-4 w-4 mr-2" />
                {language === 'tr' ? 'IP\'mi Ekle' : 'Add My IP'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              {language === 'tr' ? 'Toplu İçe Aktar' : 'Bulk Import'}
            </Button>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('addIP') || 'Add IP'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeCount === 0 && entries.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-700 dark:text-amber-300">
            {t('noActiveIPsWarning') || 'Warning: All IPs are currently disabled. This means all IPs are allowed to access admin functions.'}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('noIPsConfigured') || 'No IP addresses configured. All IPs are currently allowed.'}</p>
            <p className="text-sm mt-1">{t('addIPToRestrict') || 'Add an IP address to restrict admin access.'}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ipAddress') || 'IP Address'}</TableHead>
                <TableHead>{t('description') || 'Description'}</TableHead>
                <TableHead>{t('status') || 'Status'}</TableHead>
                <TableHead>{t('addedOn') || 'Added On'}</TableHead>
                <TableHead>{t('actions') || 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono">{entry.ip_address}</TableCell>
                  <TableCell>{entry.description || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={entry.is_active}
                        onCheckedChange={(checked) => handleToggleActive(entry.id, checked)}
                      />
                      <Badge variant={entry.is_active ? 'default' : 'secondary'}>
                        {entry.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(entry.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('deleteIP') || 'Delete IP Address'}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('deleteIPConfirmation') || 'Are you sure you want to remove this IP address from the whitelist?'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t('delete') || 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Add IP Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addIPAddress') || 'Add IP Address'}</DialogTitle>
              <DialogDescription>
                {t('addIPDescription') || 'Add an IP address to the whitelist. Only whitelisted IPs can access admin functions.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ip_address">{t('ipAddress') || 'IP Address'}</Label>
                <Input
                  id="ip_address"
                  placeholder="192.168.1.1 or 10.0.0.0/24"
                  value={newEntry.ip_address}
                  onChange={(e) => setNewEntry({ ...newEntry, ip_address: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {t('ipFormatHint') || 'Supports IPv4, IPv4 with CIDR notation (e.g., 10.0.0.0/24), and IPv6'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('description') || 'Description'} ({t('optional') || 'optional'})</Label>
                <Input
                  id="description"
                  placeholder="e.g., Office network, VPN, etc."
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleAddEntry} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('addIP') || 'Add IP'}
              </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Import Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'tr' ? 'Toplu IP İçe Aktarma' : 'Bulk IP Import'}</DialogTitle>
              <DialogDescription>
                {language === 'tr' 
                  ? 'Her satıra bir IP adresi girin. İsteğe bağlı olarak virgülle ayrılmış açıklama ekleyebilirsiniz.'
                  : 'Enter one IP per line. Optionally add description after comma.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="192.168.1.1, Office network&#10;10.0.0.0/24, VPN range&#10;203.0.113.50"
                value={bulkIPs}
                onChange={(e) => setBulkIPs(e.target.value)}
                rows={8}
              />
              {bulkResult && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{bulkResult.success} imported</span>
                    {bulkResult.failed > 0 && (
                      <>
                        <AlertCircle className="h-4 w-4 text-destructive ml-2" />
                        <span>{bulkResult.failed} failed</span>
                      </>
                    )}
                  </div>
                  {bulkResult.errors.length > 0 && (
                    <div className="text-xs text-destructive max-h-20 overflow-y-auto">
                      {bulkResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setBulkDialogOpen(false); setBulkIPs(''); setBulkResult(null); }}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleBulkImport} disabled={bulkImporting}>
                {bulkImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {language === 'tr' ? 'İçe Aktar' : 'Import'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default IPWhitelistTab;
