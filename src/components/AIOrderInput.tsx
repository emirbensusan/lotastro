import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { FileText, Image, Upload, Sparkles, Trash2, CheckCircle, AlertCircle, Edit2, Save, X, Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { AutocompleteInput } from '@/components/AutocompleteInput';

interface DraftLine {
  line_no: number;
  quality: string | null;
  color: string | null;
  meters: number | null;
  source_row: string;
  extraction_status: 'ok' | 'needs_review' | 'missing';
  resolution_source?: 'deterministic' | 'llm' | 'hybrid';
  intent_type?: string;
  quantity_unit?: string;
  confidence_score?: number;
  is_firm_order?: boolean;
  is_sample?: boolean;
  is_option_or_blocked?: boolean;
  customer_name?: string;
  reference_numbers?: string;
  conflict_info?: {
    detected_label: string;
    detected_code: string;
    possible_qualities: string[];
  };
}

interface AggregatedLine {
  quality: string;
  color: string;
  meters: number;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export default function AIOrderInput() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<DraftLine>>({});

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('aiOrder.fileTooLarge') as string);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('aiOrder.invalidFileType') as string);
      return;
    }

    setSelectedFile(file);
    setPastedText(''); // Clear pasted text if file selected
  };

  const handleExtract = async () => {
    if (!pastedText && !selectedFile) {
      toast.error(t('aiOrder.noInput') as string);
      return;
    }

    if (!profile?.user_id) {
      toast.error(t('aiOrder.notAuthenticated') as string);
      return;
    }

    setExtracting(true);

    try {
      let filePath: string | undefined;
      let sourceType: 'paste' | 'pdf' | 'image' = 'paste';

      // Upload file if provided
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const tempDraftId = crypto.randomUUID();
        filePath = `${tempDraftId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('ai_order_uploads')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        sourceType = selectedFile.type.startsWith('image/') ? 'image' : 'pdf';
      }

      // Call extraction edge function
      const { data, error } = await supabase.functions.invoke('extract-order', {
        body: {
          pasteText: pastedText || undefined,
          filePath,
          sourceType,
          userId: profile.user_id,
          note: note || undefined,
        },
      });

      if (error) {
        console.error('Extraction error:', error);
        if (error.message.includes('rate_limit')) {
          toast.error(t('aiOrder.rateLimitError') as string);
        } else if (error.message.includes('payment_required')) {
          toast.error(t('aiOrder.creditsError') as string);
        } else {
          throw error;
        }
        return;
      }

      if (!data?.draftId || !data?.rows) {
        throw new Error('Invalid response from extraction');
      }

      setDraftId(data.draftId);
      setDraftLines(data.rows);
      toast.success(t('aiOrder.extractionSuccess') as string);
    } catch (error: any) {
      console.error('Error extracting order:', error);
      toast.error(t('aiOrder.extractionFailed') as string + ': ' + error.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleEditLine = (lineNo: number) => {
    const line = draftLines.find(l => l.line_no === lineNo);
    if (line) {
      setEditingLine(lineNo);
      setEditValues({ ...line });
    }
  };

  const handleSaveEdit = async () => {
    if (editingLine === null || !draftId) return;

    // Validate quality+color combination if both are present
    if (editValues.quality && editValues.color) {
      try {
        const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-extraction');
        
        if (!validationError && validationData) {
          const { colorsByQuality } = validationData;
          const qualityColors = colorsByQuality[editValues.quality] || [];
          const isValidColor = qualityColors.some((c: any) => 
            c.label.toUpperCase() === editValues.color?.toUpperCase() ||
            (c.code && c.code.toUpperCase() === editValues.color?.toUpperCase())
          );
          
          if (!isValidColor) {
            toast.error(
              `Color "${editValues.color}" does not exist for quality "${editValues.quality}". ` +
              `Please go to Admin → Quality Management to create this color first, then try again.`,
              { duration: 8000 }
            );
            // Keep status as needs_review
            const updatedLines = draftLines.map(line => {
              if (line.line_no === editingLine) {
                return { ...line, ...editValues, extraction_status: 'needs_review' as const };
              }
              return line;
            });
            setDraftLines(updatedLines);
            return;
          }
        }
      } catch (validationErr) {
        console.warn('Validation check failed, proceeding anyway:', validationErr);
      }
    }

    const updatedLines = draftLines.map(line => {
      if (line.line_no === editingLine) {
        const updated = { ...line, ...editValues };
        // Update status based on completeness
        if (updated.quality && updated.color && updated.meters && updated.meters > 0) {
          updated.extraction_status = 'ok';
        } else {
          updated.extraction_status = 'needs_review';
        }
        return updated;
      }
      return line;
    });

    setDraftLines(updatedLines);

    // Update in database
    try {
      const { error } = await supabase
        .from('po_draft_lines')
        .update({
          quality: editValues.quality,
          color: editValues.color,
          meters: editValues.meters,
          extraction_status: editValues.quality && editValues.color && editValues.meters ? 'ok' : 'needs_review',
        })
        .eq('draft_id', draftId)
        .eq('line_no', editingLine);

      if (error) throw error;

      setEditingLine(null);
      setEditValues({});
      toast.success(t('aiOrder.lineUpdated') as string);
    } catch (error: any) {
      toast.error(t('aiOrder.updateFailed') as string + ': ' + error.message);
    }
  };

  const handleDeleteLine = async (lineNo: number) => {
    if (!draftId) return;

    try {
      const { error } = await supabase
        .from('po_draft_lines')
        .delete()
        .eq('draft_id', draftId)
        .eq('line_no', lineNo);

      if (error) throw error;

      setDraftLines(prev => prev.filter(l => l.line_no !== lineNo));
      toast.success(t('aiOrder.lineDeleted') as string);
    } catch (error: any) {
      toast.error(t('aiOrder.deleteFailed') as string + ': ' + error.message);
    }
  };

  const handleConfirmDraft = async () => {
    if (!draftId || !profile?.user_id) return;

    const hasInvalidLines = draftLines.some(
      l => !l.quality || !l.color || !l.meters || l.meters <= 0 || l.extraction_status !== 'ok'
    );

    if (hasInvalidLines) {
      toast.error(t('aiOrder.reviewRequired') as string);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('confirm-draft', {
        body: {
          draftId,
          userId: profile.user_id,
        },
      });

      if (error) throw error;

      if (!data?.aggregated) {
        throw new Error('Invalid response from confirmation');
      }

      const aggregated: AggregatedLine[] = data.aggregated;
      
      // Sort by meters descending (highest first)
      aggregated.sort((a, b) => b.meters - a.meters);
      
      toast.success(t('aiOrder.draftConfirmed') as string);

      // Navigate directly to inventory page with first item
      const firstItem = aggregated[0];
      navigate(`/inventory/${encodeURIComponent(firstItem.quality)}/${encodeURIComponent(firstItem.color)}`, {
        state: {
          fromAIDraft: true,
          requestedItems: aggregated,
          currentIndex: 0
        }
      });
    } catch (error: any) {
      console.error('Error confirming draft:', error);
      toast.error(t('aiOrder.confirmFailed') as string + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPastedText('');
    setSelectedFile(null);
    setNote('');
    setDraftId(null);
    setDraftLines([]);
    setEditingLine(null);
    setEditValues({});
    setExtracting(false);
    setLoading(false);
  };
  
  // Auto-open first needs_review row
  useEffect(() => {
    if (draftLines.length > 0 && editingLine === null) {
      const firstNeedsReview = draftLines.find(l => l.extraction_status === 'needs_review');
      if (firstNeedsReview) {
        handleEditLine(firstNeedsReview.line_no);
        toast.info(t('aiOrder.editPrompt') as string, { duration: 5000 });
      }
    }
  }, [draftLines]);

  const getIntentBadge = (intent?: string) => {
    const colors: Record<string, string> = {
      order: 'bg-green-500 hover:bg-green-600',
      sample_request: 'bg-blue-500 hover:bg-blue-600',
      stock_inquiry: 'bg-yellow-500 hover:bg-yellow-600',
      reservation: 'bg-purple-500 hover:bg-purple-600',
      update: 'bg-orange-500 hover:bg-orange-600',
      approval: 'bg-teal-500 hover:bg-teal-600',
      shipping: 'bg-cyan-500 hover:bg-cyan-600',
      price_request: 'bg-pink-500 hover:bg-pink-600',
      noise: 'bg-gray-400 hover:bg-gray-500',
    };
    return <Badge className={colors[intent || ''] || 'bg-gray-400'}>{intent || 'unknown'}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return <Badge variant="default" className="bg-success"><CheckCircle className="h-3 w-3 mr-1" />{t('aiOrder.statusOk')}</Badge>;
      case 'needs_review':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />{t('aiOrder.statusReview')}</Badge>;
      case 'missing':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{t('aiOrder.statusMissing')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canConfirm = draftLines.length > 0 && draftLines.every(l => 
    l.quality && l.color && l.meters && l.meters > 0 && l.extraction_status === 'ok'
  );

  // Auto-open first needs_review row in edit mode
  useEffect(() => {
    if (draftLines.length > 0 && editingLine === null) {
      const firstNeedsReview = draftLines.find(l => l.extraction_status === 'needs_review');
      if (firstNeedsReview) {
        handleEditLine(firstNeedsReview.line_no);
        toast.info(t('aiOrder.editPrompt') as string, { duration: 5000 });
      }
    }
  }, [draftLines]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {t('aiOrder.title')}
            </CardTitle>
            <CardDescription>{t('aiOrder.description')}</CardDescription>
          </div>
          {(draftId || pastedText || selectedFile) && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <X className="h-4 w-4 mr-2" />
              {t('aiOrder.startNew')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!draftId ? (
          <>
            {/* Input Section */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="paste-text" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('aiOrder.pasteLabel')}
                </Label>
                <Textarea
                  id="paste-text"
                  placeholder={t('aiOrder.pastePlaceholder') as string}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  disabled={!!selectedFile || extracting}
                  rows={6}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-sm text-muted-foreground">{t('aiOrder.or')}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div>
                <Label htmlFor="file-upload" className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  {t('aiOrder.uploadLabel')}
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  disabled={!!pastedText || extracting}
                  className="mt-2"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('aiOrder.selectedFile')}: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="note">{t('aiOrder.noteLabel')}</Label>
                <Input
                  id="note"
                  placeholder={t('aiOrder.notePlaceholder') as string}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={extracting}
                  className="mt-2"
                />
              </div>

              <Button
                onClick={handleExtract}
                disabled={(!pastedText && !selectedFile) || extracting}
                className="w-full"
              >
                {extracting ? (
                  <>{t('aiOrder.extracting')}</>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('aiOrder.extractButton')}
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Preview Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t('aiOrder.previewTitle')}</h3>
              </div>

              {/* Edit Tip Banner */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>{t('aiOrder.editTip.title')}</strong>
                  <p className="mt-1">{t('aiOrder.editTip.description')}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{t('aiOrder.quality')}</TableHead>
                      <TableHead>{t('aiOrder.color')}</TableHead>
                      <TableHead>{t('aiOrder.meters')}</TableHead>
                      <TableHead>{t('aiOrder.status')}</TableHead>
                      <TableHead className="text-right">{t('aiOrder.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {draftLines.map((line) => (
                    <TableRow key={line.line_no}>
                      <TableCell>{line.line_no}</TableCell>
                      <TableCell>{getIntentBadge(line.intent_type)}</TableCell>
                        <TableCell>
                          {editingLine === line.line_no ? (
                            <AutocompleteInput
                              type="quality"
                              value={editValues.quality || ''}
                              onChange={(value) => setEditValues(prev => ({ ...prev, quality: value }))}
                              className="w-full"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              {line.quality || <span className="text-muted-foreground">-</span>}
                              {import.meta.env.DEV && line.resolution_source && (
                                <span className="text-xs text-muted-foreground">({line.resolution_source})</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingLine === line.line_no ? (
                            <AutocompleteInput
                              type="color"
                              value={editValues.color || ''}
                              onChange={(value) => setEditValues(prev => ({ ...prev, color: value }))}
                              quality={editValues.quality || undefined}
                              className="w-full"
                            />
                          ) : (
                            <div>
                              {line.color || <span className="text-muted-foreground">-</span>}
                              {line.conflict_info && (
                                <div className="text-xs text-amber-600 mt-1">
                                  {t('aiOrder.conflictWarning')}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingLine === line.line_no ? (
                            <Input
                              type="number"
                              value={editValues.meters || ''}
                              onChange={(e) => setEditValues(prev => ({ ...prev, meters: parseFloat(e.target.value) || null }))}
                              className="w-full"
                            />
                          ) : (
                            line.meters ? `${line.meters} m` : <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(line.extraction_status)}</TableCell>
                        <TableCell className="text-right">
                          {editingLine === line.line_no ? (
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" onClick={handleSaveEdit}>{t('save')}</Button>
                              <Button size="sm" variant="outline" onClick={() => {
                                setEditingLine(null);
                                setEditValues({});
                              }}>{t('cancel')}</Button>
                            </div>
                           ) : (
                             <div className="flex gap-2 justify-end">
                               <Button size="sm" variant="outline" onClick={() => handleEditLine(line.line_no)}>
                                 <Edit2 className="h-4 w-4" />
                               </Button>
                               <Button size="sm" variant="ghost" onClick={() => handleDeleteLine(line.line_no)}>
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                             </div>
                           )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmDraft}
                  disabled={!canConfirm || loading}
                  className="flex-1"
                >
                  {loading ? t('aiOrder.confirming') : t('aiOrder.confirmButton')}
                </Button>
              </div>

              {!canConfirm && draftLines.length > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {t('aiOrder.reviewWarning')}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
