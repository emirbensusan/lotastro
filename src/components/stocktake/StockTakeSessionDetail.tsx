import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  X
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  admin_quality: string | null;
  admin_color: string | null;
  admin_lot_number: string | null;
  admin_meters: number | null;
  admin_notes: string | null;
  recount_reason: string | null;
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
  const [editingRoll, setEditingRoll] = useState<CountRoll | null>(null);
  const [editValues, setEditValues] = useState({
    quality: '',
    color: '',
    lotNumber: '',
    meters: '',
    notes: '',
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchRolls();
  }, [session.id]);

  const fetchRolls = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('count_rolls')
        .select('*')
        .eq('session_id', session.id)
        .order('capture_sequence', { ascending: true });

      if (error) throw error;
      setRolls(data as CountRoll[]);
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

  const loadPhotoUrl = async (roll: CountRoll) => {
    try {
      const { data } = await supabase.storage
        .from('stock-take-photos')
        .createSignedUrl(roll.photo_path, 3600);
      
      if (data?.signedUrl) {
        setPhotoUrl(data.signedUrl);
      }
    } catch (error) {
      console.error('[StockTakeSessionDetail] Photo load error:', error);
    }
  };

  const handleViewPhoto = (roll: CountRoll) => {
    setSelectedRoll(roll);
    setPhotoUrl(null);
    loadPhotoUrl(roll);
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

      toast({
        title: String(t('stocktake.review.rollApproved')),
      });
      
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Approve error:', error);
      toast({
        title: String(t('error')),
        variant: 'destructive',
      });
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

      toast({
        title: String(t('stocktake.review.rollRejected')),
      });
      
      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedRoll(null);
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Reject error:', error);
      toast({
        title: String(t('error')),
        variant: 'destructive',
      });
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

      toast({
        title: String(t('stocktake.review.recountRequested')),
      });
      
      setShowRecountDialog(false);
      setRecountReason('');
      setSelectedRoll(null);
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Recount error:', error);
      toast({
        title: String(t('error')),
        variant: 'destructive',
      });
    }
  };

  const handleStartEdit = (roll: CountRoll) => {
    setEditingRoll(roll);
    setEditValues({
      quality: roll.admin_quality || roll.counter_quality,
      color: roll.admin_color || roll.counter_color,
      lotNumber: roll.admin_lot_number || roll.counter_lot_number,
      meters: String(roll.admin_meters || roll.counter_meters),
      notes: roll.admin_notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRoll) return;

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
        .eq('id', editingRoll.id);

      if (error) throw error;

      toast({
        title: String(t('stocktake.review.rollUpdated')),
      });
      
      setEditingRoll(null);
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Save error:', error);
      toast({
        title: String(t('error')),
        variant: 'destructive',
      });
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
      toast({
        title: String(t('error')),
        variant: 'destructive',
      });
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

      toast({
        title: String(t('stocktake.review.sessionCompleted')),
      });
      
      onBack();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Complete error:', error);
      toast({
        title: String(t('error')),
        variant: 'destructive',
      });
    }
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
    if (!level) return null;
    const config: Record<string, string> = {
      high: 'bg-green-50 text-green-700 border-green-200',
      medium: 'bg-amber-50 text-amber-700 border-amber-200',
      low: 'bg-red-50 text-red-700 border-red-200',
    };
    return <Badge variant="outline" className={config[level]}>{level}</Badge>;
  };

  const pendingCount = rolls.filter(r => r.status === 'pending_review').length;
  const canComplete = pendingCount === 0 && rolls.length > 0;

  return (
    <div className="container mx-auto p-4 space-y-6">
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

      {/* Rolls List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {rolls.map((roll) => (
            <Card key={roll.id} className={roll.is_not_label_warning ? 'border-amber-300' : ''}>
              <CardContent className="p-4">
                {editingRoll?.id === roll.id ? (
                  // Edit Mode
                  <div className="grid grid-cols-6 gap-4 items-end">
                    <div>
                      <label className="text-xs text-muted-foreground">{String(t('stocktake.ocr.quality'))}</label>
                      <Input
                        value={editValues.quality}
                        onChange={(e) => setEditValues(prev => ({ ...prev, quality: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{String(t('stocktake.ocr.color'))}</label>
                      <Input
                        value={editValues.color}
                        onChange={(e) => setEditValues(prev => ({ ...prev, color: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{String(t('stocktake.ocr.lotNumber'))}</label>
                      <Input
                        value={editValues.lotNumber}
                        onChange={(e) => setEditValues(prev => ({ ...prev, lotNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{String(t('stocktake.ocr.meters'))}</label>
                      <Input
                        type="number"
                        value={editValues.meters}
                        onChange={(e) => setEditValues(prev => ({ ...prev, meters: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{String(t('notes'))}</label>
                      <Input
                        value={editValues.notes}
                        onChange={(e) => setEditValues(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingRoll(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm text-muted-foreground">#{roll.capture_sequence}</span>
                      {getStatusBadge(roll.status)}
                      {getConfidenceBadge(roll.ocr_confidence_level)}
                      {roll.is_manual_entry && <Badge variant="outline">{String(t('stocktake.ocr.manualEntry'))}</Badge>}
                      {roll.is_not_label_warning && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {String(t('stocktake.ocr.notLabelWarning'))}
                        </Badge>
                      )}
                    </div>

                    <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{String(t('stocktake.ocr.quality'))}:</span>{' '}
                        <span className="font-medium">{roll.admin_quality || roll.counter_quality}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{String(t('stocktake.ocr.color'))}:</span>{' '}
                        <span className="font-medium">{roll.admin_color || roll.counter_color}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{String(t('stocktake.ocr.lotNumber'))}:</span>{' '}
                        <span className="font-medium">{roll.admin_lot_number || roll.counter_lot_number}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{String(t('stocktake.ocr.meters'))}:</span>{' '}
                        <span className="font-medium">{roll.admin_meters || roll.counter_meters}m</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleViewPhoto(roll)}>
                        <Image className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleStartEdit(roll)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {roll.status === 'pending_review' && (
                        <>
                          <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleApprove(roll)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { setSelectedRoll(roll); setShowRejectDialog(true); }}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => { setSelectedRoll(roll); setShowRecountDialog(true); }}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
