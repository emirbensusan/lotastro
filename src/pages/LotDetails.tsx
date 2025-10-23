import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useViewAsRole } from '@/contexts/ViewAsRoleContext';
import { InlineEditableField } from '@/components/InlineEditableField';
import { RollSelectionDialog } from '@/components/RollSelectionDialog';
import { ArrowLeft, Plus, Package, Calendar, Filter, CheckCircle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

interface LotDetail {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  entry_date: string;
  invoice_number?: string;
  invoice_date?: string;
  suppliers?: { name: string };
  age_days: number;
  rolls?: { meters: number; position: number }[];
  roll_breakdown?: string;
}

interface QualityVariant {
  original_quality: string;
  count: number;
}

const LotDetails = () => {
  const { quality: normalizedQuality, color } = useParams<{ quality: string; color: string }>();
  const location = useLocation();
  const [lots, setLots] = useState<LotDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState<LotDetail | null>(null);
  const [isRollDialogOpen, setIsRollDialogOpen] = useState(false);
  const [lotNumberFilter, setLotNumberFilter] = useState('');
  const [entryDateFilter, setEntryDateFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [qualityVariants, setQualityVariants] = useState<QualityVariant[]>([]);
  
  // AI Draft tracking
  const [requestedItems, setRequestedItems] = useState<Array<{quality: string; color: string; meters: number}>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedMeters, setSelectedMeters] = useState(0);
  
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { addToCart } = usePOCart();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { viewAsRole } = useViewAsRole();
  
  // Get the effective role (viewAsRole takes precedence)
  const getEffectiveRole = () => viewAsRole || profile?.role;
  
  // Check if we're in sample mode
  const searchParams = new URLSearchParams(location.search);
  const isSampleMode = searchParams.get('mode') === 'sample';

  useEffect(() => {
    if (normalizedQuality && color) {
      fetchLotDetails();
    }
  }, [normalizedQuality, color]);
  
  // Parse AI draft state
  useEffect(() => {
    const state = location.state as any;
    if (state?.fromAIDraft && state?.requestedItems) {
      setRequestedItems(state.requestedItems);
      setCurrentIndex(state.currentIndex || 0);
      setSelectedMeters(0); // Reset for new item
    }
  }, [location.state]);

  const formatRollBreakdown = (rolls: { meters: number; position: number }[]): string => {
    if (!rolls || rolls.length === 0) return '';
    
    // Sort rolls by position
    const sortedRolls = rolls.sort((a, b) => a.position - b.position);
    
    // Count occurrences of each meter value
    const meterCounts: { [key: number]: number } = {};
    sortedRolls.forEach(roll => {
      meterCounts[roll.meters] = (meterCounts[roll.meters] || 0) + 1;
    });
    
    // Separate grouped and individual meters while maintaining order
    const parts: string[] = [];
    const processedMeters = new Set<number>();
    
    // First pass: collect grouped meters (count > 1)
    const groupedParts: string[] = [];
    sortedRolls.forEach(roll => {
      if (!processedMeters.has(roll.meters) && meterCounts[roll.meters] > 1) {
        groupedParts.push(`${meterCounts[roll.meters]}x${roll.meters}`);
        processedMeters.add(roll.meters);
      }
    });
    
    // Add grouped parts
    if (groupedParts.length > 0) {
      parts.push(`(${groupedParts.join(')-(')}`);
    }
    
    // Second pass: collect individual meters (count = 1) in order
    const individualMeters: number[] = [];
    sortedRolls.forEach(roll => {
      if (meterCounts[roll.meters] === 1) {
        individualMeters.push(roll.meters);
      }
    });
    
    // Add individual meters
    if (individualMeters.length > 0) {
      parts.push(individualMeters.join('-'));
    }
    
    return parts.join('-');
  };

  const fetchLotDetails = async () => {
    if (!normalizedQuality || !color) return;

    try {
      setLoading(true);
      
      // Get all lots from the database
      const { data: allLots, error } = await supabase
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
          suppliers(name),
          rolls!inner(meters, position)
        `)
        .eq('color', decodeURIComponent(color))
        .eq('status', 'in_stock')
        .eq('rolls.status', 'available')
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Filter lots that normalize to our target quality and have the specified color
      const matchingLots: LotDetail[] = [];
      const qualityVariantMap = new Map<string, number>();

      for (const lot of allLots) {
        const { data: normalized, error: normalizeError } = await supabase
          .rpc('normalize_quality', { quality_input: lot.quality });

        if (normalizeError) {
          console.error('Error normalizing quality:', normalizeError);
          continue;
        }

        if (normalized === decodeURIComponent(normalizedQuality)) {
          // Calculate age and roll breakdown for this lot
          const lotWithProcessedData = {
            ...lot,
            age_days: Math.floor((new Date().getTime() - new Date(lot.entry_date).getTime()) / (1000 * 3600 * 24)),
            roll_breakdown: formatRollBreakdown(lot.rolls || [])
          };
          
          matchingLots.push(lotWithProcessedData);
          
          // Track quality variants
          const count = qualityVariantMap.get(lot.quality) || 0;
          qualityVariantMap.set(lot.quality, count + 1);
        }
      }

      // Convert quality variants to array
      const variants = Array.from(qualityVariantMap.entries()).map(([quality, count]) => ({
        original_quality: quality,
        count
      }));
      setQualityVariants(variants);

      setLots(matchingLots);

    } catch (error) {
      console.error('Error fetching lot details:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to load lot details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRolls = (lot: LotDetail) => {
    setSelectedLot(lot);
    setIsRollDialogOpen(true);
  };
  
  const handleRollSelectionComplete = (addedMeters?: number) => {
    if (addedMeters && requestedItems.length > 0) {
      setSelectedMeters(prev => prev + addedMeters);
    }
    setIsRollDialogOpen(false);
    setSelectedLot(null);
  };
  
  const handleNextItem = () => {
    if (currentIndex < requestedItems.length - 1) {
      const nextItem = requestedItems[currentIndex + 1];
      navigate(`/inventory/${encodeURIComponent(nextItem.quality)}/${encodeURIComponent(nextItem.color)}`, {
        state: {
          fromAIDraft: true,
          requestedItems,
          currentIndex: currentIndex + 1
        }
      });
    } else {
      // All items completed
      toast({
        title: t('aiOrder.allItemsFulfilled') as string,
        variant: 'default'
      });
      navigate('/orders');
    }
  };
  
  const currentItem = requestedItems[currentIndex];
  const canProceed = !currentItem || selectedMeters >= currentItem.meters;

  const handleAddAllToCart = () => {
    // For "Add All", we'll open dialog for first lot as example
    // In practice, you might want different UX for bulk operations
    if (lots.length > 0) {
      setSelectedLot(lots[0]);
      setIsRollDialogOpen(true);
    }
  };

  // Filter lots based on all active filters
  const filteredLots = lots.filter(lot => {
    const matchesLotNumber = lot.lot_number.toLowerCase().includes(lotNumberFilter.toLowerCase());
    const matchesEntryDate = new Date(lot.entry_date).toLocaleDateString('en-GB').toLowerCase().includes(entryDateFilter.toLowerCase());
    const matchesAge = lot.age_days.toString().includes(ageFilter);
    
    return matchesLotNumber && matchesEntryDate && matchesAge;
  });

  const handleLotNumberUpdate = async (lotId: string, oldLotNumber: string, newLotNumber: string) => {
    if (oldLotNumber === newLotNumber) return;

    try {
      const effectiveRole = getEffectiveRole();
      
      // Senior managers and admins can apply changes directly
      if (effectiveRole === 'senior_manager' || effectiveRole === 'admin') {
        const { error } = await supabase
          .from('lots')
          .update({ lot_number: newLotNumber })
          .eq('id', lotId);

        if (error) throw error;

        // Refresh the data
        await fetchLotDetails();
        
        toast({
          title: 'Lot Number Updated',
          description: `Updated lot number from "${oldLotNumber}" to "${newLotNumber}"`,
        });
      } else {
        // Other users submit to approval queue
        const { error } = await supabase
          .from('field_edit_queue')
          .insert({
            table_name: 'lots',
            record_id: lotId,
            field_name: 'lot_number',
            old_value: oldLotNumber,
            new_value: newLotNumber,
            submitted_by: profile?.user_id
          });

        if (error) throw error;

        toast({
          title: 'Change Submitted',
          description: `Lot number change from "${oldLotNumber}" to "${newLotNumber}" submitted for approval`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to update lot number: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleRollBreakdownUpdate = async (lotId: string, newBreakdown: string) => {
    try {
      const effectiveRole = getEffectiveRole();
      
      // Get current roll breakdown for comparison
      const currentLot = lots.find(lot => lot.id === lotId);
      const oldRollBreakdown = currentLot?.roll_breakdown || '';
      
      // Senior managers and admins can apply changes directly
      if (effectiveRole === 'senior_manager' || effectiveRole === 'admin') {
        // Note: Roll breakdown is a calculated field, so we'd need to update individual rolls
        // For now, this is a placeholder - in a real implementation, you'd need to parse
        // the breakdown and update the individual roll records
        toast({
          title: 'Info',
          description: 'Roll breakdown editing requires individual roll updates',
          variant: 'default',
        });
      } else {
        // Other users submit to approval queue
        const { error } = await supabase
          .from('field_edit_queue')
          .insert({
            table_name: 'lots',
            record_id: lotId,
            field_name: 'roll_breakdown',
            old_value: oldRollBreakdown,
            new_value: newBreakdown,
            submitted_by: profile?.user_id
          });

        if (error) throw error;

        toast({
          title: 'Change Submitted',
          description: 'Roll breakdown change submitted for approval'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to submit roll breakdown change: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Package className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate(isSampleMode ? '/inventory?mode=sample' : '/inventory')} className="cursor-pointer">
              {t('inventory')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {decodeURIComponent(normalizedQuality || '')} - {decodeURIComponent(color || '')}
              {qualityVariants.length > 1 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Includes: {qualityVariants.map(v => v.original_quality).join(', ')}
                </div>
              )}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* AI Draft Requested Quantities Tracker */}
      {currentItem && (
        <Card className="sticky top-0 z-10 bg-background shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <span>{t('aiOrder.requestedQuantity')}: {currentItem.meters}m</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-normal">
                <span className="text-blue-600">{t('aiOrder.selected')}: {selectedMeters}m</span>
                <span className={canProceed ? "text-green-600" : "text-orange-600"}>
                  {t('aiOrder.remaining')}: {Math.max(0, currentItem.meters - selectedMeters)}m
                </span>
                {canProceed && <CheckCircle className="h-5 w-5 text-green-600" />}
              </div>
            </CardTitle>
          </CardHeader>
          {requestedItems.length > 1 && (
            <CardContent className="pt-0">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('aiOrder.itemProgress')}: {currentIndex + 1} / {requestedItems.length}
                </span>
                {canProceed && currentIndex < requestedItems.length - 1 && (
                  <Button size="sm" onClick={handleNextItem}>
                    {t('aiOrder.nextItem')} ({requestedItems[currentIndex + 1].quality} {requestedItems[currentIndex + 1].color})
                  </Button>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate(isSampleMode ? `/inventory/${normalizedQuality}?mode=sample` : `/inventory/${normalizedQuality}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToColorSelection')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {decodeURIComponent(normalizedQuality || '')} - {decodeURIComponent(color || '')}
            </h1>
            {qualityVariants.length > 1 && (
              <p className="text-sm text-muted-foreground mb-1">
                Showing lots from: {qualityVariants.map(v => `${v.original_quality} (${v.count} lots)`).join(', ')}
              </p>
            )}
            <p className="text-muted-foreground">
              {lotNumberFilter || entryDateFilter || ageFilter ? 
                `${filteredLots.length} of ${lots.length} ${t('availableLots')}` : 
                `${lots.length} ${t('availableLots')}`
              } • {filteredLots.reduce((sum, lot) => sum + lot.roll_count, 0)} {t('rolls')} • {filteredLots.reduce((sum, lot) => sum + lot.meters, 0).toLocaleString()} {t('meters')}
            </p>
          </div>
        </div>
        
        {lots.length > 0 && (
          <Button onClick={handleAddAllToCart} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('addAllToCart')}
          </Button>
        )}
      </div>

      {/* Lots Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('availableLots')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[calc(100vh-300px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      {t('lotNumber')}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="p-1 hover:bg-muted rounded">
                            <Filter className={`h-3 w-3 ${lotNumberFilter ? 'text-primary' : 'text-muted-foreground'}`} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64" align="start">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Filter by lot number</div>
                          <Textarea
                            value={lotNumberFilter}
                            onChange={(e) => setLotNumberFilter(e.target.value)}
                            placeholder="Enter lot number..."
                            className="min-h-[60px]"
                          />
                          {lotNumberFilter && (
                            <div className="flex justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setLotNumberFilter('')}>
                                Clear
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead>{t('quality')}</TableHead>
                <TableHead className="text-right">{t('meters')}</TableHead>
                <TableHead className="text-right">{t('rolls')}</TableHead>
                <TableHead>{t('rollMeters')}</TableHead>
                <TableHead>
                  <div className="flex items-center gap-2">
                    {t('entryDate')}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="p-1 hover:bg-muted rounded">
                          <Filter className={`h-3 w-3 ${entryDateFilter ? 'text-primary' : 'text-muted-foreground'}`} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64" align="start">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Filter by entry date</div>
                          <Textarea
                            value={entryDateFilter}
                            onChange={(e) => setEntryDateFilter(e.target.value)}
                            placeholder="Enter date (DD/MM/YYYY)..."
                            className="min-h-[60px]"
                          />
                          {entryDateFilter && (
                            <div className="flex justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setEntryDateFilter('')}>
                                Clear
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-2">
                    {t('age')}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="p-1 hover:bg-muted rounded">
                          <Filter className={`h-3 w-3 ${ageFilter ? 'text-primary' : 'text-muted-foreground'}`} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64" align="start">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Filter by age (days)</div>
                          <Textarea
                            value={ageFilter}
                            onChange={(e) => setAgeFilter(e.target.value)}
                            placeholder="Enter age in days..."
                            className="min-h-[60px]"
                          />
                          {ageFilter && (
                            <div className="flex justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setAgeFilter('')}>
                                Clear
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="text-right">{t('actionAdd')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {t('noLotsAvailable')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium">
                      {getEffectiveRole() !== 'warehouse_staff' ? (
                        <InlineEditableField
                          value={lot.lot_number}
                          onSave={(newValue) => handleLotNumberUpdate(lot.id, lot.lot_number, String(newValue))}
                          placeholder="Enter lot number"
                        />
                      ) : (
                        lot.lot_number
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.quality}
                    </TableCell>
                    <TableCell className="text-right">{lot.meters.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{lot.roll_count}</TableCell>
                     <TableCell className="text-sm">
                       {getEffectiveRole() !== 'warehouse_staff' ? (
                         <InlineEditableField
                           value={lot.roll_breakdown || '-'}
                           onSave={(newValue) => handleRollBreakdownUpdate(lot.id, String(newValue))}
                           placeholder="Enter roll breakdown"
                         />
                       ) : (
                         lot.roll_breakdown || '-'
                       )}
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center space-x-2">
                         <Calendar className="h-4 w-4 text-muted-foreground" />
                         <span>{new Date(lot.entry_date).toLocaleDateString('en-GB')}</span>
                       </div>
                     </TableCell>
                    <TableCell>
                      <Badge variant={lot.age_days > 30 ? "destructive" : lot.age_days > 14 ? "secondary" : "default"}>
                        {lot.age_days} {t('days')}
                      </Badge>
                    </TableCell>
                     <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSelectRolls(lot)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {t('selectRolls')}
                        </Button>
                     </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Roll Selection Dialog */}
      {selectedLot && (
        <RollSelectionDialog
          isOpen={isRollDialogOpen}
          onClose={handleRollSelectionComplete}
          lotId={selectedLot.id}
          lotNumber={selectedLot.lot_number}
          quality={selectedLot.quality}
          color={selectedLot.color}
          totalMeters={selectedLot.meters}
          totalRolls={selectedLot.roll_count}
          entryDate={selectedLot.entry_date}
          supplierName={selectedLot.suppliers?.name}
          invoiceNumber={selectedLot.invoice_number}
          invoiceDate={selectedLot.invoice_date}
          ageDays={selectedLot.age_days}
          sampleMode={isSampleMode}
        />
      )}
    </div>
  );
};

export default LotDetails;