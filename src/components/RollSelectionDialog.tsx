import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
}) => {
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
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
    setSelectedRollIds(prev => 
      checked 
        ? [...prev, rollId]
        : prev.filter(id => id !== rollId)
    );
  };

  const handleSelectAll = () => {
    if (selectedRollIds.length === rolls.length) {
      setSelectedRollIds([]);
    } else {
      setSelectedRollIds(rolls.map(roll => roll.id));
    }
  };

  const getSelectedMeters = () => {
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

    addToCart({
      id: lotId,
      lot_number: lotNumber,
      quality,
      color,
      meters: totalMeters,
      roll_count: totalRolls,
      selectedRollIds,
      entry_date: entryDate,
      supplier_name: supplierName,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      age_days: ageDays,
    });

    toast({
      title: String(t('addedToCart')),
      description: `${selectedRollIds.length} ${String(t('rolls'))} from ${lotNumber} ${String(t('addedToCart'))}`,
    });

    setSelectedRollIds([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('selectRolls')} - {lotNumber} ({quality} - {color})
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
                  <span className="text-muted-foreground">{t('selectedMeters')}:</span>
                  <span className="ml-2 font-medium">{getSelectedMeters().toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('totalMeters')}:</span>
                  <span className="ml-2 font-medium">{totalMeters.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Select All Toggle */}
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

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button 
                onClick={handleAddSelectedToCart}
                disabled={selectedRollIds.length === 0}
              >
                {t('addSelectedToCart')} ({selectedRollIds.length} {t('rollsLabel')})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};