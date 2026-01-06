import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { useInquiries, Inquiry } from '@/hooks/useInquiries';
import { format } from 'date-fns';
import { Copy, XCircle, ArrowRightCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type InquiryReason = Database['public']['Enums']['inquiry_reason'];
type InquiryStatus = Database['public']['Enums']['inquiry_status'];

interface InquiryDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiry: Inquiry | null;
  onCancel?: (inquiry: Inquiry) => void;
  onConvert?: (inquiry: Inquiry) => void;
  onRefresh?: () => void;
}

const STATUS_COLORS: Record<InquiryStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-primary text-primary-foreground',
  converted: 'bg-green-500 text-white',
  expired: 'bg-orange-500 text-white',
  cancelled: 'bg-destructive text-destructive-foreground',
};

const REASON_LABELS: Record<InquiryReason, { en: string; tr: string }> = {
  customer_quote: { en: 'Customer Quote', tr: 'Müşteri Teklifi' },
  stock_check: { en: 'Stock Check', tr: 'Stok Kontrolü' },
  management_review: { en: 'Management Review', tr: 'Yönetim İncelemesi' },
  stock_take: { en: 'Stock Take', tr: 'Sayım' },
  qa_investigation: { en: 'QA Investigation', tr: 'Kalite Araştırması' },
};

export default function InquiryDetailsDialog({ 
  open, 
  onOpenChange, 
  inquiry,
  onCancel,
  onConvert,
  onRefresh,
}: InquiryDetailsDialogProps) {
  const { t, language } = useLanguage();
  const { cancelInquiry, loading } = useInquiries();

  if (!inquiry) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(inquiry.inquiry_number);
    toast.success(String(t('inquiry.idCopied')));
  };

  const handleCancel = async () => {
    if (onCancel) {
      onCancel(inquiry);
    } else {
      const confirmed = window.confirm(String(t('inquiry.confirmCancel')));
      if (confirmed) {
        const success = await cancelInquiry(inquiry.id);
        if (success) {
          onRefresh?.();
          onOpenChange(false);
        }
      }
    }
  };

  const handleConvert = () => {
    onConvert?.(inquiry);
  };

  const totalMeters = inquiry.inquiry_lines?.reduce((sum, line) => sum + line.requested_meters, 0) || 0;
  const canCancel = inquiry.status === 'active' || inquiry.status === 'draft';
  const canConvert = inquiry.status === 'active' && onConvert;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{String(t('inquiry.details'))}</span>
            <Badge className={STATUS_COLORS[inquiry.status]}>
              {inquiry.status.toUpperCase()}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Header Info */}
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">{String(t('inquiry.number'))}</div>
                    <div className="font-mono font-semibold flex items-center gap-2">
                      {inquiry.inquiry_number}
                      <Button size="sm" variant="ghost" onClick={handleCopyId}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{String(t('inquiry.reason'))}</div>
                    <div className="font-medium">
                      {language === 'tr' ? REASON_LABELS[inquiry.reason].tr : REASON_LABELS[inquiry.reason].en}
                    </div>
                  </div>
                  {inquiry.customer_name && (
                    <div>
                      <div className="text-xs text-muted-foreground">{String(t('customer'))}</div>
                      <div className="font-medium">{inquiry.customer_name}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-muted-foreground">{String(t('createdBy'))}</div>
                    <div className="font-medium">
                      {inquiry.profiles?.full_name || inquiry.profiles?.email || '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{String(t('created'))}</div>
                    <div className="font-medium">
                      {format(new Date(inquiry.created_at), 'PPp')}
                    </div>
                  </div>
                  {inquiry.expires_at && (
                    <div>
                      <div className="text-xs text-muted-foreground">{String(t('inquiry.expiresAt'))}</div>
                      <div className="font-medium">
                        {format(new Date(inquiry.expires_at), 'PP')}
                      </div>
                    </div>
                  )}
                </div>

                {inquiry.notes && (
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground">{String(t('notes'))}</div>
                    <div className="mt-1 text-sm bg-muted p-2 rounded">{inquiry.notes}</div>
                  </div>
                )}

                {inquiry.converted_to_order_id && (
                  <div className="mt-4 p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                    <div className="text-xs text-green-700 dark:text-green-300">{String(t('inquiry.convertedTo'))}</div>
                    <div className="font-mono font-semibold text-green-800 dark:text-green-200">
                      Order: {inquiry.converted_to_order_id}
                    </div>
                    {inquiry.converted_at && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        {format(new Date(inquiry.converted_at), 'PPp')}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lines */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{String(t('inquiry.lines'))}</CardTitle>
              </CardHeader>
              <CardContent>
                {inquiry.inquiry_lines && inquiry.inquiry_lines.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{String(t('quality'))}</TableHead>
                          <TableHead>{String(t('color'))}</TableHead>
                          <TableHead className="text-right">{String(t('meters'))}</TableHead>
                          <TableHead>{String(t('scope'))}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inquiry.inquiry_lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">{line.quality}</TableCell>
                            <TableCell>{line.color}</TableCell>
                            <TableCell className="text-right">{line.requested_meters.toFixed(2)}m</TableCell>
                            <TableCell>
                              <Badge variant="outline">{line.scope}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Separator className="my-2" />
                    <div className="text-right font-semibold">
                      {String(t('total'))}: {totalMeters.toFixed(2)}m
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    {String(t('inquiry.noLines'))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2">
          {canCancel && (
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              <XCircle className="h-4 w-4 mr-2" />
              {String(t('inquiry.cancel'))}
            </Button>
          )}
          {canConvert && (
            <Button onClick={handleConvert}>
              <ArrowRightCircle className="h-4 w-4 mr-2" />
              {String(t('inquiry.convertToOrder'))}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {String(t('close'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
