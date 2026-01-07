import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useClientOCR } from '@/hooks/useClientOCR';
import { preprocessForOCR } from '@/utils/ocrPreprocessing';
import { useStockTakeSettings } from '@/hooks/useStockTakeSettings';
import { useInventoryTransaction } from '@/hooks/useInventoryTransaction';
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
  Download,
  Filter,
  CheckSquare,
  Square,
  RefreshCw,
  Loader2
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Progress } from '@/components/ui/progress';

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

type FilterMode = 'all' | 'pending' | 'high_confidence' | 'ready_for_approval';

export const StockTakeSessionDetail = ({ session, onBack }: Props) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { runOCR, isProcessing: isOCRProcessing, progress: ocrProgress, terminateWorker } = useClientOCR();
  const { settings: stockTakeSettings } = useStockTakeSettings();
  const { logSessionReconciliation, logBatchTransactions } = useInventoryTransaction();
  
  const [rolls, setRolls] = useState<CountRoll[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoll, setSelectedRoll] = useState<CountRoll | null>(null);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRecountDialog, setShowRecountDialog] = useState(false);
  const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
  const [showBulkRerunOCRDialog, setShowBulkRerunOCRDialog] = useState(false);
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
  
  // Bulk selection
  const [selectedRollIds, setSelectedRollIds] = useState<Set<string>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  
  // Smart filtering
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  
  // Pagination - server-side
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Sorting
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>({
    key: 'capture_sequence',
    direction: 'asc'
  });

  // Stats tracking
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    highConfidence: 0,
    readyForApproval: 0
  });

  // Re-run OCR state
  const [rerunningOCRRollId, setRerunningOCRRollId] = useState<string | null>(null);
  const [isBulkRerunningOCR, setIsBulkRerunningOCR] = useState(false);
  const [bulkRerunProgress, setBulkRerunProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  // Fetch rolls with server-side pagination
  const fetchRolls = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build query with filters
      let query = supabase
        .from('count_rolls')
        .select('*', { count: 'exact' })
        .eq('session_id', session.id);

      // Apply filter mode
      if (filterMode === 'pending') {
        query = query.eq('status', 'pending_review');
      } else if (filterMode === 'high_confidence') {
        query = query.eq('ocr_confidence_level', 'high');
      } else if (filterMode === 'ready_for_approval') {
        query = query
          .eq('status', 'pending_review')
          .eq('ocr_confidence_level', 'high')
          .eq('is_manual_entry', false)
          .eq('is_possible_duplicate', false);
      }

      // Apply sorting
      if (currentSort?.direction) {
        const ascending = currentSort.direction === 'asc';
        switch (currentSort.key) {
          case 'capture_sequence':
            query = query.order('capture_sequence', { ascending });
            break;
          case 'captured_at':
            query = query.order('captured_at', { ascending });
            break;
          case 'quality':
            query = query.order('counter_quality', { ascending });
            break;
          case 'color':
            query = query.order('counter_color', { ascending });
            break;
          case 'lot_number':
            query = query.order('counter_lot_number', { ascending });
            break;
          case 'meters':
            query = query.order('counter_meters', { ascending });
            break;
          case 'status':
            query = query.order('status', { ascending });
            break;
          default:
            query = query.order('capture_sequence', { ascending: true });
        }
      } else {
        query = query.order('capture_sequence', { ascending: true });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: rollsData, error, count } = await query;

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
      setTotalCount(count || 0);

      // Fetch stats separately (unfiltered counts)
      const { data: statsData } = await supabase
        .from('count_rolls')
        .select('status, ocr_confidence_level, is_manual_entry, is_possible_duplicate')
        .eq('session_id', session.id);

      if (statsData) {
        const total = statsData.length;
        const approved = statsData.filter(r => r.status === 'approved').length;
        const pending = statsData.filter(r => r.status === 'pending_review').length;
        const rejected = statsData.filter(r => r.status === 'rejected').length;
        const highConfidence = statsData.filter(r => r.ocr_confidence_level === 'high').length;
        const readyForApproval = statsData.filter(r => 
          r.status === 'pending_review' && 
          r.ocr_confidence_level === 'high' && 
          !r.is_manual_entry && 
          !r.is_possible_duplicate
        ).length;
        
        setStats({ total, approved, pending, rejected, highConfidence, readyForApproval });
      }
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
  }, [session.id, filterMode, currentSort, page, pageSize, t, toast]);

  useEffect(() => {
    fetchRolls();
  }, [fetchRolls]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
    setSelectedRollIds(new Set());
  }, [filterMode]);

  const handleSort = (key: string, direction: SortDirection) => {
    if (direction === null) {
      setCurrentSort(null);
    } else {
      setCurrentSort({ key, direction });
    }
    setPage(1);
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedRollIds.size === rolls.length) {
      setSelectedRollIds(new Set());
    } else {
      setSelectedRollIds(new Set(rolls.map(r => r.id)));
    }
  };

  const handleSelectRoll = (rollId: string) => {
    const newSelected = new Set(selectedRollIds);
    if (newSelected.has(rollId)) {
      newSelected.delete(rollId);
    } else {
      newSelected.add(rollId);
    }
    setSelectedRollIds(newSelected);
  };

  const handleSelectReadyForApproval = () => {
    const readyRolls = rolls.filter(r => 
      r.status === 'pending_review' && 
      r.ocr_confidence_level === 'high' && 
      !r.is_manual_entry && 
      !r.is_possible_duplicate
    );
    setSelectedRollIds(new Set(readyRolls.map(r => r.id)));
  };

  // Bulk approval
  const handleBulkApprove = async () => {
    if (selectedRollIds.size === 0) return;
    
    setIsBulkApproving(true);
    try {
      const { error } = await supabase
        .from('count_rolls')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', Array.from(selectedRollIds));

      if (error) throw error;

      toast({
        title: String(t('stocktake.review.bulkApproveSuccess')),
        description: `${selectedRollIds.size} ${String(t('stocktake.review.rollsApproved'))}`,
      });
      
      setSelectedRollIds(new Set());
      setShowBulkApproveDialog(false);
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Bulk approve error:', error);
      toast({ title: String(t('error')), variant: 'destructive' });
    } finally {
      setIsBulkApproving(false);
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

  // Re-run OCR for individual roll
  const handleRerunOCR = async (roll: CountRoll) => {
    setRerunningOCRRollId(roll.id);
    try {
      console.log('[StockTakeSessionDetail] Re-running OCR for roll:', roll.id);
      
      // Get the original photo path
      let photoPath = roll.photo_path;
      if (photoPath.includes('_medium.jpg')) {
        photoPath = photoPath.replace('_medium.jpg', '_original.jpg');
      } else if (photoPath.includes('_thumb.jpg')) {
        photoPath = photoPath.replace('_thumb.jpg', '_original.jpg');
      }
      
      // Get signed URL for the photo
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('stock-take-photos')
        .createSignedUrl(photoPath, 60);
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Failed to get photo URL');
      }
      
      // Load image as data URL
      const response = await fetch(signedUrlData.signedUrl);
      const blob = await response.blob();
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      console.log('[StockTakeSessionDetail] Image loaded, length:', imageDataUrl.length);
      
      // Apply preprocessing if enabled
      let processedImage = imageDataUrl;
      if (stockTakeSettings.preprocessing_enabled) {
        console.log('[StockTakeSessionDetail] Applying preprocessing...');
        processedImage = await preprocessForOCR(imageDataUrl, {
          enabled: stockTakeSettings.preprocessing_enabled,
          grayscale: stockTakeSettings.preprocessing_grayscale,
          contrast: stockTakeSettings.preprocessing_contrast,
          contrastLevel: stockTakeSettings.preprocessing_contrast_level,
          sharpen: stockTakeSettings.preprocessing_sharpen,
          sharpenLevel: stockTakeSettings.preprocessing_sharpen_level,
        });
        console.log('[StockTakeSessionDetail] Preprocessing complete, length:', processedImage.length);
      }
      
      // Run OCR
      const ocrResult = await runOCR(processedImage);
      console.log('[StockTakeSessionDetail] OCR result:', ocrResult);
      
      if (!ocrResult.success) {
        throw new Error(ocrResult.error || 'OCR failed');
      }
      
      // Calculate confidence level
      const overallScore = ocrResult.confidence?.overallScore || 0;
      let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
      if (overallScore >= 85) {
        confidenceLevel = 'high';
      } else if (overallScore >= 60) {
        confidenceLevel = 'medium';
      }
      
      // Update the roll with new OCR values
      const { error: updateError } = await supabase
        .from('count_rolls')
        .update({
          ocr_quality: ocrResult.extracted?.quality || null,
          ocr_color: ocrResult.extracted?.color || null,
          ocr_lot_number: ocrResult.extracted?.lotNumber || null,
          ocr_meters: ocrResult.extracted?.meters ? parseFloat(String(ocrResult.extracted.meters)) : null,
          ocr_confidence_score: overallScore || null,
          ocr_confidence_level: confidenceLevel,
          ocr_raw_text: ocrResult.ocr?.rawText || null,
          ocr_processed_at: new Date().toISOString(),
        })
        .eq('id', roll.id);
      
      if (updateError) throw updateError;
      
      toast({
        title: String(t('stocktake.review.rerunOCRSuccess')),
        description: `${String(t('stocktake.review.ocrConfidence'))}: ${confidenceLevel}`,
      });
      
      fetchRolls();
    } catch (error) {
      console.error('[StockTakeSessionDetail] Re-run OCR error:', error);
      toast({
        title: String(t('stocktake.review.rerunOCRFailed')),
        variant: 'destructive',
      });
    } finally {
      setRerunningOCRRollId(null);
    }
  };

  // Bulk re-run OCR for all pending/failed rolls
  const handleBulkRerunOCR = async () => {
    setIsBulkRerunningOCR(true);
    
    // Get all rolls that could benefit from re-running OCR
    const { data: rollsToProcess } = await supabase
      .from('count_rolls')
      .select('*')
      .eq('session_id', session.id)
      .or('ocr_confidence_level.eq.low,ocr_confidence_level.eq.medium,ocr_confidence_level.is.null')
      .order('capture_sequence', { ascending: true });
    
    if (!rollsToProcess || rollsToProcess.length === 0) {
      toast({ title: String(t('stocktake.review.noRollsToRerun')) });
      setIsBulkRerunningOCR(false);
      setShowBulkRerunOCRDialog(false);
      return;
    }
    
    setBulkRerunProgress({ current: 0, total: rollsToProcess.length, success: 0, failed: 0 });
    
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < rollsToProcess.length; i++) {
      const roll = rollsToProcess[i];
      setBulkRerunProgress(prev => ({ ...prev, current: i + 1 }));
      
      try {
        // Get the original photo path
        let photoPath = roll.photo_path;
        if (photoPath.includes('_medium.jpg')) {
          photoPath = photoPath.replace('_medium.jpg', '_original.jpg');
        } else if (photoPath.includes('_thumb.jpg')) {
          photoPath = photoPath.replace('_thumb.jpg', '_original.jpg');
        }
        
        // Get signed URL for the photo
        const { data: signedUrlData } = await supabase.storage
          .from('stock-take-photos')
          .createSignedUrl(photoPath, 60);
        
        if (!signedUrlData?.signedUrl) {
          failedCount++;
          continue;
        }
        
        // Load image as data URL
        const response = await fetch(signedUrlData.signedUrl);
        const blob = await response.blob();
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        // Apply preprocessing if enabled
        let processedImage = imageDataUrl;
        if (stockTakeSettings.preprocessing_enabled) {
          processedImage = await preprocessForOCR(imageDataUrl, {
            enabled: stockTakeSettings.preprocessing_enabled,
            grayscale: stockTakeSettings.preprocessing_grayscale,
            contrast: stockTakeSettings.preprocessing_contrast,
            contrastLevel: stockTakeSettings.preprocessing_contrast_level,
            sharpen: stockTakeSettings.preprocessing_sharpen,
            sharpenLevel: stockTakeSettings.preprocessing_sharpen_level,
          });
        }
        
        // Run OCR
        const ocrResult = await runOCR(processedImage);
        
        if (!ocrResult.success) {
          failedCount++;
          continue;
        }
        
        // Calculate confidence level
        const overallScore = ocrResult.confidence?.overallScore || 0;
        let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
        if (overallScore >= 85) {
          confidenceLevel = 'high';
        } else if (overallScore >= 60) {
          confidenceLevel = 'medium';
        }
        
        // Update the roll with new OCR values
        await supabase
          .from('count_rolls')
          .update({
            ocr_quality: ocrResult.extracted?.quality || null,
            ocr_color: ocrResult.extracted?.color || null,
            ocr_lot_number: ocrResult.extracted?.lotNumber || null,
            ocr_meters: ocrResult.extracted?.meters ? parseFloat(String(ocrResult.extracted.meters)) : null,
            ocr_confidence_score: overallScore || null,
            ocr_confidence_level: confidenceLevel,
            ocr_raw_text: ocrResult.ocr?.rawText || null,
            ocr_processed_at: new Date().toISOString(),
          })
          .eq('id', roll.id);
        
        successCount++;
        setBulkRerunProgress(prev => ({ ...prev, success: successCount }));
      } catch (error) {
        console.error('[StockTakeSessionDetail] Bulk re-run OCR error for roll:', roll.id, error);
        failedCount++;
        setBulkRerunProgress(prev => ({ ...prev, failed: failedCount }));
      }
    }
    
    toast({
      title: String(t('stocktake.review.bulkRerunOCRComplete')),
      description: `${successCount} ${String(t('success'))}, ${failedCount} ${String(t('stocktake.review.failed'))}`,
    });
    
    setIsBulkRerunningOCR(false);
    setShowBulkRerunOCRDialog(false);
    terminateWorker();
    fetchRolls();
  };

  // Count of rolls that could benefit from re-running OCR
  const rollsNeedingOCR = useMemo(() => {
    return rolls.filter(r => 
      r.ocr_confidence_level === 'low' || 
      r.ocr_confidence_level === 'medium' || 
      !r.ocr_confidence_level
    ).length;
  }, [rolls]);

  const handleCompleteReview = async () => {
    try {
      // Fetch all approved rolls to log their adjustments
      const { data: approvedRolls, error: fetchError } = await supabase
        .from('count_rolls')
        .select('id, counter_quality, counter_color, counter_lot_number, counter_meters, admin_quality, admin_color, admin_lot_number, admin_meters')
        .eq('session_id', session.id)
        .eq('status', 'approved');

      if (fetchError) throw fetchError;

      // Log individual adjustments for each approved roll
      if (approvedRolls && approvedRolls.length > 0) {
        const transactions = approvedRolls.map(roll => ({
          transactionType: 'STOCK_ADJUSTMENT' as const,
          quantityChange: roll.admin_meters ?? roll.counter_meters,
          unit: 'meters',
          sourceType: 'count_session',
          sourceId: session.id,
          sourceIdentifier: session.session_number,
          notes: `Stock count: ${roll.admin_quality || roll.counter_quality} / ${roll.admin_color || roll.counter_color} / Lot ${roll.admin_lot_number || roll.counter_lot_number}`,
          metadata: {
            quality: roll.admin_quality || roll.counter_quality,
            color: roll.admin_color || roll.counter_color,
            lot_number: roll.admin_lot_number || roll.counter_lot_number,
            counted_meters: roll.counter_meters,
            admin_meters: roll.admin_meters,
            final_meters: roll.admin_meters ?? roll.counter_meters,
          },
        }));

        await logBatchTransactions({ transactions });
      }

      // Log session reconciliation summary
      const totalMeters = (approvedRolls || []).reduce((sum, roll) => 
        sum + (roll.admin_meters ?? roll.counter_meters), 0
      );
      
      await logSessionReconciliation({
        sessionId: session.id,
        sessionNumber: session.session_number,
        rollsApproved: approvedRolls?.length || 0,
        totalMetersAdjusted: totalMeters,
      });

      // Update session status
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

  const handleExport = async () => {
    // Fetch all rolls for export (not just current page)
    const { data: allRolls } = await supabase
      .from('count_rolls')
      .select('*')
      .eq('session_id', session.id)
      .order('capture_sequence', { ascending: true });

    if (!allRolls) return;

    const csvData = allRolls.map(roll => ({
      [String(t('stocktake.review.captureSequence'))]: roll.capture_sequence,
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

  const canComplete = stats.pending === 0 && stats.total > 0;
  const selectedPendingCount = Array.from(selectedRollIds).filter(id => {
    const roll = rolls.find(r => r.id === id);
    return roll?.status === 'pending_review';
  }).length;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'A') {
        e.preventDefault();
        handleSelectAll();
      }
      if (e.ctrlKey && e.key === 'Enter' && selectedPendingCount > 0) {
        e.preventDefault();
        setShowBulkApproveDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rolls, selectedRollIds, selectedPendingCount]);

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
          <Button 
            variant="outline" 
            onClick={() => setShowBulkRerunOCRDialog(true)}
            disabled={rollsNeedingOCR === 0 || isBulkRerunningOCR}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {String(t('stocktake.review.rerunOCR'))} ({rollsNeedingOCR})
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {String(t('stocktake.review.exportData'))}
          </Button>
          <Button onClick={handleCompleteReview} disabled={!canComplete}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {String(t('stocktake.review.completeReview'))}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">{String(t('stocktake.review.totalCounted'))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            <p className="text-sm text-muted-foreground">{String(t('stocktake.review.approved'))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">{String(t('stocktake.review.pending'))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-sm text-muted-foreground">{String(t('stocktake.review.rejected'))}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-700">{stats.highConfidence}</p>
            <p className="text-sm text-green-600">{String(t('stocktake.review.highConfidence'))}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.readyForApproval}</p>
            <p className="text-sm text-primary/80">{String(t('stocktake.review.readyForApproval'))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions Bar */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/50 rounded-lg">
        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{String(t('stocktake.review.filterAll'))}</SelectItem>
              <SelectItem value="pending">{String(t('stocktake.review.filterPending'))}</SelectItem>
              <SelectItem value="high_confidence">{String(t('stocktake.review.filterHighConfidence'))}</SelectItem>
              <SelectItem value="ready_for_approval">{String(t('stocktake.review.filterReadyForApproval'))}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Selection controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            {selectedRollIds.size === rolls.length ? (
              <><Square className="h-4 w-4 mr-2" />{String(t('stocktake.review.deselectAll'))}</>
            ) : (
              <><CheckSquare className="h-4 w-4 mr-2" />{String(t('stocktake.review.selectAll'))}</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSelectReadyForApproval}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {String(t('stocktake.review.selectReady'))}
          </Button>
        </div>

        {/* Selected count and bulk action */}
        {selectedRollIds.size > 0 && (
          <>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedRollIds.size} {String(t('stocktake.review.selected'))}</Badge>
              {selectedPendingCount > 0 && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => setShowBulkApproveDialog(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {String(t('stocktake.review.approveSelected'))} ({selectedPendingCount})
                </Button>
              )}
            </div>
          </>
        )}

        <div className="flex-1" />

        {/* Keyboard hints */}
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Shift+A</kbd>
          <span>{String(t('stocktake.review.selectAllShortcut'))}</span>
          <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Ctrl+Enter</kbd>
          <span>{String(t('stocktake.review.approveShortcut'))}</span>
        </div>
      </div>

      {/* Top Pagination */}
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
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
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={rolls.length > 0 && selectedRollIds.size === rolls.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
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
              {rolls.map((roll) => (
                <TableRow 
                  key={roll.id} 
                  className={`${roll.is_not_label_warning ? 'bg-amber-50' : ''} ${selectedRollIds.has(roll.id) ? 'bg-primary/5' : ''}`}
                >
                  {editingRollId === roll.id ? (
                    // Edit mode - inline editing
                    <>
                      <TableCell>
                        <Checkbox
                          checked={selectedRollIds.has(roll.id)}
                          onCheckedChange={() => handleSelectRoll(roll.id)}
                        />
                      </TableCell>
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
                      <TableCell>
                        <Checkbox
                          checked={selectedRollIds.has(roll.id)}
                          onCheckedChange={() => handleSelectRoll(roll.id)}
                        />
                      </TableCell>
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
                          {/* Re-run OCR button for low/medium confidence */}
                          {(roll.ocr_confidence_level === 'low' || roll.ocr_confidence_level === 'medium' || !roll.ocr_confidence_level) && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-amber-600"
                              onClick={() => handleRerunOCR(roll)} 
                              disabled={rerunningOCRRollId === roll.id}
                              title={String(t('stocktake.review.rerunOCR'))}
                            >
                              {rerunningOCRRollId === roll.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          )}
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
              {rolls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
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
        totalCount={totalCount}
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

      {/* Bulk Approve Dialog */}
      <AlertDialog open={showBulkApproveDialog} onOpenChange={setShowBulkApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t('stocktake.review.bulkApproveTitle'))}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t('stocktake.review.bulkApproveDesc')).replace('{count}', String(selectedPendingCount))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkApproving}>{String(t('cancel'))}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkApprove} 
              disabled={isBulkApproving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isBulkApproving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {String(t('stocktake.review.approveSelected'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Bulk Re-run OCR Dialog */}
      <AlertDialog open={showBulkRerunOCRDialog} onOpenChange={setShowBulkRerunOCRDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t('stocktake.review.rerunOCRAll'))}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t('stocktake.review.rerunOCRAllDesc')).replace('{count}', String(rollsNeedingOCR))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {isBulkRerunningOCR && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{String(t('stocktake.review.rerunOCRProgress')).replace('{current}', String(bulkRerunProgress.current)).replace('{total}', String(bulkRerunProgress.total))}</span>
                <span className="text-green-600">{bulkRerunProgress.success} ✓</span>
              </div>
              <Progress value={(bulkRerunProgress.current / Math.max(bulkRerunProgress.total, 1)) * 100} />
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkRerunningOCR}>{String(t('cancel'))}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkRerunOCR} 
              disabled={isBulkRerunningOCR}
            >
              {isBulkRerunningOCR ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {String(t('stocktake.review.rerunOCR'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
