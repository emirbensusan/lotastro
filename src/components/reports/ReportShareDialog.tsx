import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Share2, Link, Mail, Users, Copy, Check, Trash2, 
  Calendar, Eye, Play, Edit, Shield, Clock, Loader2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, addDays, addWeeks, addMonths } from 'date-fns';

interface ReportShare {
  id: string;
  share_token: string;
  share_type: string;
  shared_with: string | null;
  permissions: string;
  expires_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ReportShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportName: string;
}

const ReportShareDialog: React.FC<ReportShareDialogProps> = ({
  open,
  onOpenChange,
  reportId,
  reportName,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [shares, setShares] = useState<ReportShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New share form state
  const [shareType, setShareType] = useState<'link' | 'email' | 'role'>('link');
  const [shareWith, setShareWith] = useState('');
  const [permissions, setPermissions] = useState<'view' | 'execute' | 'edit'>('view');
  const [expiration, setExpiration] = useState<'never' | '1day' | '1week' | '1month'>('never');

  useEffect(() => {
    if (open && reportId) {
      fetchShares();
    }
  }, [open, reportId]);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('report_shares')
        .select('*')
        .eq('report_config_id', reportId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShares(data || []);
    } catch (error) {
      console.error('Error fetching shares:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateShareToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const getExpirationDate = () => {
    const now = new Date();
    switch (expiration) {
      case '1day': return addDays(now, 1).toISOString();
      case '1week': return addWeeks(now, 1).toISOString();
      case '1month': return addMonths(now, 1).toISOString();
      default: return null;
    }
  };

  const handleCreateShare = async () => {
    if (shareType !== 'link' && !shareWith) {
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Lütfen paylaşım hedefini belirtin' : 'Please specify share target',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const shareData = {
        report_config_id: reportId,
        shared_by: user.user?.id,
        share_token: generateShareToken(),
        share_type: shareType,
        shared_with: shareType === 'link' ? null : shareWith,
        permissions,
        expires_at: getExpirationDate(),
        is_active: true,
      };

      const { error } = await supabase
        .from('report_shares')
        .insert(shareData);

      if (error) throw error;

      toast({
        title: language === 'tr' ? 'Paylaşım Oluşturuldu' : 'Share Created',
        description: language === 'tr' ? 'Paylaşım linki oluşturuldu' : 'Share link created successfully',
      });

      setShareWith('');
      fetchShares();
    } catch (error) {
      console.error('Error creating share:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Paylaşım oluşturulamadı' : 'Failed to create share',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = (share: ReportShare) => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/reports/shared/${share.share_token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(share.id);
    setTimeout(() => setCopiedId(null), 2000);
    
    toast({
      title: language === 'tr' ? 'Kopyalandı' : 'Copied',
      description: language === 'tr' ? 'Link panoya kopyalandı' : 'Link copied to clipboard',
    });
  };

  const handleToggleActive = async (share: ReportShare) => {
    try {
      const { error } = await supabase
        .from('report_shares')
        .update({ is_active: !share.is_active })
        .eq('id', share.id);

      if (error) throw error;
      fetchShares();
    } catch (error) {
      console.error('Error toggling share:', error);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    if (!confirm(language === 'tr' ? 'Bu paylaşımı silmek istediğinizden emin misiniz?' : 'Are you sure you want to delete this share?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('report_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;
      
      toast({
        title: language === 'tr' ? 'Silindi' : 'Deleted',
        description: language === 'tr' ? 'Paylaşım silindi' : 'Share deleted',
      });
      fetchShares();
    } catch (error) {
      console.error('Error deleting share:', error);
    }
  };

  const getPermissionIcon = (perm: string) => {
    switch (perm) {
      case 'view': return <Eye className="h-3 w-3" />;
      case 'execute': return <Play className="h-3 w-3" />;
      case 'edit': return <Edit className="h-3 w-3" />;
      default: return <Shield className="h-3 w-3" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'link': return <Link className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'role': return <Users className="h-4 w-4" />;
      default: return <Share2 className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {language === 'tr' ? 'Raporu Paylaş' : 'Share Report'}
          </DialogTitle>
          <DialogDescription>
            {language === 'tr' 
              ? `"${reportName}" raporunu paylaşın` 
              : `Share "${reportName}" report`}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">
              {language === 'tr' ? 'Yeni Paylaşım' : 'New Share'}
            </TabsTrigger>
            <TabsTrigger value="existing">
              {language === 'tr' ? 'Mevcut Paylaşımlar' : 'Existing Shares'}
              {shares.length > 0 && (
                <Badge variant="secondary" className="ml-2">{shares.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>{language === 'tr' ? 'Paylaşım Türü' : 'Share Type'}</Label>
                <div className="flex gap-2">
                  <Button
                    variant={shareType === 'link' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShareType('link')}
                  >
                    <Link className="h-4 w-4 mr-2" />
                    {language === 'tr' ? 'Link' : 'Link'}
                  </Button>
                  <Button
                    variant={shareType === 'email' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShareType('email')}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {language === 'tr' ? 'E-posta' : 'Email'}
                  </Button>
                  <Button
                    variant={shareType === 'role' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShareType('role')}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {language === 'tr' ? 'Rol' : 'Role'}
                  </Button>
                </div>
              </div>

              {shareType !== 'link' && (
                <div className="space-y-2">
                  <Label>
                    {shareType === 'email' 
                      ? (language === 'tr' ? 'E-posta Adresi' : 'Email Address')
                      : (language === 'tr' ? 'Rol' : 'Role')}
                  </Label>
                  {shareType === 'email' ? (
                    <Input
                      type="email"
                      value={shareWith}
                      onChange={(e) => setShareWith(e.target.value)}
                      placeholder="user@example.com"
                    />
                  ) : (
                    <Select value={shareWith} onValueChange={setShareWith}>
                      <SelectTrigger>
                        <SelectValue placeholder={language === 'tr' ? 'Rol seçin' : 'Select role'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="senior_manager">Senior Manager</SelectItem>
                        <SelectItem value="accounting">Accounting</SelectItem>
                        <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'İzinler' : 'Permissions'}</Label>
                  <Select value={permissions} onValueChange={(v) => setPermissions(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          {language === 'tr' ? 'Görüntüleme' : 'View'}
                        </div>
                      </SelectItem>
                      <SelectItem value="execute">
                        <div className="flex items-center gap-2">
                          <Play className="h-4 w-4" />
                          {language === 'tr' ? 'Çalıştırma' : 'Execute'}
                        </div>
                      </SelectItem>
                      <SelectItem value="edit">
                        <div className="flex items-center gap-2">
                          <Edit className="h-4 w-4" />
                          {language === 'tr' ? 'Düzenleme' : 'Edit'}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Geçerlilik Süresi' : 'Expiration'}</Label>
                  <Select value={expiration} onValueChange={(v) => setExpiration(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">{language === 'tr' ? 'Süresiz' : 'Never'}</SelectItem>
                      <SelectItem value="1day">{language === 'tr' ? '1 Gün' : '1 Day'}</SelectItem>
                      <SelectItem value="1week">{language === 'tr' ? '1 Hafta' : '1 Week'}</SelectItem>
                      <SelectItem value="1month">{language === 'tr' ? '1 Ay' : '1 Month'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleCreateShare} disabled={creating} className="w-full">
                {creating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                {language === 'tr' ? 'Paylaşım Oluştur' : 'Create Share'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="existing" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : shares.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{language === 'tr' ? 'Henüz paylaşım yok' : 'No shares yet'}</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {shares.map((share) => (
                    <Card key={share.id} className={!share.is_active ? 'opacity-50' : ''}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-muted">
                              {getTypeIcon(share.share_type)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {share.share_type === 'link' 
                                    ? (language === 'tr' ? 'Paylaşım Linki' : 'Share Link')
                                    : share.shared_with}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {getPermissionIcon(share.permissions)}
                                  <span className="ml-1">{share.permissions}</span>
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {share.access_count} {language === 'tr' ? 'erişim' : 'accesses'}
                                </span>
                                {share.expires_at && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(share.expires_at), 'PP')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={share.is_active}
                              onCheckedChange={() => handleToggleActive(share)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyLink(share)}
                            >
                              {copiedId === share.id ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteShare(share.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === 'tr' ? 'Kapat' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportShareDialog;
