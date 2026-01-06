import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useInquiries, InquiryLine, CreateInquiryInput } from '@/hooks/useInquiries';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Search } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type InquiryReason = Database['public']['Enums']['inquiry_reason'];

interface InquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultReason?: InquiryReason;
}

interface AvailableQualityColor {
  quality: string;
  color: string;
  total_meters: number;
  available_meters: number;
  lot_count: number;
}

const REASON_LABELS: Record<InquiryReason, { en: string; tr: string }> = {
  customer_quote: { en: 'Customer Quote', tr: 'Müşteri Teklifi' },
  stock_check: { en: 'Stock Check', tr: 'Stok Kontrolü' },
  management_review: { en: 'Management Review', tr: 'Yönetim İncelemesi' },
  stock_take: { en: 'Stock Take', tr: 'Sayım' },
  qa_investigation: { en: 'QA Investigation', tr: 'Kalite Araştırması' },
};

export default function InquiryDialog({ open, onOpenChange, onSuccess, defaultReason = 'customer_quote' }: InquiryDialogProps) {
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const { createInquiry, loading } = useInquiries();

  // Form state
  const [reason, setReason] = useState<InquiryReason>(defaultReason);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [lines, setLines] = useState<Omit<InquiryLine, 'id'>[]>([]);

  // Available inventory
  const [availableItems, setAvailableItems] = useState<AvailableQualityColor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingInventory, setLoadingInventory] = useState(false);

  // New line form
  const [newLineQuality, setNewLineQuality] = useState('');
  const [newLineColor, setNewLineColor] = useState('');
  const [newLineMeters, setNewLineMeters] = useState('');

  // Check if customer is required based on reason
  const customerRequired = reason === 'customer_quote';

  useEffect(() => {
    if (open) {
      fetchAvailableInventory();
    } else {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setReason(defaultReason);
    setCustomerName('');
    setNotes('');
    setExpiresAt('');
    setLines([]);
    setSearchQuery('');
    setNewLineQuality('');
    setNewLineColor('');
    setNewLineMeters('');
  };

  const fetchAvailableInventory = async () => {
    try {
      setLoadingInventory(true);
      const { data, error } = await supabase
        .from('lots')
        .select('quality, color, meters, reserved_meters')
        .eq('status', 'in_stock')
        .gt('meters', 0);

      if (error) throw error;

      // Aggregate by quality/color
      const aggregated = (data || []).reduce((acc, lot) => {
        const key = `${lot.quality}|${lot.color}`;
        if (!acc[key]) {
          acc[key] = {
            quality: lot.quality,
            color: lot.color,
            total_meters: 0,
            available_meters: 0,
            lot_count: 0,
          };
        }
        acc[key].total_meters += lot.meters;
        acc[key].available_meters += (lot.meters - lot.reserved_meters);
        acc[key].lot_count += 1;
        return acc;
      }, {} as Record<string, AvailableQualityColor>);

      setAvailableItems(Object.values(aggregated).filter(item => item.available_meters > 0));
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleAddLine = () => {
    if (!newLineQuality || !newLineColor || !newLineMeters) return;

    const meters = parseFloat(newLineMeters);
    if (isNaN(meters) || meters <= 0) return;

    setLines([...lines, {
      quality: newLineQuality,
      color: newLineColor,
      requested_meters: meters,
      scope: 'quality_color',
    }]);

    setNewLineQuality('');
    setNewLineColor('');
    setNewLineMeters('');
  };

  const handleAddFromInventory = (item: AvailableQualityColor) => {
    const metersStr = prompt(`Enter meters to inquire (max ${item.available_meters.toFixed(2)}m):`);
    if (!metersStr) return;

    const meters = parseFloat(metersStr);
    if (isNaN(meters) || meters <= 0 || meters > item.available_meters) {
      return;
    }

    setLines([...lines, {
      quality: item.quality,
      color: item.color,
      requested_meters: meters,
      scope: 'quality_color',
    }]);
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (customerRequired && !customerName.trim()) {
      return;
    }
    if (lines.length === 0) {
      return;
    }

    const input: CreateInquiryInput = {
      reason,
      customer_name: customerName || undefined,
      notes: notes || undefined,
      expires_at: expiresAt || undefined,
      lines,
    };

    const result = await createInquiry(input);
    if (result) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const filteredItems = availableItems.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return item.quality.toLowerCase().includes(query) || item.color.toLowerCase().includes(query);
  });

  const totalRequestedMeters = lines.reduce((sum, line) => sum + line.requested_meters, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{String(t('inquiry.createNew'))}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Inquiry Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{String(t('inquiry.details'))}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{String(t('inquiry.reason'))} *</Label>
                    <Select value={reason} onValueChange={(v) => setReason(v as InquiryReason)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(REASON_LABELS).map(([key, labels]) => (
                          <SelectItem key={key} value={key}>
                            {language === 'tr' ? labels.tr : labels.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {String(t('inquiry.customerName'))} {customerRequired && '*'}
                    </Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={String(t('inquiry.customerNamePlaceholder'))}
                      required={customerRequired}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{String(t('inquiry.expiresAt'))}</Label>
                    <Input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{String(t('inquiry.notes'))}</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={String(t('inquiry.notesPlaceholder'))}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Add Lines */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{String(t('inquiry.lines'))}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Manual Entry */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">{String(t('quality'))}</Label>
                    <Input
                      value={newLineQuality}
                      onChange={(e) => setNewLineQuality(e.target.value)}
                      placeholder={String(t('quality'))}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">{String(t('color'))}</Label>
                    <Input
                      value={newLineColor}
                      onChange={(e) => setNewLineColor(e.target.value)}
                      placeholder={String(t('color'))}
                    />
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-xs">{String(t('meters'))}</Label>
                    <Input
                      type="number"
                      value={newLineMeters}
                      onChange={(e) => setNewLineMeters(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <Button onClick={handleAddLine} disabled={!newLineQuality || !newLineColor || !newLineMeters}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Browse Inventory */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={String(t('inquiry.searchInventory'))}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {loadingInventory ? (
                      <div className="text-center text-muted-foreground py-2">Loading...</div>
                    ) : filteredItems.length === 0 ? (
                      <div className="text-center text-muted-foreground py-2">{String(t('noResultsFound'))}</div>
                    ) : (
                      filteredItems.slice(0, 20).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 border rounded text-sm hover:bg-muted/50">
                          <div>
                            <span className="font-medium">{item.quality}</span>
                            <span className="text-muted-foreground"> - {item.color}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({item.available_meters.toFixed(1)}m available, {item.lot_count} lots)
                            </span>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleAddFromInventory(item)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Selected Lines */}
                {lines.length > 0 && (
                  <div className="border-t pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{String(t('quality'))}</TableHead>
                          <TableHead>{String(t('color'))}</TableHead>
                          <TableHead className="text-right">{String(t('meters'))}</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{line.quality}</TableCell>
                            <TableCell>{line.color}</TableCell>
                            <TableCell className="text-right">{line.requested_meters.toFixed(2)}m</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => handleRemoveLine(idx)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="text-right mt-2 font-medium">
                      {String(t('total'))}: {totalRequestedMeters.toFixed(2)}m
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {String(t('cancel'))}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || lines.length === 0 || (customerRequired && !customerName.trim())}
          >
            {loading ? String(t('loading')) : String(t('inquiry.create'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
