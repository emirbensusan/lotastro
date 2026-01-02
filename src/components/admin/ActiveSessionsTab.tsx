import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Monitor, Smartphone, Tablet, Globe, LogOut, RefreshCw, Shield, Clock, MapPin } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface UserSession {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  last_sign_in_at: string | null;
  created_at: string;
  is_current: boolean;
}

const ActiveSessionsTab: React.FC = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Get all active profiles (users who have logged in)
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, role, created_at')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map to session format
      const sessionsData: UserSession[] = (profiles || []).map(profile => ({
        user_id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        last_sign_in_at: null, // We can't get this without admin API access
        created_at: profile.created_at,
        is_current: profile.user_id === user?.id
      }));

      setSessions(sessionsData);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Oturumlar yüklenemedi' : 'Failed to load sessions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleForceLogout = async (userId: string, email: string) => {
    setRevoking(userId);
    try {
      // Call edge function to invalidate user's sessions
      const { error } = await supabase.functions.invoke('admin-deactivate-user', {
        body: { userId, action: 'force_logout' }
      });

      if (error) throw error;

      toast({
        title: language === 'tr' ? 'Başarılı' : 'Success',
        description: language === 'tr' 
          ? `${email} oturumu sonlandırıldı` 
          : `Session terminated for ${email}`
      });

      fetchSessions();
    } catch (error: any) {
      console.error('Error forcing logout:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: error.message || (language === 'tr' ? 'Oturum sonlandırılamadı' : 'Failed to terminate session'),
        variant: 'destructive'
      });
    } finally {
      setRevoking(null);
    }
  };

  const getDeviceIcon = (userAgent?: string) => {
    // In a real implementation, we'd parse user agent
    // For now, show a generic monitor icon
    return <Monitor className="h-4 w-4" />;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'senior_manager': return 'default';
      case 'accounting': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, { en: string; tr: string }> = {
      admin: { en: 'Admin', tr: 'Yönetici' },
      senior_manager: { en: 'Senior Manager', tr: 'Üst Düzey Yönetici' },
      accounting: { en: 'Accounting', tr: 'Muhasebe' },
      warehouse_staff: { en: 'Warehouse Staff', tr: 'Depo Personeli' }
    };
    return labels[role]?.[language as 'en' | 'tr'] || role;
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {language === 'tr' ? 'Aktif Kullanıcılar' : 'Active Users'}
              </CardTitle>
              <CardDescription>
                {language === 'tr' 
                  ? 'Sistemdeki aktif kullanıcıları görüntüleyin ve yönetin' 
                  : 'View and manage active users in the system'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSessions(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {language === 'tr' ? 'Yenile' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Toplam Kullanıcı' : 'Total Users'}
              </div>
              <div className="text-2xl font-bold">{sessions.length}</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Yöneticiler' : 'Admins'}
              </div>
              <div className="text-2xl font-bold">
                {sessions.filter(s => s.role === 'admin').length}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Yöneticiler' : 'Managers'}
              </div>
              <div className="text-2xl font-bold">
                {sessions.filter(s => s.role === 'senior_manager').length}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Personel' : 'Staff'}
              </div>
              <div className="text-2xl font-bold">
                {sessions.filter(s => s.role === 'warehouse_staff' || s.role === 'accounting').length}
              </div>
            </div>
          </div>

          {/* Sessions Table */}
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{language === 'tr' ? 'Aktif kullanıcı bulunamadı' : 'No active users found'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'tr' ? 'Kullanıcı' : 'User'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Rol' : 'Role'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Kayıt Tarihi' : 'Joined'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Durum' : 'Status'}</TableHead>
                  <TableHead>{language === 'tr' ? 'İşlemler' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getDeviceIcon()}
                        <div>
                          <p className="font-medium">{session.full_name || session.email}</p>
                          <p className="text-xs text-muted-foreground">{session.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(session.role) as any}>
                        {getRoleLabel(session.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(session.created_at), 'PP')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {session.is_current ? (
                        <Badge variant="default" className="bg-green-500">
                          {language === 'tr' ? 'Mevcut Oturum' : 'Current Session'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {language === 'tr' ? 'Aktif' : 'Active'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!session.is_current && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={revoking === session.user_id}
                            >
                              {revoking === session.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <LogOut className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {language === 'tr' ? 'Oturumu Sonlandır' : 'Terminate Session'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {language === 'tr'
                                  ? `${session.email} kullanıcısının tüm oturumları sonlandırılacak. Devam etmek istiyor musunuz?`
                                  : `All sessions for ${session.email} will be terminated. Do you want to continue?`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {language === 'tr' ? 'İptal' : 'Cancel'}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleForceLogout(session.user_id, session.email)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {language === 'tr' ? 'Sonlandır' : 'Terminate'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActiveSessionsTab;
