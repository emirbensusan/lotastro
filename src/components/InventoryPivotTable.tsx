import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Search, Package } from 'lucide-react';
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
  
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchPivotData();
  }, []);

  const fetchPivotData = async () => {
    try {
      setLoading(true);
      
      // Use the database function for better performance and complete data
      const { data: summaryData, error } = await supabase.rpc('get_inventory_pivot_summary');

      if (error) throw error;

      // Group by quality and aggregate the colors
      const qualityMap = new Map<string, {
        colors: { color: string; total_meters: number; total_rolls: number; lot_count: number }[];
        total_meters: number;
        total_rolls: number;
        total_lots: number;
      }>();

      // Process the database results
      summaryData?.forEach(row => {
        if (!qualityMap.has(row.quality)) {
          qualityMap.set(row.quality, {
            colors: [],
            total_meters: 0,
            total_rolls: 0,
            total_lots: 0
          });
        }
        
        const qualityData = qualityMap.get(row.quality)!;
        qualityData.colors.push({
          color: row.color,
          total_meters: Number(row.total_meters),
          total_rolls: Number(row.total_rolls),
          lot_count: Number(row.lot_count)
        });
        
        qualityData.total_meters += Number(row.total_meters);
        qualityData.total_rolls += Number(row.total_rolls);
        qualityData.total_lots += Number(row.lot_count);
      });

      // Convert to pivot data structure and sort by total meters
      const pivot: PivotData[] = Array.from(qualityMap.entries()).map(([quality, data]) => ({
        quality,
        colors: data.colors.sort((a, b) => a.color.localeCompare(b.color)),
        total_meters: data.total_meters,
        total_rolls: data.total_rolls,
        total_lots: data.total_lots,
      })).sort((a, b) => b.total_meters - a.total_meters);

      // Debug: Log the totals for comparison with Dashboard
      const totalQualities = pivot.length;
      const totalLots = pivot.reduce((sum, item) => sum + item.total_lots, 0);
      const totalMeters = pivot.reduce((sum, item) => sum + item.total_meters, 0);
      const totalRolls = pivot.reduce((sum, item) => sum + item.total_rolls, 0);
      
      console.log('Inventory Page Stats:', {
        totalQualities,
        totalLots,
        totalMeters,
        totalRolls,
        pivotDataCount: pivot.length
      });

      setPivotData(pivot);
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

  const navigateToQualityDetails = (quality: string) => {
    navigate(`/inventory/${encodeURIComponent(quality)}`);
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
                <TableRow 
                  key={qualityData.quality} 
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigateToQualityDetails(qualityData.quality)}
                >
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <span className="font-semibold">{qualityData.quality}</span>
                      <Badge variant="secondary" className="ml-2">
                        {qualityData.colors.length} {qualityData.colors.length === 1 ? 'color' : 'colors'}
                      </Badge>
                    </div>
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
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToQualityDetails(qualityData.quality);
                      }}
                    >
                      {t('selectLots')}
                    </Button>
                  </TableCell>
                </TableRow>
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