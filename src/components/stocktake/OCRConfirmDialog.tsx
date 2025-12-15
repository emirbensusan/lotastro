import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CheckCircle, Edit, RotateCcw, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OCRData {
  quality: string;
  color: string;
  lotNumber: string;
  meters: number | null;
  confidence: {
    overallScore: number;
    level: 'high' | 'medium' | 'low';
  };
  isLikelyLabel: boolean;
  rawText: string;
}

interface DuplicateWarning {
  isDuplicate: boolean;
  duplicateType: 'exact' | 'perceptual' | 'data_match' | null;
  matchedRoll: {
    id: string;
    capture_sequence: number;
    counter_quality: string;
    counter_color: string;
    counter_lot_number: string;
    counter_meters: number;
  } | null;
  confidence: number;
}

interface OCRConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  ocrData: OCRData | null;
  duplicateWarning?: DuplicateWarning | null;
  onConfirm: (data: {
    quality: string;
    color: string;
    lotNumber: string;
    meters: number;
    isManualEntry: boolean;
    editReason?: string;
    editReasonOther?: string;
    fieldsEdited?: string[];
    acknowledgedDuplicate?: boolean;
  }) => void;
  onRetake: () => void;
}

// Edit reasons in Turkish
const EDIT_REASONS = [
  { value: 'ocr_unreadable', label: 'OCR okunamadı' },
  { value: 'handwritten_label', label: 'El yazısı etiket' },
  { value: 'label_damaged', label: 'Etiket hasarlı' },
  { value: 'wrong_extraction', label: 'Yanlış çıkarım' },
  { value: 'other', label: 'Diğer' },
];

export const OCRConfirmDialog = ({
  open,
  onOpenChange,
  imageUrl,
  ocrData,
  duplicateWarning,
  onConfirm,
  onRetake,
}: OCRConfirmDialogProps) => {
  const { t } = useLanguage();
  const [acknowledgedDuplicate, setAcknowledgedDuplicate] = useState(false);
  
  // Form state
  const [quality, setQuality] = useState('');
  const [color, setColor] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [meters, setMeters] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editReasonOther, setEditReasonOther] = useState('');
  
  // Track which fields were manually edited
  const [fieldsEdited, setFieldsEdited] = useState<Set<string>>(new Set());
  const [showEditMode, setShowEditMode] = useState(false);

  // Initialize form with OCR data
  useEffect(() => {
    if (ocrData) {
      setQuality(ocrData.quality || '');
      setColor(ocrData.color || '');
      setLotNumber(ocrData.lotNumber || '');
      setMeters(ocrData.meters?.toString() || '');
      setFieldsEdited(new Set());
      setShowEditMode(!ocrData.isLikelyLabel || ocrData.confidence.level === 'low');
      setAcknowledgedDuplicate(false);
    }
  }, [ocrData]);

  // Track field changes
  const handleFieldChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value.toUpperCase());
    setFieldsEdited(prev => new Set(prev).add(field));
  };

  // Validate form
  const isValid = quality.trim() && color.trim() && lotNumber.trim() && 
    meters.trim() && parseFloat(meters) > 0 && parseFloat(meters) <= 300;

  // Check if any field was edited
  const isManualEntry = fieldsEdited.size > 0 || !ocrData?.isLikelyLabel;

  // Handle confirm
  const handleConfirm = () => {
    if (!isValid) return;

    // Require edit reason if manual entry
    if (isManualEntry && !editReason) {
      setShowEditMode(true);
      return;
    }

    // Require acknowledgment if duplicate detected
    if (duplicateWarning?.isDuplicate && !acknowledgedDuplicate) {
      return;
    }

    onConfirm({
      quality: quality.trim().toUpperCase(),
      color: color.trim().toUpperCase(),
      lotNumber: lotNumber.trim().toUpperCase(),
      meters: parseFloat(meters),
      isManualEntry,
      editReason: isManualEntry ? editReason : undefined,
      editReasonOther: editReason === 'other' ? editReasonOther : undefined,
      fieldsEdited: Array.from(fieldsEdited),
      acknowledgedDuplicate: duplicateWarning?.isDuplicate ? acknowledgedDuplicate : undefined,
    });
  };

  const getDuplicateTypeLabel = (type: string | null) => {
    switch (type) {
      case 'exact': return String(t('stocktake.duplicate.exactMatch'));
      case 'perceptual': return String(t('stocktake.duplicate.similarImage'));
      case 'data_match': return String(t('stocktake.duplicate.sameData'));
      default: return String(t('stocktake.duplicate.possibleDuplicate'));
    }
  };

  const getConfidenceBadge = () => {
    if (!ocrData) return null;
    
    const { level, overallScore } = ocrData.confidence;
    const config = {
      high: { color: 'bg-green-500', label: 'Yüksek Güven' },
      medium: { color: 'bg-amber-500', label: 'Orta Güven' },
      low: { color: 'bg-red-500', label: 'Düşük Güven' },
    };
    
    const { color: bgColor, label } = config[level];
    
    return (
      <Badge className={cn(bgColor, 'text-white')}>
        {label} ({overallScore}%)
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ocrData?.isLikelyLabel ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            {String(t('stocktake.confirmData'))}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Captured image preview */}
          {imageUrl && (
            <div className="relative">
              <img
                src={imageUrl}
                alt="Captured"
                className="w-full h-40 object-contain rounded-lg bg-muted"
              />
              {getConfidenceBadge() && (
                <div className="absolute top-2 right-2">
                  {getConfidenceBadge()}
                </div>
              )}
            </div>
          )}

          {/* Not a label warning */}
          {ocrData && !ocrData.isLikelyLabel && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {String(t('stocktake.notLabelWarning'))}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {String(t('stocktake.notLabelHint'))}
                </p>
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateWarning?.isDuplicate && (
            <div className="flex flex-col gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <Copy className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    {getDuplicateTypeLabel(duplicateWarning.duplicateType)}
                  </p>
                  {duplicateWarning.matchedRoll && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {String(t('stocktake.duplicate.matchedWith'))} #{duplicateWarning.matchedRoll.capture_sequence}: {duplicateWarning.matchedRoll.counter_quality} {duplicateWarning.matchedRoll.counter_color} - {duplicateWarning.matchedRoll.counter_meters}m
                    </p>
                  )}
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {String(t('stocktake.duplicate.confidence'))}: {duplicateWarning.confidence}%
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgedDuplicate}
                  onChange={(e) => setAcknowledgedDuplicate(e.target.checked)}
                  className="rounded border-red-300"
                />
                <span className="text-xs text-red-700 dark:text-red-300">
                  {String(t('stocktake.duplicate.acknowledgeAndContinue'))}
                </span>
              </label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quality" className="text-xs">
                {String(t('stocktake.quality'))} *
              </Label>
              <Input
                id="quality"
                value={quality}
                onChange={(e) => handleFieldChange('quality', e.target.value, setQuality)}
                placeholder="P200"
                className={cn(
                  fieldsEdited.has('quality') && 'border-amber-500'
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="color" className="text-xs">
                {String(t('stocktake.color'))} *
              </Label>
              <Input
                id="color"
                value={color}
                onChange={(e) => handleFieldChange('color', e.target.value, setColor)}
                placeholder="BLACK"
                className={cn(
                  fieldsEdited.has('color') && 'border-amber-500'
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lotNumber" className="text-xs">
                {String(t('stocktake.lotNumber'))} *
              </Label>
              <Input
                id="lotNumber"
                value={lotNumber}
                onChange={(e) => handleFieldChange('lotNumber', e.target.value, setLotNumber)}
                placeholder="LOT-2024-001"
                className={cn(
                  fieldsEdited.has('lotNumber') && 'border-amber-500'
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meters" className="text-xs">
                {String(t('stocktake.meters'))} * (max 300)
              </Label>
              <Input
                id="meters"
                type="number"
                min="1"
                max="300"
                step="0.1"
                value={meters}
                onChange={(e) => handleFieldChange('meters', e.target.value, setMeters)}
                placeholder="100"
                className={cn(
                  fieldsEdited.has('meters') && 'border-amber-500',
                  parseFloat(meters) > 300 && 'border-destructive'
                )}
              />
            </div>
          </div>
          {/* Edit reason - required if any field was edited */}
          {(showEditMode || isManualEntry) && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Edit className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">
                  {String(t('stocktake.editReason'))} *
                </Label>
              </div>
              
              <Select value={editReason} onValueChange={setEditReason}>
                <SelectTrigger>
                  <SelectValue placeholder={String(t('stocktake.selectReason'))} />
                </SelectTrigger>
                <SelectContent>
                  {EDIT_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {editReason === 'other' && (
                <Textarea
                  value={editReasonOther}
                  onChange={(e) => setEditReasonOther(e.target.value)}
                  placeholder={String(t('stocktake.specifyReason'))}
                  className="h-20"
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onRetake}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {String(t('stocktake.retake'))}
          </Button>
          
          <Button
            onClick={handleConfirm}
            disabled={!isValid || (isManualEntry && !editReason) || (duplicateWarning?.isDuplicate && !acknowledgedDuplicate)}
            className="w-full sm:w-auto"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {String(t('stocktake.confirm'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
