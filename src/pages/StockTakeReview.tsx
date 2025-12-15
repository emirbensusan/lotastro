import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Search,
  Eye,
  RotateCcw,
  FileCheck,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { StockTakeSessionDetail } from '@/components/stocktake/StockTakeSessionDetail';

interface CountSession {
  id: string;
  session_number: string;
  status: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
  total_rolls_counted: number;
  rolls_approved: number;
  rolls_rejected: number;
  rolls_pending_review: number;
  rolls_recount_requested: number;
  ocr_high_confidence_count: number;
  ocr_medium_confidence_count: number;
  ocr_low_confidence_count: number;
  manual_entry_count: number;
  notes: string | null;
  starter_profile?: {
    full_name: string;
    email: string;
  };
}

const StockTakeReview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<CountSession | null>(null);

  const canReview = hasPermission('stocktake', 'reviewsessions');

  useEffect(() => {
    if (!permissionsLoading) {
      fetchSessions();
    }
  }, [permissionsLoading, statusFilter]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('count_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch starter profiles separately
      const sessionsWithProfiles = await Promise.all(
        (data || []).map(async (session) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', session.started_by)
            .single();
          
          return {
            ...session,
            starter_profile: profile || undefined,
          };
        })
      );
      
      setSessions(sessionsWithProfiles as CountSession[]);
    } catch (error) {
      console.error('[StockTakeReview] Fetch error:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.review.fetchError')),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      draft: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
      active: { variant: 'default', icon: <Clock className="h-3 w-3" /> },
      counting_complete: { variant: 'secondary', icon: <FileCheck className="h-3 w-3" /> },
      reviewing: { variant: 'secondary', icon: <Eye className="h-3 w-3" /> },
      reconciled: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
      closed: { variant: 'outline', icon: <CheckCircle className="h-3 w-3" /> },
      cancelled: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    };

    const config = statusConfig[status] || { variant: 'outline' as const, icon: null };
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {String(t(`stocktake.review.status.${status}`) || status)}
      </Badge>
    );
  };

  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.session_number.toLowerCase().includes(query) ||
      session.starter_profile?.full_name?.toLowerCase().includes(query) ||
      session.starter_profile?.email?.toLowerCase().includes(query)
    );
  });

  // Permission check
  if (!permissionsLoading && !canReview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">{String(t('accessDenied'))}</h2>
        <p className="text-muted-foreground text-center">{String(t('stocktake.review.noPermission'))}</p>
      </div>
    );
  }

  // Session detail view
  if (selectedSession) {
    return (
      <StockTakeSessionDetail
        session={selectedSession}
        onBack={() => {
          setSelectedSession(null);
          fetchSessions();
        }}
      />
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{String(t('stocktake.review.title'))}</h1>
          <p className="text-muted-foreground">{String(t('stocktake.review.description'))}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{String(t('stocktake.review.pendingReview'))}</p>
                <p className="text-2xl font-bold">
                  {sessions.filter(s => s.status === 'counting_complete').length}
                </p>
              </div>
              <FileCheck className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{String(t('stocktake.review.inProgress'))}</p>
                <p className="text-2xl font-bold">
                  {sessions.filter(s => s.status === 'active' || s.status === 'reviewing').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{String(t('stocktake.review.completed'))}</p>
                <p className="text-2xl font-bold">
                  {sessions.filter(s => s.status === 'reconciled' || s.status === 'closed').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{String(t('stocktake.review.totalRolls'))}</p>
                <p className="text-2xl font-bold">
                  {sessions.reduce((sum, s) => sum + s.total_rolls_counted, 0)}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={String(t('stocktake.review.searchPlaceholder'))}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
          <TabsList>
            <TabsTrigger value="all">{String(t('all'))}</TabsTrigger>
            <TabsTrigger value="counting_complete">{String(t('stocktake.review.status.counting_complete'))}</TabsTrigger>
            <TabsTrigger value="reviewing">{String(t('stocktake.review.status.reviewing'))}</TabsTrigger>
            <TabsTrigger value="reconciled">{String(t('stocktake.review.status.reconciled'))}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{String(t('stocktake.review.noSessions'))}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <Card key={session.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => setSelectedSession(session)}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Session Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{session.session_number}</span>
                      {getStatusBadge(session.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {String(t('stocktake.review.startedBy'))}: {session.starter_profile?.full_name || session.starter_profile?.email || '-'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(session.started_at), 'dd/MM/yyyy HH:mm')}
                      {session.completed_at && ` - ${format(new Date(session.completed_at), 'dd/MM/yyyy HH:mm')}`}
                    </p>
                  </div>

                  {/* Roll Stats */}
                  <div className="flex flex-wrap gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{session.total_rolls_counted}</p>
                      <p className="text-xs text-muted-foreground">{String(t('stocktake.review.totalCounted'))}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{session.rolls_approved}</p>
                      <p className="text-xs text-muted-foreground">{String(t('stocktake.review.approved'))}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-600">{session.rolls_pending_review}</p>
                      <p className="text-xs text-muted-foreground">{String(t('stocktake.review.pending'))}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{session.rolls_rejected}</p>
                      <p className="text-xs text-muted-foreground">{String(t('stocktake.review.rejected'))}</p>
                    </div>
                  </div>

                  {/* OCR Stats */}
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {session.ocr_high_confidence_count} {String(t('stocktake.review.high'))}
                    </Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {session.ocr_medium_confidence_count} {String(t('stocktake.review.medium'))}
                    </Badge>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {session.ocr_low_confidence_count} {String(t('stocktake.review.low'))}
                    </Badge>
                  </div>

                  {/* Action */}
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    {String(t('stocktake.review.viewDetails'))}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StockTakeReview;
