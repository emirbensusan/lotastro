import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { ViewDetailsButton } from '@/components/ui/view-details-button';
import { TableExportButton, exportToCSV } from '@/components/ui/table-export-button';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Search,
  FileCheck,
  Users,
  StopCircle,
  Trash2
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
  const [selectedSession, setSelectedSession] = useState<CountSession | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Sorting state
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>({
    key: 'started_at',
    direction: 'desc'
  });
  
  // Dialog state
  const [endSessionDialog, setEndSessionDialog] = useState<CountSession | null>(null);
  const [deleteSessionDialog, setDeleteSessionDialog] = useState<CountSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const canReview = hasPermission('stocktake', 'reviewsessions');
  const canDelete = hasPermission('stocktake', 'deletesessions');

  useEffect(() => {
    if (!permissionsLoading) {
      fetchSessions();
    }
  }, [permissionsLoading]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('count_sessions')
        .select('*')
        .order('created_at', { ascending: false });

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

  const handleEndSession = async () => {
    if (!endSessionDialog) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('count_sessions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Ended by admin',
        })
        .eq('id', endSessionDialog.id);

      if (error) throw error;

      toast({
        title: String(t('success')),
        description: String(t('stocktake.review.sessionEnded')),
      });

      fetchSessions();
    } catch (error) {
      console.error('[StockTakeReview] End session error:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.review.endSessionError')),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setEndSessionDialog(null);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionDialog) return;
    
    setIsProcessing(true);
    try {
      // First delete related count_rolls
      const { error: rollsError } = await supabase
        .from('count_rolls')
        .delete()
        .eq('session_id', deleteSessionDialog.id);

      if (rollsError) throw rollsError;

      // Then delete the session
      const { error: sessionError } = await supabase
        .from('count_sessions')
        .delete()
        .eq('id', deleteSessionDialog.id);

      if (sessionError) throw sessionError;

      toast({
        title: String(t('success')),
        description: String(t('stocktake.review.sessionDeleted')),
      });

      fetchSessions();
    } catch (error) {
      console.error('[StockTakeReview] Delete session error:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.review.deleteSessionError')),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setDeleteSessionDialog(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      draft: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
      active: { variant: 'default', icon: <Clock className="h-3 w-3" /> },
      counting_complete: { variant: 'secondary', icon: <FileCheck className="h-3 w-3" /> },
      reviewing: { variant: 'secondary', icon: <FileCheck className="h-3 w-3" /> },
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

  // Filtering
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        session.session_number.toLowerCase().includes(query) ||
        session.starter_profile?.full_name?.toLowerCase().includes(query) ||
        session.starter_profile?.email?.toLowerCase().includes(query)
      );
    });
  }, [sessions, searchQuery]);

  // Sorting
  const sortedSessions = useMemo(() => {
    if (!currentSort || !currentSort.direction) return filteredSessions;

    return [...filteredSessions].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (currentSort.key) {
        case 'session_number':
          aVal = a.session_number;
          bVal = b.session_number;
          break;
        case 'counter':
          aVal = a.starter_profile?.full_name || a.starter_profile?.email || '';
          bVal = b.starter_profile?.full_name || b.starter_profile?.email || '';
          break;
        case 'started_at':
          aVal = new Date(a.started_at).getTime();
          bVal = new Date(b.started_at).getTime();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'total_rolls_counted':
          aVal = a.total_rolls_counted;
          bVal = b.total_rolls_counted;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSessions, currentSort]);

  // Pagination
  const paginatedSessions = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedSessions.slice(startIndex, startIndex + pageSize);
  }, [sortedSessions, page, pageSize]);

  const handleSort = useCallback((key: string, direction: SortDirection) => {
    if (direction === null) {
      setCurrentSort(null);
    } else {
      setCurrentSort({ key, direction });
    }
  }, []);

  // Export handler
  const handleExport = useCallback(() => {
    const exportData = sortedSessions.map(session => ({
      session_number: session.session_number,
      counter: session.starter_profile?.full_name || session.starter_profile?.email || '-',
      started_at: format(new Date(session.started_at), 'dd/MM/yyyy HH:mm'),
      completed_at: session.completed_at ? format(new Date(session.completed_at), 'dd/MM/yyyy HH:mm') : '-',
      status: session.status,
      total_rolls: session.total_rolls_counted,
      approved: session.rolls_approved,
      pending: session.rolls_pending_review,
      rejected: session.rolls_rejected,
      high_ocr: session.ocr_high_confidence_count,
      medium_ocr: session.ocr_medium_confidence_count,
      low_ocr: session.ocr_low_confidence_count,
      manual: session.manual_entry_count,
    }));

    const columns = [
      { key: 'session_number' as const, label: String(t('stocktake.review.sessionNumber')) },
      { key: 'counter' as const, label: String(t('stocktake.review.counter')) },
      { key: 'started_at' as const, label: String(t('stocktake.review.startedAt')) },
      { key: 'completed_at' as const, label: String(t('stocktake.review.completedAt')) },
      { key: 'status' as const, label: String(t('status')) },
      { key: 'total_rolls' as const, label: String(t('stocktake.review.totalCounted')) },
      { key: 'approved' as const, label: String(t('stocktake.review.approved')) },
      { key: 'pending' as const, label: String(t('stocktake.review.pending')) },
      { key: 'rejected' as const, label: String(t('stocktake.review.rejected')) },
      { key: 'high_ocr' as const, label: String(t('stocktake.review.highOCR')) },
      { key: 'medium_ocr' as const, label: String(t('stocktake.review.mediumOCR')) },
      { key: 'low_ocr' as const, label: String(t('stocktake.review.lowOCR')) },
      { key: 'manual' as const, label: String(t('stocktake.review.manualEntry')) },
    ];

    exportToCSV(exportData, columns, `stock-take-sessions-${format(new Date(), 'yyyy-MM-dd')}`);
  }, [sortedSessions, t]);

  const canEndSession = (status: string) => {
    return ['draft', 'active', 'counting_complete', 'reviewing'].includes(status);
  };

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
        <div className="flex items-center gap-2">
          <TableExportButton onExport={handleExport} />
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

      {/* Search */}
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
      </div>

      {/* Top Pagination */}
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        totalCount={sortedSessions.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeOptions={[5, 10, 20, 50]}
      />

      {/* Sessions Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : paginatedSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{String(t('stocktake.review.noSessions'))}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label={String(t('stocktake.review.sessionNumber'))}
                  sortKey="session_number"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('stocktake.review.counter'))}
                  sortKey="counter"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('stocktake.review.startedAt'))}
                  sortKey="started_at"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('status'))}
                  sortKey="status"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('stocktake.review.totalCounted'))}
                  sortKey="total_rolls_counted"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <TableHead className="h-8 px-2 text-left align-middle font-medium text-muted-foreground">
                  {String(t('stocktake.review.rollStats'))}
                </TableHead>
                <TableHead className="h-8 px-2 text-left align-middle font-medium text-muted-foreground">
                  {String(t('stocktake.review.ocrStats'))}
                </TableHead>
                <TableHead className="h-8 px-2 text-right align-middle font-medium text-muted-foreground">
                  {String(t('actions'))}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="px-2 py-1 font-mono font-medium">
                    {session.session_number}
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    {session.starter_profile?.full_name || session.starter_profile?.email || '-'}
                  </TableCell>
                  <TableCell className="px-2 py-1 text-sm">
                    {format(new Date(session.started_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    {getStatusBadge(session.status)}
                  </TableCell>
                  <TableCell className="px-2 py-1 text-center font-semibold">
                    {session.total_rolls_counted}
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    <div className="flex gap-2 text-xs">
                      <span className="text-green-600" title={String(t('stocktake.review.approved'))}>
                        ✓ {session.rolls_approved}
                      </span>
                      <span className="text-amber-600" title={String(t('stocktake.review.pending'))}>
                        ⏳ {session.rolls_pending_review}
                      </span>
                      <span className="text-red-600" title={String(t('stocktake.review.rejected'))}>
                        ✗ {session.rolls_rejected}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    <div className="flex gap-1">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-1">
                        {session.ocr_high_confidence_count}
                      </Badge>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs px-1">
                        {session.ocr_medium_confidence_count}
                      </Badge>
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs px-1">
                        {session.ocr_low_confidence_count}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-1 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ViewDetailsButton
                        onClick={() => setSelectedSession(session)}
                        showLabel={false}
                      />
                      {canEndSession(session.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEndSessionDialog(session)}
                          className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          title={String(t('stocktake.review.endSession'))}
                        >
                          <StopCircle className="h-3 w-3" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteSessionDialog(session)}
                          className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title={String(t('stocktake.review.deleteSession'))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bottom Pagination */}
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        totalCount={sortedSessions.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeOptions={[5, 10, 20, 50]}
      />

      {/* End Session Dialog */}
      <AlertDialog open={!!endSessionDialog} onOpenChange={() => setEndSessionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t('stocktake.review.endSessionTitle'))}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t('stocktake.review.confirmEndSession'))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{String(t('cancel'))}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleEndSession} 
              disabled={isProcessing}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isProcessing ? String(t('loading')) : String(t('stocktake.review.endSession'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Session Dialog */}
      <AlertDialog open={!!deleteSessionDialog} onOpenChange={() => setDeleteSessionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t('stocktake.review.deleteSessionTitle'))}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t('stocktake.review.confirmDeleteSession'))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{String(t('cancel'))}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSession} 
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? String(t('loading')) : String(t('delete'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockTakeReview;
