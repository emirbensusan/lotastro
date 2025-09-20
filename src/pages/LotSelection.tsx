import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast, toast } from "@/hooks/use-toast";
import { ArrowLeft, Package, Filter, ShoppingCart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import { format } from 'date-fns';
import { RollSelectionDialog } from '@/components/RollSelectionDialog';

interface Lot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  status: string;
  entry_date: string;
  supplier_id: string;
  suppliers?: {
    name: string;
  };
}

interface SelectedLot {
  lotId: string;
  quality: string;
  color: string;
  lotNumber: string;
  meters: number;
  availableRolls: number;
  selectedRollIds: string[];
  selectedRollsData: Array<{ id: string; meters: number; position: number }>;
  lineType: 'sample' | 'standard';
}

const LotSelection = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { addToCart, setIsCartOpen } = usePOCart();
  
  const quality = searchParams.get('quality') || '';
  const color = searchParams.get('color') || '';
  const colors = searchParams.get('colors'); // For multi-color selection
  
  // State declarations - must come first before functions that reference them
  const [lots, setLots] = useState<Lot[]>([]);
  const [filteredLots, setFilteredLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  
  // Filters
  const [dateFilter, setDateFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  
  // Roll selection dialog state
  const [rollSelectionDialogLotId, setRollSelectionDialogLotId] = useState<string | null>(null);
  
  // Parse colors that may be in format "quality|color" or just "color"
  const parseColorEntry = (colorEntry: string) => {
    console.log('Parsing color entry:', colorEntry);
    if (colorEntry.includes('|')) {
      const [entryQuality, entryColor] = colorEntry.split('|').map(s => decodeURIComponent(s.trim()));
      console.log('Parsed quality|color:', { entryQuality, entryColor });
      return { quality: entryQuality, color: entryColor };
    }
    const parsed = { quality, color: decodeURIComponent(colorEntry.trim()) };
    console.log('Parsed as color only:', parsed);
    return parsed;
  };
  
  const colorArray = colors ? colors.split(',').map(parseColorEntry).filter(entry => entry.quality && entry.color) : 
                     (color && quality) ? [{ quality, color }] : [];
  
  console.log('Final colorArray:', colorArray);
  
  // For bulk selection, use the quality of the current color entry being processed
  // For single color selection, use the quality parameter
  const getCurrentQuality = () => {
    if (colorArray.length > 0) {
      return colorArray[currentColorIndex]?.quality || colorArray[0]?.quality;
    }
    return quality;
  };
  
  // For bulk selection (colors parameter), allow mixed qualities
  // For single color selection (quality + color parameters), quality must be consistent
  const isBulkSelection = !!colors;
  const hasConsistentQuality = isBulkSelection ? true : colorArray.every(entry => entry.quality === getCurrentQuality());
  
  console.log('Quality validation:', { currentQuality: getCurrentQuality(), hasConsistentQuality, colorCount: colorArray.length });

  useEffect(() => {
    console.log('LotSelection useEffect - Debug info:', {
      currentQuality: getCurrentQuality(),
      colorArray,
      colors: searchParams.get('colors'),
      hasConsistentQuality,
      colorArrayLength: colorArray.length
    });

    if (!getCurrentQuality() || colorArray.length === 0) {
      console.log('Redirecting to inventory - missing quality or colors');
      navigate('/inventory');
      return;
    }
    
    if (!hasConsistentQuality) {
      console.log('Redirecting to inventory - inconsistent quality');
      toast({
        title: "Quality Mismatch",
        description: "All selected colors must have the same quality",
        variant: "destructive",
      });
      navigate('/inventory');
      return;
    }
    
    console.log('All validations passed, fetching lots and suppliers');
    fetchLots();
    fetchSuppliers();
  }, [getCurrentQuality(), currentColorIndex]);

  useEffect(() => {
    applyFilters();
  }, [lots, dateFilter, supplierFilter, searchTerm]);

  const fetchLots = async () => {
    try {
      const currentColorEntry = colorArray[currentColorIndex];
      const { data, error } = await supabase
        .from('lots')
        .select(`
          *,
          suppliers (
            name
          )
        `)
        .eq('status', 'in_stock')
        .eq('quality', currentColorEntry.quality)
        .eq('color', currentColorEntry.color)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setLots(data || []);
    } catch (error) {
      console.error('Error fetching lots:', error);
      toast({
        title: t('error') as string,
        description: "Failed to load lots",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...lots];

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setDate(now.getDate());
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(lot => new Date(lot.entry_date) >= filterDate);
    }

    // Supplier filter
    if (supplierFilter !== 'all') {
      filtered = filtered.filter(lot => lot.supplier_id === supplierFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lot => 
        lot.lot_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLots(filtered);
  };

  const handleRollSelectionComplete = () => {
    // Move to next color if available
    if (currentColorIndex < colorArray.length - 1) {
      setCurrentColorIndex(currentColorIndex + 1);
      setLoading(true);
    } else {
      // All colors processed, show cart
      setIsCartOpen(true);
    }
  };

  const goBackToColors = () => {
    const normalizedQuality = encodeURIComponent(getCurrentQuality());
    navigate(`/inventory/${normalizedQuality}`);
  };

  const continueShopping = () => {
    navigate('/inventory');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={goBackToColors}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToColorSelection')}
          </Button>
          <h1 className="text-3xl font-bold">{t('selectLots')}</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={goBackToColors}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToColorSelection')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('selectLots')}</h1>
            <p className="text-muted-foreground">
              {t('quality')}: <span className="font-medium">{getCurrentQuality()}</span> | {t('color')}: <span className="font-medium">{colorArray[currentColorIndex].color}</span>
              {colorArray.length > 1 && (
                <span className="ml-2">({currentColorIndex + 1} of {colorArray.length})</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Package className="h-8 w-8 text-primary" />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            {t('filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t('search')}</Label>
              <Input
                placeholder={t('searchLots') as string}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('dateRange')}</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allDates')}</SelectItem>
                  <SelectItem value="today">{t('today')}</SelectItem>
                  <SelectItem value="week">{t('lastWeek')}</SelectItem>
                  <SelectItem value="month">{t('lastMonth')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('supplier')}</Label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allSuppliers')}</SelectItem>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setDateFilter('all');
                  setSupplierFilter('all');
                  setSearchTerm('');
                }}
              >
                {t('clearFilters')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lots Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('availableLots')} ({filteredLots.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('select')}</TableHead>
                <TableHead>{t('lotNumber')}</TableHead>
                <TableHead>{t('supplier')}</TableHead>
                <TableHead>{t('meters')}</TableHead>
                <TableHead>{t('rollCount')}</TableHead>
                <TableHead>{t('entryDate')}</TableHead>
                <TableHead>{t('selectRolls')}</TableHead>
                <TableHead>{t('type')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLots.map((lot) => {
                return (
                  <TableRow key={lot.id}>
                    <TableCell>
                      -
                    </TableCell>
                    <TableCell className="font-mono">{lot.lot_number}</TableCell>
                    <TableCell>{lot.suppliers?.name || 'Unknown'}</TableCell>
                    <TableCell>{lot.meters.toFixed(2)} m</TableCell>
                    <TableCell>{lot.roll_count}</TableCell>
                    <TableCell>{format(new Date(lot.entry_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRollSelectionDialogLotId(lot.id);
                        }}
                      >
                        {t('selectRolls')}
                      </Button>
                    </TableCell>
                    <TableCell>
                      -
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredLots.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {t('noLotsAvailable')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roll Selection Dialog */}
      {rollSelectionDialogLotId && (() => {
        const lot = lots.find(l => l.id === rollSelectionDialogLotId);
        if (!lot) return null;
        
        return (
          <RollSelectionDialog
            isOpen={true}
            onClose={() => {
              setRollSelectionDialogLotId(null);
              handleRollSelectionComplete();
            }}
            lotId={lot.id}
            lotNumber={lot.lot_number}
            quality={lot.quality}
            color={colorArray[currentColorIndex].color}
            totalMeters={lot.meters}
            totalRolls={lot.roll_count}
            entryDate={lot.entry_date}
            supplierName={lot.suppliers?.name}
          />
        );
      })()}
    </div>
  );
};

export default LotSelection;