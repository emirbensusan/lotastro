import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import { ArrowLeft, Package, ShoppingCart, X, Filter, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useViewAsRole } from '@/contexts/ViewAsRoleContext';
import { InlineEditableField } from '@/components/InlineEditableField';

interface QualityColorData {
  originalQuality: string;
  color: string;
  totalMeters: number;
  totalRolls: number;
  lotCount: number;
}

interface QualityVariant {
  original_quality: string;
  count: number;
}

const QualityDetails = () => {
  const { quality: normalizedQuality } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { clearCart } = usePOCart();
  const { profile } = useAuth();
  const { viewAsRole } = useViewAsRole();
  
  // Get the effective role (viewAsRole takes precedence)
  const getEffectiveRole = () => viewAsRole || profile?.role;
  
  // Check if we're in sample mode
  const searchParams = new URLSearchParams(location.search);
  const isSampleMode = searchParams.get('mode') === 'sample';
  
  const [qualityColors, setQualityColors] = useState<QualityColorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [colorFilter, setColorFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityVariants, setQualityVariants] = useState<QualityVariant[]>([]);
  const [qualityTotals, setQualityTotals] = useState({
    total_meters: 0,
    total_rolls: 0,
    total_lots: 0
  });

  useEffect(() => {
    if (normalizedQuality) {
      fetchColorData();
    }
  }, [normalizedQuality]);

  const fetchColorData = async () => {
    try {
      setLoading(true);
      
      // Use the optimized RPC function to get lots filtered by normalized quality
      const { data: matchingLots, error } = await supabase
        .rpc('get_lots_by_normalized_quality', { 
          target_normalized_quality: normalizedQuality 
        });

      if (error) {
        console.error('Error fetching color data:', error);
        toast({
          title: String(t('error')),
          description: 'Failed to load color data',
          variant: 'destructive',
        });
        return;
      }

      // Track quality variants from the matching lots
      const qualityVariantMap = new Map<string, number>();
      matchingLots.forEach((lot: any) => {
        const count = qualityVariantMap.get(lot.quality) || 0;
        qualityVariantMap.set(lot.quality, count + 1);
      });

      const variants = Array.from(qualityVariantMap.entries()).map(([quality, count]) => ({
        original_quality: quality,
        count
      }));
      setQualityVariants(variants);

      processLotData(matchingLots);
    } catch (error) {
      console.error('Error fetching color data:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to load color data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const processLotData = (lots: Array<{quality: string, color: string, meters: number, roll_count: number}>) => {
    // Group by original quality + color combination
    const qualityColorMap = new Map<string, { meters: number; rolls: number; count: number }>();

    lots.forEach(lot => {
      const key = `${lot.quality}|${lot.color}`;
      if (!qualityColorMap.has(key)) {
        qualityColorMap.set(key, { meters: 0, rolls: 0, count: 0 });
      }
      
      const data = qualityColorMap.get(key)!;
      data.meters += Number(lot.meters);
      data.rolls += lot.roll_count;
      data.count += 1;
    });

    // Convert to array and sort by original quality, then by meters (descending)
    const qualityColorsArray = Array.from(qualityColorMap.entries()).map(([key, data]) => {
      const [originalQuality, color] = key.split('|');
      return {
        originalQuality,
        color,
        totalMeters: data.meters,
        totalRolls: data.rolls,
        lotCount: data.count,
      };
    }).sort((a, b) => {
      // First sort by original quality
      if (a.originalQuality !== b.originalQuality) {
        return a.originalQuality.localeCompare(b.originalQuality);
      }
      // Then by meters (descending)
      return b.totalMeters - a.totalMeters;
    });

    // Calculate totals
    const totals = {
      total_meters: qualityColorsArray.reduce((sum, item) => sum + item.totalMeters, 0),
      total_rolls: qualityColorsArray.reduce((sum, item) => sum + item.totalRolls, 0),
      total_lots: qualityColorsArray.reduce((sum, item) => sum + item.lotCount, 0),
    };

    setQualityColors(qualityColorsArray);
    setQualityTotals(totals);
  };

  const navigateToLotDetails = (color: string) => {
    if (isSampleMode) {
      navigate(`/inventory/${encodeURIComponent(normalizedQuality!)}/${encodeURIComponent(color)}?mode=sample`);
    } else {
      navigate(`/inventory/${encodeURIComponent(normalizedQuality!)}/${encodeURIComponent(color)}`);
    }
  };

  const navigateBack = () => {
    if (isSampleMode) {
      navigate('/inventory?mode=sample');
    } else {
      navigate('/inventory');
    }
  };

  const handleColorSelection = (color: string) => {
    const newSelection = new Set(selectedColors);
    if (newSelection.has(color)) {
      newSelection.delete(color);
    } else {
      newSelection.add(color);
    }
    setSelectedColors(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedColors.size === filteredColors.length) {
      setSelectedColors(new Set());
    } else {
      setSelectedColors(new Set(filteredColors.map(c => `${c.originalQuality}|${c.color}`)));
    }
  };

  const handleStartSelection = () => {
    setSelectionMode(true);
    setSelectedColors(new Set());
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedColors(new Set());
  };

  const handleProceedToLots = () => {
    if (selectedColors.size === 0) {
      toast({
        title: t('error') as string,
        description: 'Please select at least one color',
        variant: 'destructive',
      });
      return;
    }

    // Navigate to lot selection with multiple colors
    const colorParams = Array.from(selectedColors).join(',');
    navigate(`/lot-selection?quality=${encodeURIComponent(normalizedQuality!)}&colors=${encodeURIComponent(colorParams)}`);
  };

  const handleClearCart = () => {
    clearCart();
    toast({
      title: t('success') as string,
      description: 'Cart cleared successfully',
    });
  };

  const handleColorUpdate = async (oldColor: string, newColor: string) => {
    if (oldColor === newColor) return;

    try {
      const effectiveRole = getEffectiveRole();
      
      // Senior managers and admins can apply changes directly
      if (effectiveRole === 'senior_manager' || effectiveRole === 'admin') {
        // Get all lots that normalize to this quality and have this color
        const { data: allLots, error: fetchError } = await supabase
          .from('lots')
          .select('id, quality, color')
          .eq('color', oldColor)
          .eq('status', 'in_stock');

        if (fetchError) throw fetchError;

        // Filter lots that normalize to our target quality
        const lotsToUpdate: string[] = [];
        
        for (const lot of allLots) {
          const { data: normalized, error: normalizeError } = await supabase
            .rpc('normalize_quality', { quality_input: lot.quality });

          if (normalizeError) continue;

          if (normalized === normalizedQuality) {
            lotsToUpdate.push(lot.id);
          }
        }

        if (lotsToUpdate.length > 0) {
          const { error } = await supabase
            .from('lots')
            .update({ color: newColor })
            .in('id', lotsToUpdate);

          if (error) throw error;
        }

        // Refresh the data
        await fetchColorData();
        
        toast({
          title: 'Color Updated',
          description: `Updated color from "${oldColor}" to "${newColor}" for ${lotsToUpdate.length} lots`,
        });
      } else {
        // Other users submit to approval queue
        const { error } = await supabase
          .from('field_edit_queue')
          .insert({
            table_name: 'lots',
            record_id: null, // For color changes affecting multiple records with same quality/color
            field_name: 'color',
            old_value: oldColor,
            new_value: newColor,
            submitted_by: profile?.user_id
          });

        if (error) throw error;

        toast({
          title: 'Change Submitted',
          description: `Color change from "${oldColor}" to "${newColor}" submitted for approval`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to update color: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Filter entries based on search (searches both color names and original quality codes)
  const filteredColors = qualityColors.filter(item => {
    const colorMatch = item.color.toLowerCase().includes(searchTerm.toLowerCase());
    const qualityMatch = item.originalQuality.toLowerCase().includes(searchTerm.toLowerCase());
    const filterMatch = !colorFilter || item.color.toLowerCase().includes(colorFilter.toLowerCase());
    
    return (searchTerm === '' || colorMatch || qualityMatch) && filterMatch;
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
            <BreadcrumbLink onClick={navigateBack} className="cursor-pointer">
              {t('inventory')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {normalizedQuality}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-3xl font-bold">{normalizedQuality}</h1>
            <p className="text-muted-foreground">
              {searchTerm || colorFilter ? `${filteredColors.length} of ${qualityColors.length}` : qualityColors.length} {qualityColors.length === 1 ? 'entry' : 'entries'} • {qualityTotals.total_lots} {t('lots')} • {qualityTotals.total_meters.toLocaleString()} {t('meters')} • {qualityTotals.total_rolls.toLocaleString()} {t('rolls')}
            </p>
          </div>
          <Button variant="outline" onClick={navigateBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToInventory')}
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          {!selectionMode && (
            <>
              <Button variant="outline" onClick={handleStartSelection}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Birden Fazla Renk Seç
              </Button>
            </>
          )}
          {selectionMode && (
            <>
              <Button variant="outline" onClick={handleClearCart}>
                <X className="mr-2 h-4 w-4" />
                Clear Cart
              </Button>
              <Button variant="outline" onClick={handleCancelSelection}>
                <X className="mr-2 h-4 w-4" />
                Cancel Selection
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Selection Summary */}
      {selectionMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Color Selection ({selectedColors.size} selected)</span>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedColors.size === qualityColors.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button 
                  onClick={handleProceedToLots}
                  disabled={selectedColors.size === 0}
                >
                  Proceed to Lots ({selectedColors.size} colors)
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          {selectedColors.size > 0 && (
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Array.from(selectedColors).map(color => (
                  <Badge key={color} variant="default" className="cursor-pointer" onClick={() => handleColorSelection(color)}>
                    {color} ×
                  </Badge>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('lots')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualityTotals.total_lots}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('meters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualityTotals.total_meters.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('rolls')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualityTotals.total_rolls.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Colors Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('availableColors')}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search colors or quality codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {selectionMode && (
                  <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedColors.size > 0 && selectedColors.size === filteredColors.length}
                  onCheckedChange={handleSelectAll}
                />
                  </TableHead>
                )}
                <TableHead className="whitespace-nowrap">{t('quality')}</TableHead>
                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <span>{t('color')}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Filter className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Filter by color</p>
                          <Textarea
                            placeholder="Type to filter colors..."
                            value={colorFilter}
                            onChange={(e) => setColorFilter(e.target.value)}
                            className="min-h-[60px]"
                          />
                          {colorFilter && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setColorFilter('')}
                              className="w-full"
                            >
                              Clear filter
                            </Button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="text-right">{t('lotCount')}</TableHead>
                <TableHead className="text-right">{t('meters')}</TableHead>
                <TableHead className="text-right">{t('rollCount')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={selectionMode ? 6 : 5} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchTerm || colorFilter ? 'No colors found matching your search' : 'No colors available for this quality'}
                      </p>
                      {(searchTerm || colorFilter) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchTerm('');
                            setColorFilter('');
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredColors.map((item) => (
                <TableRow 
                  key={`${item.originalQuality}|${item.color}`} 
                  className={`hover:bg-muted/50 ${selectionMode ? 'cursor-pointer' : ''} ${
                    selectedColors.has(`${item.originalQuality}|${item.color}`) ? 'bg-blue-50 dark:bg-blue-950' : ''
                  }`}
                  onClick={() => selectionMode && handleColorSelection(`${item.originalQuality}|${item.color}`)}
                >
                  {selectionMode && (
                    <TableCell>
                      <Checkbox
                        checked={selectedColors.has(`${item.originalQuality}|${item.color}`)}
                        onCheckedChange={() => handleColorSelection(`${item.originalQuality}|${item.color}`)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{item.originalQuality}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded border border-muted-foreground/20"
                        style={{ backgroundColor: item.color.toLowerCase() === 'white' ? '#f8f9fa' : item.color.toLowerCase() }}
                      />
                      {getEffectiveRole() !== 'warehouse_staff' ? (
                        <InlineEditableField
                          value={item.color}
                          onSave={(newValue) => handleColorUpdate(item.color, String(newValue))}
                          placeholder="Enter color"
                        />
                      ) : (
                        <span className="font-medium">{item.color}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.lotCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.totalMeters.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.totalRolls.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!selectionMode && (
                        <Button
                          size="sm"
                          className={isSampleMode ? 'bg-orange-600 text-white hover:bg-orange-700' : ''}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToLotDetails(item.color);
                          }}
                        >
                          {isSampleMode ? t('selectForSample') : t('selectLots')}
                        </Button>
                    )}
                  </TableCell>
                </TableRow>
                 ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityDetails;