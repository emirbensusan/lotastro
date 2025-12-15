import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RotateCcw,
  Image,
  Edit2,
  Save,
  X,
  Copy,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';

interface CountSession {
  id: string;
  session_number: string;
  status: string;
  total_rolls_counted: number;
  rolls_approved: number;
  rolls_rejected: number;
  rolls_pending_review: number;
}

interface CountRoll {
  id: string;
  capture_sequence: number;
  photo_path: string;
  captured_at: string;
  captured_by: string;
  counter_quality: string;
  counter_color: string;
  counter_lot_number: string;
  counter_meters: number;
  ocr_quality: string | null;
  ocr_color: string | null;
  ocr_lot_number: string | null;
  ocr_meters: number | null;
  ocr_confidence_level: 'high' | 'medium' | 'low' | null;
  ocr_confidence_score: number | null;
  status: string;
  is_manual_entry: boolean;
  is_not_label_warning: boolean;
  is_possible_duplicate: boolean;
  duplicate_of_roll_id: string | null;
  admin_quality: string | null;
  admin_color: string | null;
  admin_lot_number: string | null;
  admin_meters: number | null;
  admin_notes: string | null;
  recount_reason: string | null;
  counter_profile?: { full_name: string | null; email: string } | null;
}

interface Props {
  session: CountSession;
  onBack: () => void;
}

export const StockTakeSessionDetail = ({ session, onBack }: Props) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const [rolls, setRolls] = useState<CountRoll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoll, setSelectedRoll] = useState<CountRoll | null>(null);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRecountDialog, setShowRecountDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [recountReason, setRecountReason] = useState('');
  const [editingRollId, setEditingRollId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    quality: '',
    color: '',
    lotNumber: '',
    meters: '',
    notes: '',
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Sorting
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>({
    key: 'capture_sequence',
    direction: 'asc'
  });

  useEffect(() => {
    fetchRolls();
  }, [session.id]);

  const fetchRolls = async () => {
    setIsLoading(true);
    try {
      // Fetch rolls
      const { data: rollsData, error } = await supabase
        .from('count_rolls')
        .select('*')
        .eq('session_id', session.id)
        .order('capture_sequence', { ascending: true });

      if (error) throw error;

      // Fetch profiles for counters
      const userIds = [...new Set((rollsData || []).map(r => r.captured_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      const rollsWithProfiles = (rollsData || []).map(roll => ({
        ...roll,
        counter_profile: profileMap.get(roll.captured_by) || null
      }));

      setRolls(rollsWithProfiles as CountRoll[]);
    } catch (error) {
      console.error('[StockTakeSessionDetail] Fetch error:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.review.fetchRollsError')),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sorted and paginated data
  const sortedRolls = useMemo(() => {
    if (!currentSort || !currentSort.direction) return rolls;
    
    return [...rolls].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (currentSort.key) {
        case 'capture_sequence':
          aVal = a.capture_sequence;
          bVal = b.capture_sequence;
          break;
        case 'captured_at':
          aVal = new Date(a.captured_at).getTime();
          bVal = new Date(b.captured_at).getTime();
          break;
        case 'quality':
          aVal = (a.admin_quality || a.counter_quality || '').toLowerCase();
          bVal = (b.admin_quality || b.counter_quality || '').toLowerCase();
          break;
        case 'color':
          aVal = (a.admin_color || a.counter_color || '').toLowerCase();
          bVal = (b.admin_color || b.counter_color || '').toLowerCase();
          break;
        case 'lot_number':
          aVal = (a.admin_lot_number || a.counter_lot_number || '').toLowerCase();
          bVal = (b.admin_lot_number || b.counter_lot_number || '').toLowerCase();
          break;
        case 'meters':
          aVal = a.admin_meters ?? a.counter_meters ?? 0;
          bVal = b.admin_meters ?? b.counter_meters ?? 0;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rolls, currentSort]);

  const paginatedRolls = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRolls.slice(start, start + pageSize);
  }, [sortedRolls, page, pageSize]);

  const handleSort = (key: string, direction: SortDirection) => {
    if (direction === null) {
      setCurrentSort(null);
    } else {
      setCurrentSort({ key, direction });
    }
  };

  const loadPhotoUrl = async (roll: CountRoll, size: 'thumb' | 'medium' | 'original' = 'medium') => {
    try {
      let path = roll.photo_path;
      
      if (size === 'medium' && roll.photo_path.includes('_original.jpg')) {
        path = roll.photo_path.replace('_original.jpg', '_medium.jpg');
      }
      
      const { data } = await supabase.storage
        .from('stock-take-photos')
        .createSignedUrl(path, 3600);
      
      if (data?.signedUrl) {
        setPhotoUrl(data.signedUrl);
      } else {
        const { data: fallbackData } = await supabase.storage
          .from('stock-take-photos')
          .createSignedUrl(roll.photo_path, 3600);
        if (fallbackData?.signedUrl) {
          setPhotoUrl(fallbackData.signedUrl);
        }
      }
    } catch (error) {
      console.error('[StockTakeSessionDetail] Photo load error:', error);
    }
  };

  const handleViewPhoto = (roll: CountRoll) => {
    setSelectedRoll(roll);
    setPhotoUrl(null);
    loadPhotoUrl(roll, 'medium');
    setShowPhotoDialog(true);
  };

  const handleApprove = async (roll: CountRoll) => {
    try {
      const { error } = await supabase
        .from('count_rolls')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', roll.id);

      if (error) throw error;

      toast({ title: String(t('stocktake.review.rollApproved')) });
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Approve error:', error);
      toast({ title: String(t('error')), variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!selectedRoll) return;

    try {
      const { error } = await supabase
        .from('count_rolls')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: rejectReason,
        })
        .eq('id', selectedRoll.id);

      if (error) throw error;

      toast({ title: String(t('stocktake.review.rollRejected')) });
      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedRoll(null);
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Reject error:', error);
      toast({ title: String(t('error')), variant: 'destructive' });
    }
  };

  const handleRequestRecount = async () => {
    if (!selectedRoll) return;

    try {
      const { error } = await supabase
        .from('count_rolls')
        .update({
          status: 'recount_requested',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          recount_reason: recountReason,
        })
        .eq('id', selectedRoll.id);

      if (error) throw error;

      toast({ title: String(t('stocktake.review.recountRequested')) });
      setShowRecountDialog(false);
      setRecountReason('');
      setSelectedRoll(null);
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Recount error:', error);
      toast({ title: String(t('error')), variant: 'destructive' });
    }
  };

  const handleStartEdit = (roll: CountRoll) => {
    setEditingRollId(roll.id);
    setEditValues({
      quality: roll.admin_quality || roll.counter_quality,
      color: roll.admin_color || roll.counter_color,
      lotNumber: roll.admin_lot_number || roll.counter_lot_number,
      meters: String(roll.admin_meters ?? roll.counter_meters),
      notes: roll.admin_notes || '',
    });
  };

  const handleSaveEdit = async (rollId: string) => {
    try {
      const { error } = await supabase
        .from('count_rolls')
        .update({
          admin_quality: editValues.quality.toUpperCase(),
          admin_color: editValues.color.toUpperCase(),
          admin_lot_number: editValues.lotNumber.toUpperCase(),
          admin_meters: parseFloat(editValues.meters),
          admin_notes: editValues.notes,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', rollId);

      if (error) throw error;

      toast({ title: String(t('stocktake.review.rollUpdated')) });
      setEditingRollId(null);
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Save error:', error);
      toast({ title: String(t('error')), variant: 'destructive' });
    }
  };

  const handleApproveAll = async () => {
    const pendingRolls = rolls.filter(r => r.status === 'pending_review');
    
    try {
      const { error } = await supabase
        .from('count_rolls')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', pendingRolls.map(r => r.id));

      if (error) throw error;

      toast({
        title: String(t('stocktake.review.allApproved')),
        description: `${pendingRolls.length} ${String(t('stocktake.review.rollsApproved'))}`,
      });
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Approve all error:', error);
      toast({ title: String(t('error')), variant: 'destructive' });
    }
  };

  const handleCompleteReview = async () => {
    try {
      const { error } = await supabase
        .from('count_sessions')
        .update({
          status: 'reconciled',
          reconciled_at: new Date().toISOString(),
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (error) throw error;

      toast({ title: String(t('stocktake.review.sessionCompleted')) });
      onBack();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Complete error:', error);
      toast({ title: String(t('error')), variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const csvData = rolls.map(roll => ({
      [String(t('stocktake.review.captureSequence'))]: roll.capture_sequence,
      [String(t('stocktake.review.capturedBy'))]: roll.counter_profile?.full_name || roll.counter_profile?.email || '-',
      [String(t('stocktake.review.capturedAt'))]: format(new Date(roll.captured_at), 'dd/MM/yyyy HH:mm'),
      [String(t('quality'))]: roll.admin_quality || roll.counter_quality,
      [String(t('color'))]: roll.admin_color || roll.counter_color,
      [String(t('stocktake.review.lotNumber'))]: roll.admin_lot_number || roll.counter_lot_number,
      [String(t('meters'))]: roll.admin_meters ?? roll.counter_meters,
      [String(t('status'))]: roll.status,
      [String(t('stocktake.review.ocrConfidence'))]: roll.ocr_confidence_level || '-',
      [String(t('stocktake.ocr.manualEntry'))]: roll.is_manual_entry ? String(t('yes')) : String(t('no')),
    }));

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row] ?? ''}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${session.session_number}-rolls-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: String(t('stocktake.review.exportComplete')) });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      pending_review: { variant: 'secondary', className: 'bg-amber-100 text-amber-800' },
      approved: { variant: 'default', className: 'bg-green-100 text-green-800' },
      rejected: { variant: 'destructive', className: '' },
      recount_requested: { variant: 'outline', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    };
    const c = config[status] || { variant: 'outline' as const, className: '' };
    return <Badge variant={c.variant} className={c.className}>{String(t(`stocktake.review.rollStatus.${status}`))}</Badge>;
  };

  const getConfidenceBadge = (level: string | null) => {
    if (!level) return <span className="text-muted-foreground">-</span>;
    const config: Record<string, string> = {
      high: 'bg-green-50 text-green-700 border-green-200',
      medium: 'bg-amber-50 text-amber-700 border-amber-200',
      low: 'bg-red-50 text-red-700 border-red-200',
    };
    return <Badge variant="outline" className={config[level]}>{level}</Badge>;
  };

  const getCounterName = (roll: CountRoll) => {
    return roll.counter_profile?.full_name || roll.counter_profile?.email || '-';
  };

  const pendingCount = rolls.filter(r => r.status === 'pending_review').length;
  const canComplete = pendingCount === 0 && rolls.length > 0;

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{session.session_number}</h1>
          <p className="text-muted-foreground">{String(t('stocktake.review.sessionReview'))}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {String(t('stocktake.review.exportData'))}
          </Button>
          {pendingCount > 0 && (
            <Button variant="outline" onClick={handleApproveAll}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {String(t('stocktake.review.approveAll'))} ({pendingCount})
            </Button>
          )}
          <Button onClick={handleCompleteReview} disabled={!canComplete}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {String(t('stocktake.review.completeReview'))}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{rolls.length}</p>
            <p className="text-sm text-muted-foreground">{String(t('stocktake.review.totalCounted'))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{rolls.filter(r => r.status === 'approved').length}</p>
            <p className="text-sm text-muted-foreground">{String(t('stocktake.review.approved'))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">{String(t('stocktake.review.pending'))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-600">{rolls.filter(r => r.status === 'rejected').length}</p>
            <p className="text-sm text-muted-foreground">{String(t('stocktake.review.rejected'))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Pagination */}
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        totalCount={rolls.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        pageSizeOptions={[10, 20, 50, 100]}
      />

      {/* Rolls Grid Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label="#"
                  sortKey="capture_sequence"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <TableHead>{String(t('stocktake.review.capturedBy'))}</TableHead>
                <SortableTableHead
                  label={String(t('stocktake.review.capturedAt'))}
                  sortKey="captured_at"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('quality'))}
                  sortKey="quality"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('color'))}
                  sortKey="color"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('stocktake.review.lotNumber'))}
                  sortKey="lot_number"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('meters'))}
                  sortKey="meters"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('status'))}
                  sortKey="status"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <TableHead>{String(t('stocktake.review.ocrConfidence'))}</TableHead>
                <TableHead className="text-right">{String(t('actions'))}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRolls.map((roll) => (
                <TableRow key={roll.id} className={roll.is_not_label_warning ? 'bg-amber-50' : ''}>
                  {editingRollId === roll.id ? (
                    // Edit mode - inline editing
                    <>
                      <TableCell className="font-mono text-sm">#{roll.capture_sequence}</TableCell>
                      <TableCell>{getCounterName(roll)}</TableCell>
                      <TableCell>{format(new Date(roll.captured_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <Input
                          value={editValues.quality}
                          onChange={(e) => setEditValues(prev => ({ ...prev, quality: e.target.value }))}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editValues.color}
                          onChange={(e) => setEditValues(prev => ({ ...prev, color: e.target.value }))}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editValues.lotNumber}
                          onChange={(e) => setEditValues(prev => ({ ...prev, lotNumber: e.target.value }))}
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editValues.meters}
                          onChange={(e) => setEditValues(prev => ({ ...prev, meters: e.target.value }))}
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>{getStatusBadge(roll.status)}</TableCell>
                      <TableCell>{getConfidenceBadge(roll.ocr_confidence_level)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(roll.id)}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingRollId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    // View mode
                    <>
                      <TableCell className="font-mono text-sm">
                        #{roll.capture_sequence}
                        {roll.is_manual_entry && (
                          <Badge variant="outline" className="ml-2 text-xs">{String(t('stocktake.ocr.manualEntry'))}</Badge>
                        )}
                        {roll.is_possible_duplicate && (
                          <Badge variant="outline" className="ml-1 bg-red-50 text-red-700 border-red-200 text-xs">
                            <Copy className="h-3 w-3 mr-1" />
                            {String(t('stocktake.duplicate.duplicateRoll'))}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getCounterName(roll)}</TableCell>
                      <TableCell>{format(new Date(roll.captured_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell className="font-medium">{roll.admin_quality || roll.counter_quality}</TableCell>
                      <TableCell className="font-medium">{roll.admin_color || roll.counter_color}</TableCell>
                      <TableCell className="font-medium">{roll.admin_lot_number || roll.counter_lot_number}</TableCell>
                      <TableCell className="font-medium">{(roll.admin_meters ?? roll.counter_meters).toLocaleString()}m</TableCell>
                      <TableCell>{getStatusBadge(roll.status)}</TableCell>
                      <TableCell>{getConfidenceBadge(roll.ocr_confidence_level)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => handleViewPhoto(roll)} title={String(t('stocktake.review.viewPhoto'))}>
                            <Image className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleStartEdit(roll)} title={String(t('edit'))}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {roll.status === 'pending_review' && (
                            <>
                              <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleApprove(roll)} title={String(t('approve'))}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { setSelectedRoll(roll); setShowRejectDialog(true); }} title={String(t('reject'))}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => { setSelectedRoll(roll); setShowRecountDialog(true); }} title={String(t('stocktake.review.requestRecount'))}>
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {paginatedRolls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {String(t('stocktake.review.noRolls'))}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bottom Pagination */}
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        totalCount={rolls.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        pageSizeOptions={[10, 20, 50, 100]}
      />

      {/* Photo Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{String(t('stocktake.review.rollPhoto'))} #{selectedRoll?.capture_sequence}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {photoUrl ? (
              <img src={photoUrl} alt="Roll label" className="max-h-[60vh] object-contain rounded-lg" />
            ) : (
              <div className="h-64 w-full flex items-center justify-center bg-muted rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t('stocktake.review.rejectRoll'))}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t('stocktake.review.rejectRollDesc'))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={String(t('stocktake.review.rejectReason'))}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{String(t('cancel'))}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground">
              {String(t('stocktake.review.reject'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recount Dialog */}
      <AlertDialog open={showRecountDialog} onOpenChange={setShowRecountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t('stocktake.review.requestRecount'))}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t('stocktake.review.recountDesc'))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={String(t('stocktake.review.recountReason'))}
            value={recountReason}
            onChange={(e) => setRecountReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{String(t('cancel'))}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRequestRecount}>
              {String(t('stocktake.review.requestRecount'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
