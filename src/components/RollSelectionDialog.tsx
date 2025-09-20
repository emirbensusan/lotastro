import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import { useToast } from '@/hooks/use-toast';

interface Roll {
  id: string;
  position: number;
  meters: number;
}

interface RollSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lotId: string;
  lotNumber: string;
  quality: string;
  color: string;
  totalMeters: number;
  totalRolls: number;
  entryDate: string;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  ageDays?: number;
  sampleMode?: boolean;
  onRollsSelected?: (selectedRollIds: string[], selectedRollsData: Array<{ id: string; meters: number; position: number }>) => void;
}

export const RollSelectionDialog: React.FC<RollSelectionDialogProps> = ({
  isOpen,
  onClose,
  lotId,
  lotNumber,
  quality,
  color,
  totalMeters,
  totalRolls,
  entryDate,
  supplierName,
  invoiceNumber,
  invoiceDate,
  ageDays,
  sampleMode = false,
  onRollsSelected,
}) => {
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [sampleMeters, setSampleMeters] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { addToCart } = usePOCart();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && lotId) {
      fetchRolls();
    }
  }, [isOpen, lotId]);

  const fetchRolls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rolls')
        .select('id, position, meters')
        .eq('lot_id', lotId)
        .order('position');

      if (error) throw error;
      setRolls(data || []);
    } catch (error) {
      console.error('Error fetching rolls:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to load roll details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRollSelection = (rollId: string, checked: boolean) => {
    if (sampleMode) {
      // In sample mode, only allow single roll selection
      setSelectedRollIds(checked ? [rollId] : []);
    } else {
      setSelectedRollIds(prev => 
        checked 
          ? [...prev, rollId]
          : prev.filter(id => id !== rollId)
      );
    }
  };

  const handleSelectAll = () => {
    if (sampleMode) return; // Disable select all in sample mode
    
    if (selectedRollIds.length === rolls.length) {
      setSelectedRollIds([]);
    } else {
      setSelectedRollIds(rolls.map(roll => roll.id));
    }
  };

  const getSelectedMeters = () => {
    if (sampleMode) {
      return sampleMeters;
    }
    return rolls
      .filter(roll => selectedRollIds.includes(roll.id))
      .reduce((total, roll) => total + roll.meters, 0);
  };

  const handleAddSelectedToCart = () => {
    if (selectedRollIds.length === 0) {
      toast({
        title: String(t('error')),
        description: 'Please select at least one roll',
        variant: 'destructive',
      });
      return;
    }

    if (sampleMode) {
      if (sampleMeters <= 0) {
        toast({
          title: String(t('error')),
          description: 'Please specify sample meters',
          variant: 'destructive',
        });
        return;
      }

      const selectedRoll = rolls.find(roll => roll.id === selectedRollIds[0]);
      if (!selectedRoll || sampleMeters > selectedRoll.meters) {
        toast({
          title: String(t('error')),
          description: 'Sample meters cannot exceed roll capacity',
          variant: 'destructive',
        });
        return;
      }
    }

    // Get actual roll data for selected rolls
    const selectedRollsData = rolls
      .filter(roll => selectedRollIds.includes(roll.id))
      .map(roll => ({ 
        id: roll.id, 
        meters: sampleMode ? sampleMeters : roll.meters, 
        position: roll.position 
      }));

    // If onRollsSelected callback is provided, use it instead of adding to cart
    if (onRollsSelected) {
      onRollsSelected(selectedRollIds, selectedRollsData);
      toast({
        title: String(t('success')),
        description: sampleMode 
          ? `Sample ${sampleMeters}m selected from ${lotNumber}`
          : `${selectedRollIds.length} ${String(t('rolls'))} selected from ${lotNumber}`,
      });
      setSelectedRollIds([]);
      setSampleMeters(0);
      return;
    }

    addToCart({
      id: lotId,
      lot_number: lotNumber,
      quality,
      color,
      meters: sampleMode ? sampleMeters : totalMeters,
      roll_count: sampleMode ? 1 : totalRolls,
      selectedRollIds,
      selectedRollsData,
      entry_date: entryDate,
      supplier_name: supplierName,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      age_days: ageDays,
      lineType: sampleMode ? 'sample' : 'standard',
      selectedRollMeters: sampleMode ? [sampleMeters.toString()] : undefined,
    });

    toast({
      title: String(t('addedToCart')),
      description: sampleMode 
        ? `Sample ${sampleMeters}m from ${lotNumber} ${String(t('addedToCart'))}`
        : `${selectedRollIds.length} ${String(t('rolls'))} from ${lotNumber} ${String(t('addedToCart'))}`,
    });

    setSelectedRollIds([]);
    setSampleMeters(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {sampleMode ? String(t('sampleRollSelection')) : String(t('selectRolls'))} - {lotNumber} ({quality} - {color})
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>{t('loading')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('totalRolls')}:</span>
                  <span className="ml-2 font-medium">{rolls.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('selected')}:</span>
                  <span className="ml-2 font-medium">{selectedRollIds.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{sampleMode ? String(t('sampleMeters')) : String(t('selectedMeters'))}:</span>
                  <span className="ml-2 font-medium">{getSelectedMeters().toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('totalMeters')}:</span>
                  <span className="ml-2 font-medium">{totalMeters.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Select All Toggle - Hidden in sample mode */}
            {!sampleMode && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedRollIds.length === rolls.length && rolls.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium">
                    {t('selectAll')} ({rolls.length} {t('rollsLabel')})
                  </label>
                </div>
                <Badge variant="outline">
                  {selectedRollIds.length} / {rolls.length} {t('selectedCount')}
                </Badge>
              </div>
            )}

            {/* Sample mode instructions */}
            {sampleMode && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  {String(t('sampleModeInstructions'))}
                </p>
              </div>
            )}

            {/* Rolls Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {rolls.map((roll) => (
                <div 
                  key={roll.id} 
                  className="flex flex-col items-center space-y-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleRollSelection(roll.id, !selectedRollIds.includes(roll.id))}
                >
                  <Checkbox
                    checked={selectedRollIds.includes(roll.id)}
                  />
                  <span className="text-sm font-medium">{roll.meters.toLocaleString()} mt</span>
                </div>
              ))}
            </div>

            {/* Sample Meters Input - Only show in sample mode when a roll is selected */}
            {sampleMode && selectedRollIds.length > 0 && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <label className="block text-sm font-medium mb-2">
                  {String(t('sampleMetersLabel')).replace('{max}', String(rolls.find(r => r.id === selectedRollIds[0])?.meters || 0))}
                </label>
                <Input
                  type="number"
                  min="0.1"
                  max={rolls.find(r => r.id === selectedRollIds[0])?.meters || 0}
                  step="0.1"
                  value={sampleMeters || ''}
                  onChange={(e) => setSampleMeters(parseFloat(e.target.value) || 0)}
                  placeholder={String(t('enterSampleMeters'))}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button 
                onClick={handleAddSelectedToCart}
                disabled={selectedRollIds.length === 0 || (sampleMode && sampleMeters <= 0)}
              >
                {sampleMode 
                  ? String(t('addSampleButton')).replace('{meters}', String(sampleMeters)) 
                  : `${String(t('addSelectedToCart'))} (${selectedRollIds.length} ${String(t('rollsLabel'))})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};