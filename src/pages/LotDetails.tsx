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
import { RollSelectionDialog } from '@/components/RollSelectionDialog';
import { ArrowLeft, Plus, Package, Calendar, Filter } from 'lucide-react';
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

const LotDetails = () => {
  const { quality, color } = useParams<{ quality: string; color: string }>();
  const location = useLocation();
  const [lots, setLots] = useState<LotDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState<LotDetail | null>(null);
  const [isRollDialogOpen, setIsRollDialogOpen] = useState(false);
  const [lotNumberFilter, setLotNumberFilter] = useState('');
  const [entryDateFilter, setEntryDateFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { addToCart } = usePOCart();
  const { toast } = useToast();
  
  // Check if we're in sample mode
  const searchParams = new URLSearchParams(location.search);
  const isSampleMode = searchParams.get('mode') === 'sample';

  useEffect(() => {
    if (quality && color) {
      fetchLotDetails();
    }
  }, [quality, color]);

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
    if (!quality || !color) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
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
          rolls(meters, position)
        `)
        .eq('quality', decodeURIComponent(quality))
        .eq('color', decodeURIComponent(color))
        .eq('status', 'in_stock')
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Calculate age and roll breakdown for each lot
      const lotsWithAge = data.map(lot => ({
        ...lot,
        age_days: Math.floor((new Date().getTime() - new Date(lot.entry_date).getTime()) / (1000 * 3600 * 24)),
        roll_breakdown: formatRollBreakdown(lot.rolls || [])
      }));

      setLots(lotsWithAge);

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
            <BreadcrumbPage>{decodeURIComponent(quality || '')} - {decodeURIComponent(color || '')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate(isSampleMode ? '/inventory?mode=sample' : '/inventory')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToInventory')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {decodeURIComponent(quality || '')} - {decodeURIComponent(color || '')}
            </h1>
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
        <CardContent>
          {filteredLots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noLotsAvailable')}
            </div>
          ) : (
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
                {filteredLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium">{lot.lot_number}</TableCell>
                    <TableCell className="text-right">{lot.meters.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{lot.roll_count}</TableCell>
                     <TableCell className="text-sm">
                       {lot.roll_breakdown || '-'}
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Roll Selection Dialog */}
      {selectedLot && (
        <RollSelectionDialog
          isOpen={isRollDialogOpen}
          onClose={() => {
            setIsRollDialogOpen(false);
            setSelectedLot(null);
          }}
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