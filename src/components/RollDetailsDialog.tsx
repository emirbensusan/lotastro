import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Package, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import { useToast } from '@/hooks/use-toast';

interface Roll {
  id: string;
  position: number;
  meters: number;
}

interface LotDetails {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  entry_date: string;
  age_days: number;
  supplier_name?: string;
  invoice_number?: string;
  invoice_date?: string;
}

interface RollDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  quality: string;
  color: string;
  lotNumber: string;
}

export function RollDetailsDialog({ isOpen, onClose, quality, color, lotNumber }: RollDetailsDialogProps) {
  const [lotDetails, setLotDetails] = useState<LotDetails | null>(null);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const { t } = useLanguage();
  const { addToCart } = usePOCart();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && lotNumber) {
      fetchRollDetails();
    }
  }, [isOpen, lotNumber]);

  const fetchRollDetails = async () => {
    setLoading(true);
    try {
      // Fetch lot details with supplier information
      const { data: lotData, error: lotError } = await supabase
        .from('lots')
        .select(`
          id,
          lot_number,
          quality,
          color,
          meters,
          roll_count,
          entry_date,
          invoice_number,
          invoice_date,
          suppliers!inner(name)
        `)
        .eq('lot_number', lotNumber)
        .eq('quality', quality)
        .eq('color', color)
        .eq('status', 'in_stock')
        .single();

      if (lotError) {
        console.error('Error fetching lot details:', lotError);
        return;
      }

      if (lotData) {
        const age_days = Math.floor(
          (new Date().getTime() - new Date(lotData.entry_date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );

        setLotDetails({
          ...lotData,
          age_days,
          supplier_name: lotData.suppliers?.name
        });

        // Fetch individual rolls for this lot
        const { data: rollsData, error: rollsError } = await supabase
          .from('rolls')
          .select('id, position, meters')
          .eq('lot_id', lotData.id)
          .order('position');

        if (rollsError) {
          console.error('Error fetching rolls:', rollsError);
        } else if (rollsData) {
          setRolls(rollsData);
        }

        // Set default quantity to minimum of 1 or available rolls
        setSelectedQuantity(Math.min(1, lotData.roll_count));
      }
    } catch (error) {
      console.error('Error fetching roll details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!lotDetails) return;

    const cartItem = {
      id: lotDetails.id,
      lot_number: lotDetails.lot_number,
      quality: lotDetails.quality,
      color: lotDetails.color,
      meters: lotDetails.meters,
      roll_count: lotDetails.roll_count,
      selectedRollIds: [], // For now, we'll use empty array - this should be improved later
      entry_date: lotDetails.entry_date,
      supplier_name: lotDetails.supplier_name,
      invoice_number: lotDetails.invoice_number || undefined,
      invoice_date: lotDetails.invoice_date || undefined,
      age_days: lotDetails.age_days
    };

    addToCart(cartItem);
    toast({
      title: String(t('addedToCart')),
      description: `${selectedQuantity} ${String(t('rollsLabel'))} from ${lotDetails.lot_number}`,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            {t('rollDetails')}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
          </div>
        )}

        {!loading && lotDetails && (
          <div className="space-y-6">
            {/* Lot Information Header */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5" />
                <h3 className="font-semibold text-lg">{lotDetails.lot_number}</h3>
                <Badge variant="outline">
                  <Calendar className="w-3 h-3 mr-1" />
                  {lotDetails.age_days} {t('days')}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('quality')}:</span>
                  <p className="font-medium">{lotDetails.quality}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('color')}:</span>
                  <p className="font-medium">{lotDetails.color}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('totalRollsInLot')}:</span>
                  <p className="font-medium">{lotDetails.roll_count} {t('rollsLabel')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('meters')}:</span>
                  <p className="font-medium">{lotDetails.meters}m</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('stockEntryDate')}:</span>
                  <p className="font-medium">{new Date(lotDetails.entry_date).toLocaleDateString()}</p>
                </div>
                {lotDetails.supplier_name && (
                  <div>
                    <span className="text-muted-foreground">{t('supplier')}:</span>
                    <p className="font-medium">{lotDetails.supplier_name}</p>
                  </div>
                )}
                {lotDetails.invoice_number && (
                  <div>
                    <span className="text-muted-foreground">{t('invoiceNumber')}:</span>
                    <p className="font-medium">{lotDetails.invoice_number}</p>
                  </div>
                )}
                {lotDetails.invoice_date && (
                  <div>
                    <span className="text-muted-foreground">{t('invoiceDate')}:</span>
                    <p className="font-medium">{new Date(lotDetails.invoice_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Individual Rolls Table */}
            <div>
              <h4 className="font-medium mb-3">{t('rollsLabel')} ({rolls.length})</h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('rollPosition')}</TableHead>
                      <TableHead>{t('rollMeters')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rolls.map((roll) => (
                      <TableRow key={roll.id}>
                        <TableCell className="font-medium">#{roll.position}</TableCell>
                        <TableCell>{roll.meters}m</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Add to Cart Section */}
            <div className="flex items-center justify-between gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <div>
                  <Label htmlFor="quantity">{t('rollCount')}</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={lotDetails.roll_count}
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(Math.min(parseInt(e.target.value) || 1, lotDetails.roll_count))}
                    className="w-20"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{t('meters')}: {((lotDetails.meters / lotDetails.roll_count) * selectedQuantity).toFixed(2)}m</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleAddToCart}>
                  {t('addToCart')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}