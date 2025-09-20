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
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import { ArrowLeft, Package, ShoppingCart, X, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useViewAsRole } from '@/contexts/ViewAsRoleContext';
import { InlineEditableField } from '@/components/InlineEditableField';

interface ColorData {
  color: string;
  total_meters: number;
  total_rolls: number;
  lot_count: number;
}

const QualityDetails = () => {
  const { quality } = useParams();
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
  
  const [colors, setColors] = useState<ColorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [colorFilter, setColorFilter] = useState('');
  const [qualityTotals, setQualityTotals] = useState({
    total_meters: 0,
    total_rolls: 0,
    total_lots: 0
  });

  useEffect(() => {
    if (quality) {
      fetchColorData();
    }
  }, [quality]);

  const fetchColorData = async () => {
    try {
      setLoading(true);
      
      const { data: lotsData, error } = await supabase
        .from('lots')
        .select('color, meters, roll_count')
        .eq('quality', quality)
        .eq('status', 'in_stock');

      if (error) throw error;

      // Group by color
      const colorMap = new Map<string, { meters: number; rolls: number; count: number }>();

      lotsData.forEach(lot => {
        if (!colorMap.has(lot.color)) {
          colorMap.set(lot.color, { meters: 0, rolls: 0, count: 0 });
        }
        
        const colorData = colorMap.get(lot.color)!;
        colorData.meters += Number(lot.meters);
        colorData.rolls += lot.roll_count;
        colorData.count += 1;
      });

      // Convert to array and sort by meters (descending)
      const colorsArray = Array.from(colorMap.entries()).map(([color, data]) => ({
        color,
        total_meters: data.meters,
        total_rolls: data.rolls,
        lot_count: data.count,
      })).sort((a, b) => b.total_meters - a.total_meters);

      // Calculate totals
      const totals = {
        total_meters: colorsArray.reduce((sum, color) => sum + color.total_meters, 0),
        total_rolls: colorsArray.reduce((sum, color) => sum + color.total_rolls, 0),
        total_lots: colorsArray.reduce((sum, color) => sum + color.lot_count, 0),
      };

      setColors(colorsArray);
      setQualityTotals(totals);
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

  const navigateToLotDetails = (color: string) => {
    if (isSampleMode) {
      navigate(`/inventory/${encodeURIComponent(quality!)}/${encodeURIComponent(color)}?mode=sample`);
    } else {
      navigate(`/inventory/${encodeURIComponent(quality!)}/${encodeURIComponent(color)}`);
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
    if (selectedColors.size === colors.length) {
      setSelectedColors(new Set());
    } else {
      setSelectedColors(new Set(colors.map(c => c.color)));
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
    navigate(`/lot-selection?quality=${encodeURIComponent(quality!)}&colors=${encodeURIComponent(colorParams)}`);
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
        // Update all lots with this color for the current quality
        const { error } = await supabase
          .from('lots')
          .update({ color: newColor })
          .eq('quality', quality)
          .eq('color', oldColor)
          .eq('status', 'in_stock');

        if (error) throw error;

        // Refresh the data
        await fetchColorData();
        
        toast({
          title: 'Color Updated',
          description: `Updated color from "${oldColor}" to "${newColor}"`,
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
  };

  // Filter colors based on search
  const filteredColors = colors.filter(colorData => {
    return !colorFilter || colorData.color.toLowerCase().includes(colorFilter.toLowerCase());
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
            <BreadcrumbPage>{quality}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{quality}</h1>
          <p className="text-muted-foreground">
            {colorFilter ? `${filteredColors.length} of ${colors.length}` : colors.length} {colors.length === 1 ? 'color' : 'colors'} • {qualityTotals.total_lots} {t('lots')} • {qualityTotals.total_meters.toLocaleString()} {t('meters')} • {qualityTotals.total_rolls.toLocaleString()} {t('rolls')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {!selectionMode && (
            <>
              <Button variant="outline" onClick={handleStartSelection}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Select Multiple Colors
              </Button>
              <Button variant="outline" onClick={navigateBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('backToInventory')}
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
                  {selectedColors.size === colors.length ? 'Deselect All' : 'Select All'}
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
          <CardTitle>{t('availableColors')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {selectionMode && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedColors.size > 0 && selectedColors.size === colors.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>
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
                <TableHead className="text-right">{t('lots')}</TableHead>
                <TableHead className="text-right">{t('meters')}</TableHead>
                <TableHead className="text-right">{t('rolls')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColors.map((colorData) => (
                <TableRow 
                  key={colorData.color} 
                  className={`hover:bg-muted/50 ${selectionMode ? 'cursor-pointer' : ''} ${
                    selectedColors.has(colorData.color) ? 'bg-blue-50 dark:bg-blue-950' : ''
                  }`}
                  onClick={() => selectionMode && handleColorSelection(colorData.color)}
                >
                  {selectionMode && (
                    <TableCell>
                      <Checkbox
                        checked={selectedColors.has(colorData.color)}
                        onCheckedChange={() => handleColorSelection(colorData.color)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded border border-muted-foreground/20"
                        style={{ backgroundColor: colorData.color.toLowerCase() === 'white' ? '#f8f9fa' : colorData.color.toLowerCase() }}
                      />
                      {getEffectiveRole() !== 'warehouse_staff' ? (
                        <InlineEditableField
                          value={colorData.color}
                          onSave={(newValue) => handleColorUpdate(colorData.color, String(newValue))}
                          placeholder="Enter color"
                        />
                      ) : (
                        <span className="font-medium">{colorData.color}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {colorData.lot_count}
                  </TableCell>
                  <TableCell className="text-right">
                    {colorData.total_meters.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {colorData.total_rolls.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!selectionMode && (
                        <Button
                          size="sm"
                          className={isSampleMode ? 'bg-orange-600 text-white hover:bg-orange-700' : ''}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToLotDetails(colorData.color);
                          }}
                        >
                          {isSampleMode ? t('selectForSample') : t('selectLots')}
                        </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredColors.length === 0 && colors.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No colors match the current filter
            </div>
          )}
          {colors.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No colors available for this quality
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityDetails;