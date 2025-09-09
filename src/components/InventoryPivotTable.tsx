import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PivotData {
  quality: string;
  colors: {
    color: string;
    total_meters: number;
    total_rolls: number;
    lot_count: number;
  }[];
  total_meters: number;
  total_rolls: number;
  total_lots: number;
}

const InventoryPivotTable = () => {
  const [pivotData, setPivotData] = useState<PivotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQualities, setExpandedQualities] = useState<Set<string>>(new Set());
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchPivotData();
  }, []);

  const fetchPivotData = async () => {
    try {
      setLoading(true);
      
      // Fetch aggregated data for the pivot table
      const { data: lotsData, error } = await supabase
        .from('lots')
        .select(`
          quality,
          color,
          meters,
          roll_count,
          suppliers(name)
        `)
        .eq('status', 'in_stock');

      if (error) throw error;

      // Group and aggregate data
      const qualityMap = new Map<string, Map<string, { meters: number; rolls: number; count: number }>>();

      lotsData.forEach(lot => {
        if (!qualityMap.has(lot.quality)) {
          qualityMap.set(lot.quality, new Map());
        }
        
        const colorMap = qualityMap.get(lot.quality)!;
        if (!colorMap.has(lot.color)) {
          colorMap.set(lot.color, { meters: 0, rolls: 0, count: 0 });
        }
        
        const colorData = colorMap.get(lot.color)!;
        colorData.meters += Number(lot.meters);
        colorData.rolls += lot.roll_count;
        colorData.count += 1;
      });

      // Convert to pivot data structure
      const pivot: PivotData[] = Array.from(qualityMap.entries()).map(([quality, colorMap]) => {
        const colors = Array.from(colorMap.entries()).map(([color, data]) => ({
          color,
          total_meters: data.meters,
          total_rolls: data.rolls,
          lot_count: data.count,
        }));

        const total_meters = colors.reduce((sum, color) => sum + color.total_meters, 0);
        const total_rolls = colors.reduce((sum, color) => sum + color.total_rolls, 0);
        const total_lots = colors.reduce((sum, color) => sum + color.lot_count, 0);

        return {
          quality,
          colors: colors.sort((a, b) => a.color.localeCompare(b.color)),
          total_meters,
          total_rolls,
          total_lots,
        };
      });

      setPivotData(pivot.sort((a, b) => a.quality.localeCompare(b.quality)));
    } catch (error) {
      console.error('Error fetching pivot data:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to load inventory data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleQuality = (quality: string) => {
    const newExpanded = new Set(expandedQualities);
    if (newExpanded.has(quality)) {
      newExpanded.delete(quality);
    } else {
      newExpanded.add(quality);
    }
    setExpandedQualities(newExpanded);
  };

  const navigateToLotDetails = (quality: string, color: string) => {
    navigate(`/inventory/${encodeURIComponent(quality)}/${encodeURIComponent(color)}`);
  };

  const filteredData = pivotData.filter(item =>
    item.quality.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.colors.some(color => color.color.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={String(t('searchPlaceholder'))}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('allQualities')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('lots')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredData.reduce((sum, item) => sum + item.total_lots, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('meters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredData.reduce((sum, item) => sum + item.total_meters, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('rolls')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredData.reduce((sum, item) => sum + item.total_rolls, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pivot Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('stockOverview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">{t('quality')} / {t('color')}</TableHead>
                <TableHead className="text-right">{t('lots')}</TableHead>
                <TableHead className="text-right">{t('meters')}</TableHead>
                <TableHead className="text-right">{t('rolls')}</TableHead>
                <TableHead className="text-right">{t('selectAction')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((qualityData) => (
                <React.Fragment key={qualityData.quality}>
                  {/* Quality Row */}
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>
                      <Collapsible
                        open={expandedQualities.has(qualityData.quality)}
                        onOpenChange={() => toggleQuality(qualityData.quality)}
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="p-0 h-auto font-semibold text-left justify-start">
                            {expandedQualities.has(qualityData.quality) ? (
                              <ChevronDown className="h-4 w-4 mr-2" />
                            ) : (
                              <ChevronRight className="h-4 w-4 mr-2" />
                            )}
                            {qualityData.quality}
                            <Badge variant="secondary" className="ml-2">
                              {qualityData.colors.length} {qualityData.colors.length === 1 ? 'color' : 'colors'}
                            </Badge>
                          </Button>
                        </CollapsibleTrigger>
                      </Collapsible>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {qualityData.total_lots}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {qualityData.total_meters.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {qualityData.total_rolls.toLocaleString()}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>

                  {/* Color Rows */}
                  <Collapsible
                    open={expandedQualities.has(qualityData.quality)}
                    onOpenChange={() => toggleQuality(qualityData.quality)}
                  >
                    <CollapsibleContent asChild>
                      <>
                        {qualityData.colors.map((colorData) => (
                          <TableRow key={`${qualityData.quality}-${colorData.color}`} className="hover:bg-muted/25">
                            <TableCell className="pl-8">
                              <div className="flex items-center space-x-3">
                                <div 
                                  className="w-4 h-4 rounded border border-muted-foreground/20"
                                  style={{ backgroundColor: colorData.color.toLowerCase() === 'white' ? '#f8f9fa' : colorData.color.toLowerCase() }}
                                />
                                <span>{colorData.color}</span>
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
                              <Button
                                size="sm"
                                onClick={() => navigateToLotDetails(qualityData.quality, colorData.color)}
                              >
                                {t('selectLots')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    </CollapsibleContent>
                  </Collapsible>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
          
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? String(t('noInventoryItems')) : 'No inventory data available'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryPivotTable;