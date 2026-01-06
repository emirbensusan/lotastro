import React, { useState, useEffect, useMemo } from 'react';
import { Autocomplete } from '@/components/ui/autocomplete';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Package, Eye } from 'lucide-react';
import { RollDetailsDialog } from '@/components/RollDetailsDialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface LotOption {
  lot_number: string;
  meters: number;
  roll_count: number;
  entry_date: string;
  age_days: number;
}

interface HierarchicalAutocompleteProps {
  quality: string;
  color: string;
  selectedLot: string;
  onQualityChange: (quality: string) => void;
  onColorChange: (color: string) => void;
  onLotChange: (lot: string, lotData?: LotOption) => void;
  className?: string;
}

export function HierarchicalAutocomplete({
  quality,
  color,
  selectedLot,
  onQualityChange,
  onColorChange,
  onLotChange,
  className
}: HierarchicalAutocompleteProps) {
  const [qualities, setQualities] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [lots, setLots] = useState<LotOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [qualitiesLoading, setQualitiesLoading] = useState(true);
  const [rollDetailsOpen, setRollDetailsOpen] = useState(false);
  const { t } = useLanguage();

  // Fetch available qualities
  useEffect(() => {
    fetchQualities();
  }, []);

  // Fetch colors when quality changes - only after valid quality is selected
  useEffect(() => {
    if (quality && qualities.length > 0 && validateQuality(quality)) {
      fetchColors(quality);
    } else {
      setColors([]);
      if (color) onColorChange(''); // Only clear if there was a color selected
    }
  }, [quality, qualities]);

  // Fetch lots when both quality and color are selected - only after valid selections
  useEffect(() => {
    if (quality && color && qualities.length > 0 && colors.length > 0 && validateQuality(quality) && validateColor(color)) {
      fetchLots(quality, color);
    } else {
      setLots([]);
      if (selectedLot) onLotChange(''); // Only clear if there was a lot selected
    }
  }, [quality, color, qualities, colors]);

  const fetchQualities = async () => {
    setQualitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('quality')
        .eq('status', 'in_stock')
        .order('quality');
      
      if (error) {
        console.error('Error fetching qualities:', error);
        return;
      }
      
      if (data) {
        const uniqueQualities = [...new Set(data.map(item => item.quality))].filter(Boolean);
        setQualities(uniqueQualities);
        console.log(`Loaded ${uniqueQualities.length} qualities`);
      }
    } catch (error) {
      console.error('Error fetching qualities:', error);
    } finally {
      setQualitiesLoading(false);
    }
  };

  // Validation functions
  const validateQuality = (qualityValue: string) => {
    return qualities.includes(qualityValue);
  };

  const validateColor = (colorValue: string) => {
    return colors.includes(colorValue);
  };

  const fetchColors = async (selectedQuality: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('lots')
        .select('color')
        .eq('status', 'in_stock')
        .eq('quality', selectedQuality)
        .order('color');
      
      if (data) {
        const uniqueColors = [...new Set(data.map(item => item.color))];
        setColors(uniqueColors);
      }
    } catch (error) {
      console.error('Error fetching colors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLots = async (selectedQuality: string, selectedColor: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('lots')
        .select('lot_number, meters, roll_count, entry_date')
        .eq('status', 'in_stock')
        .eq('quality', selectedQuality)
        .eq('color', selectedColor)
        .order('entry_date', { ascending: true }); // Oldest first (FIFO)
      
      if (data) {
        const lotsWithAge = data.map(lot => ({
          ...lot,
          age_days: Math.floor(
            (new Date().getTime() - new Date(lot.entry_date).getTime()) / 
            (1000 * 60 * 60 * 24)
          )
        }));
        setLots(lotsWithAge);
      }
    } catch (error) {
      console.error('Error fetching lots:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare items for autocomplete (no pre-filtering, let Autocomplete component handle it)
  const lotItems = useMemo(() => {
    return lots.map(lot => `${lot.lot_number} (${lot.age_days}d, ${lot.meters}m, ${lot.roll_count}r)`);
  }, [lots]);

  const handleLotSelect = (lotString: string) => {
    const lotNumber = lotString.split(' (')[0];
    const lotData = lots.find(l => l.lot_number === lotNumber);
    onLotChange(lotNumber, lotData);
  };

  const selectedLotData = lots.find(l => l.lot_number === selectedLot);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Quality Selection */}
      <div>
        <Label htmlFor="quality">{String(t('autocomplete.qualityLabel'))} *</Label>
        <Autocomplete
          value={quality}
          onValueChange={onQualityChange}
          placeholder={qualitiesLoading ? String(t('autocomplete.loadingQualities')) : String(t('autocomplete.typeToSearch'))}
          items={qualities}
          emptyText={qualitiesLoading ? String(t('autocomplete.loadingQualities')) : String(t('autocomplete.noQualities'))}
          minCharsToShow={0}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {qualitiesLoading ? String(t('loading')) : String(t('autocomplete.qualitiesAvailable', { count: qualities.length }))}
        </p>
      </div>

      {/* Color Selection */}
      {quality && (
        <div>
          <Label htmlFor="color">{String(t('autocomplete.colorLabel'))} *</Label>
          <Autocomplete
            value={color}
            onValueChange={onColorChange}
            placeholder={loading ? String(t('autocomplete.loadingColors')) : String(t('autocomplete.typeToSearch'))}
            items={colors}
            emptyText={loading ? String(t('loading')) : String(t('autocomplete.noColors'))}
            minCharsToShow={0}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {colors.length > 0 ? `${String(t('available'))}: ${colors.slice(0, 3).join(', ')}${colors.length > 3 ? ', ...' : ''}` : String(t('autocomplete.selectQualityFirst'))}
          </p>
        </div>
      )}

      {/* Lot Selection */}
      {quality && color && (
        <div>
          <Label htmlFor="lot">{String(t('autocomplete.lotsLabel'))} *</Label>
          <Autocomplete
            value={selectedLot}
            onValueChange={(value) => {
              if (value.includes('(')) {
                handleLotSelect(value);
              } else {
                onLotChange(value);
              }
            }}
            placeholder={loading ? String(t('autocomplete.loadingLots')) : String(t('lotNumber'))}
            items={lotItems}
            emptyText={loading ? String(t('loading')) : String(t('autocomplete.noLots'))}
            minCharsToShow={2}
          />
          {selectedLotData && (
            <div className="mt-2 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4" />
                <span className="font-medium">{selectedLotData.lot_number}</span>
                <Badge variant="outline">
                  <Calendar className="w-3 h-3 mr-1" />
                  {selectedLotData.age_days} {t('days')}
                </Badge>
                <Badge variant="secondary">
                  {selectedLotData.meters}m
                </Badge>
                <Badge variant="secondary">
                  {selectedLotData.roll_count} {t('rollsLabel')}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  {t('entryDate')}: {new Date(selectedLotData.entry_date).toLocaleDateString()}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRollDetailsOpen(true)}
                  className="flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  {t('seeRolls')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roll Details Dialog */}
      <RollDetailsDialog
        isOpen={rollDetailsOpen}
        onClose={() => setRollDetailsOpen(false)}
        quality={quality}
        color={color}
        lotNumber={selectedLot}
      />
    </div>
  );
}
