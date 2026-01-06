import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStockTakeSessions } from '@/hooks/useInquiries';
import { useLanguage } from '@/contexts/LanguageContext';
import { ClipboardCheck, AlertCircle } from 'lucide-react';

interface StockTakeSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (session: any) => void;
}

const REASON_OPTIONS = [
  { value: 'scheduled_count', labelEn: 'Scheduled Inventory Count', labelTr: 'Planlı Envanter Sayımı' },
  { value: 'cycle_count', labelEn: 'Cycle Count', labelTr: 'Dönemsel Sayım' },
  { value: 'discrepancy_check', labelEn: 'Discrepancy Investigation', labelTr: 'Uyumsuzluk Araştırması' },
  { value: 'year_end', labelEn: 'Year-End Count', labelTr: 'Yıl Sonu Sayımı' },
  { value: 'audit_request', labelEn: 'Audit Request', labelTr: 'Denetim Talebi' },
  { value: 'other', labelEn: 'Other', labelTr: 'Diğer' },
];

const DURATION_OPTIONS = [
  { value: '1', labelEn: '1 Hour', labelTr: '1 Saat' },
  { value: '2', labelEn: '2 Hours', labelTr: '2 Saat' },
  { value: '4', labelEn: '4 Hours', labelTr: '4 Saat' },
  { value: '8', labelEn: '8 Hours (Full Day)', labelTr: '8 Saat (Tam Gün)' },
  { value: '24', labelEn: '24 Hours', labelTr: '24 Saat' },
];

export default function StockTakeSessionDialog({ open, onOpenChange, onSuccess }: StockTakeSessionDialogProps) {
  const { t, language } = useLanguage();
  const { startSession, loading } = useStockTakeSessions();

  const [reason, setReason] = useState('scheduled_count');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('4');

  useEffect(() => {
    if (!open) {
      setReason('scheduled_count');
      setCustomReason('');
      setNotes('');
      setDuration('4');
    }
  }, [open]);

  const handleSubmit = async () => {
    const finalReason = reason === 'other' ? customReason : reason;
    if (!finalReason.trim()) return;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(duration));

    const session = await startSession({
      reason: finalReason,
      notes: notes || undefined,
      expires_at: expiresAt.toISOString(),
    });

    if (session) {
      onSuccess?.(session);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            {String(t('stockTakeSession.start'))}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {String(t('stockTakeSession.description'))}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>{String(t('stockTakeSession.reason'))} *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {language === 'tr' ? opt.labelTr : opt.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === 'other' && (
            <div className="space-y-2">
              <Label>{String(t('stockTakeSession.customReason'))} *</Label>
              <Input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder={String(t('stockTakeSession.customReasonPlaceholder'))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{String(t('stockTakeSession.duration'))}</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {language === 'tr' ? opt.labelTr : opt.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {String(t('stockTakeSession.durationHint'))}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{String(t('notes'))}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={String(t('stockTakeSession.notesPlaceholder'))}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {String(t('cancel'))}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || (reason === 'other' && !customReason.trim())}
          >
            {loading ? String(t('loading')) : String(t('stockTakeSession.startButton'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
