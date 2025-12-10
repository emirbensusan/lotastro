import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast, toast } from "@/hooks/use-toast";
import { ArrowLeft, Package, Filter, ShoppingCart, CheckCircle, ChevronRight } from 'lucide-react';
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { addToCart, setIsCartOpen } = usePOCart();
  
  const quality = searchParams.get('quality') || '';
  const color = searchParams.get('color') || '';
  const colors = searchParams.get('colors'); // For multi-color selection
  
  // Get order mode from URL
  const orderMode = searchParams.get('mode'); // 'multi', 'multi-sample', 'sample', or null
  const isMultiMode = orderMode === 'multi' || orderMode === 'multi-sample';
  const isSampleMode = orderMode === 'sample' || orderMode === 'multi-sample';
  
  // Get pending qualities for sequential multi-quality flow
  const pendingQualitiesParam = searchParams.get('pendingQualities');
  const pendingQualities = pendingQualitiesParam ? pendingQualitiesParam.split(',').map(q => decodeURIComponent(q)) : [];
  
  // State declarations - must come first before functions that reference them
  const [lots, setLots] = useState<Lot[]>([]);
  const [filteredLots, setFilteredLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  
  // Track requested quantities from AI draft
  const [requestedItems, setRequestedItems] = useState<Array<{
    quality: string;
    color: string;
    meters: number;
  }>>([]);
  
  // Track selected meters per quality+color
  const [selectedMeters, setSelectedMeters] = useState<Map<string, number>>(new Map());
  
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

  // Parse requested items from location state
  useEffect(() => {
    const state = location.state as any;
    if (state?.fromAIDraft && state?.requestedItems) {
      setRequestedItems(state.requestedItems);
      
      // Initialize selectedMeters map
      const metersMap = new Map<string, number>();
      state.requestedItems.forEach((item: any) => {
        const key = `${item.quality}|${item.color}`;
        metersMap.set(key, 0);
      });
      setSelectedMeters(metersMap);
    }
  }, [location.state]);

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

  const handleRollSelectionComplete = (addedMeters?: number, quality?: string, color?: string) => {
    // Update selectedMeters if meters were added
    if (addedMeters && quality && color) {
      const key = `${quality}|${color}`;
      setSelectedMeters(prev => {
        const updated = new Map(prev);
        const current = updated.get(key) || 0;
        updated.set(key, current + addedMeters);
        return updated;
      });
    }

    // Move to next color if available
    if (currentColorIndex < colorArray.length - 1) {
      setCurrentColorIndex(currentColorIndex + 1);
      setLoading(true);
    } else if (isMultiMode && pendingQualities.length > 0) {
      // Navigate to next quality in the sequence
      const nextQuality = pendingQualities[0];
      const remainingQualities = pendingQualities.slice(1);
      const modeParam = orderMode ? `?mode=${orderMode}` : '?';
      const pendingParam = remainingQualities.length > 0 ? `&pendingQualities=${encodeURIComponent(remainingQualities.join(','))}` : '';
      
      toast({
        title: String(t('movingToNextQuality')),
        description: `${t('nextQuality')}: ${nextQuality}`,
      });
      
      navigate(`/inventory/${encodeURIComponent(nextQuality)}${modeParam}${pendingParam}`);
    } else if (isMultiMode) {
      // All qualities processed - open cart
      setIsCartOpen(true);
    } else {
      // Single mode - show cart
      setIsCartOpen(true);
    }
  };

  // Check if can proceed to checkout
  const canProceedToCheckout = useMemo(() => {
    if (requestedItems.length === 0) return true; // No restrictions if not from AI draft
    
    return requestedItems.every(item => {
      const key = `${item.quality}|${item.color}`;
      const selected = selectedMeters.get(key) || 0;
      return selected >= item.meters;
    });
  }, [requestedItems, selectedMeters]);

  const goBackToColors = () => {
    const normalizedQuality = encodeURIComponent(getCurrentQuality());
    const modeParam = orderMode ? `?mode=${orderMode}` : '';
    navigate(`/inventory/${normalizedQuality}${modeParam}`);
  };

  const continueShopping = () => {
    const modeParam = orderMode ? `?mode=${orderMode}` : '';
    navigate(`/inventory${modeParam}`);
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
      {/* Requested Quantities Tracker */}
      {requestedItems.length > 0 && (
        <Card className="sticky top-0 z-10 bg-background shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('aiOrder.requestedQuantities')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {requestedItems.map((item) => {
                const key = `${item.quality}|${item.color}`;
                const selected = selectedMeters.get(key) || 0;
                const remaining = Math.max(0, item.meters - selected);
                const isFulfilled = selected >= item.meters;
                
                return (
                  <div key={key} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div className="font-medium">
                      <Badge variant="outline" className="mr-2">{item.quality}</Badge>
                      <span>{item.color}</span>
                    </div>
                    <div className="flex gap-6 items-center text-sm">
                      <span>{t('aiOrder.requested')}: <strong>{item.meters} m</strong></span>
                      <span>{t('aiOrder.selected')}: <strong className={selected > 0 ? 'text-blue-600' : ''}>{selected} m</strong></span>
                      <span className={isFulfilled ? 'text-green-600' : 'text-orange-600'}>
                        {t('aiOrder.remaining')}: <strong>{remaining} m</strong>
                      </span>
                      {isFulfilled && <CheckCircle className="h-5 w-5 text-green-600" />}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Progress summary */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {requestedItems.filter(item => {
                    const key = `${item.quality}|${item.color}`;
                    return (selectedMeters.get(key) || 0) >= item.meters;
                  }).length} / {requestedItems.length} {t('aiOrder.itemsFulfilled')}
                </span>
                {canProceedToCheckout && (
                  <Badge variant="default" className="bg-green-600">
                    {t('aiOrder.allQuantitiesFulfilled')}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Navigation Controls */}
      {isMultiMode && (
        <Card className="border-2 border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Progress Info */}
              <div className="flex items-center gap-4 flex-wrap">
                <Badge className="bg-purple-500 text-white">
                  {t('processingQuality')}: {getCurrentQuality()}
                </Badge>
                <span className="text-sm">
                  {t('colorProgress')} {currentColorIndex + 1}/{colorArray.length}: 
                  <span className="font-medium ml-1">{colorArray[currentColorIndex]?.color}</span>
                </span>
                {pendingQualities.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    | {t('nextQuality')}: <span className="font-medium">{pendingQualities[0]}</span>
                    {pendingQualities.length > 1 && (
                      <span className="ml-1">(+{pendingQualities.length - 1} {t('more')})</span>
                    )}
                  </span>
                )}
              </div>
              
              {/* Navigation Buttons */}
              <div className="flex gap-2">
                {currentColorIndex < colorArray.length - 1 && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleRollSelectionComplete()}
                  >
                    {t('skipToNextColor')}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {currentColorIndex >= colorArray.length - 1 && pendingQualities.length > 0 && (
                  <Button 
                    variant="default" 
                    onClick={() => handleRollSelectionComplete()}
                  >
                    {t('continueToNextQuality')} ({pendingQualities[0]})
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {currentColorIndex >= colorArray.length - 1 && pendingQualities.length === 0 && (
                  <Button 
                    variant="default" 
                    onClick={() => setIsCartOpen(true)}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {t('viewCartButton')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roll Selection Dialog */}
      {rollSelectionDialogLotId && (() => {
        const lot = lots.find(l => l.id === rollSelectionDialogLotId);
        if (!lot) return null;
        
        return (
          <RollSelectionDialog
            isOpen={true}
            onClose={(addedMeters?: number) => {
              setRollSelectionDialogLotId(null);
              handleRollSelectionComplete(addedMeters, lot.quality, colorArray[currentColorIndex].color);
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