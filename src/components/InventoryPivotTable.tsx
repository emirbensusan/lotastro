import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ColorDetail {
  color: string;
  total_meters: number;
  total_rolls: number;
  lot_count: number;
}

interface AggregatedQuality {
  quality: string;
  colors: ColorDetail[];
  total_meters: number;
  total_rolls: number;
  total_lots: number;
}

const InventoryPivotTable = () => {
  const [pivotData, setPivotData] = useState<AggregatedQuality[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedQualities, setSelectedQualities] = useState<Set<string>>(new Set());
  
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasRole } = useAuth();

  useEffect(() => {
    fetchPivotData();
  }, []);

  const fetchPivotData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard stats for consistent summary cards
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_dashboard_stats');
      
      if (statsError) throw statsError;
      setDashboardStats(statsData?.[0]);
      
      // Use the database function for better performance and complete data (remove range limit)
      const { data: summaryData, error } = await supabase
        .rpc('get_inventory_pivot_summary');

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

      // Convert to aggregated quality structure and sort by total meters
      const pivot: AggregatedQuality[] = Array.from(qualityMap.entries()).map(([quality, data]) => ({
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
        pivotDataCount: pivot.length,
        rawData: summaryData,
        dashboardStats: statsData?.[0]
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

  const handleDeleteQualityColor = async (quality: string, color: string) => {
    try {
      // Get all lots for this quality/color combination
      const { data: lots, error: fetchError } = await supabase
        .from('lots')
        .select('id')
        .eq('quality', quality)
        .eq('color', color)
        .eq('status', 'in_stock');

      if (fetchError) throw fetchError;

      if (lots && lots.length > 0) {
        // Delete all lots for this quality/color combination
        const { error: deleteError } = await supabase
          .from('lots')
          .delete()
          .eq('quality', quality)
          .eq('color', color)
          .eq('status', 'in_stock');

        if (deleteError) throw deleteError;

        toast({
          title: t('success') as string,
          description: `${lots.length} lots deleted for ${quality} - ${color}`,
        });

        // Refresh data
        fetchPivotData();
      } else {
        toast({
          title: t('error') as string,
          description: 'No lots found to delete',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQualities.size === 0) return;

    try {
      let totalDeleted = 0;
      
      for (const qualityKey of selectedQualities) {
        const [quality, color] = qualityKey.split('|');
        
        // Get all lots for this quality/color combination
        const { data: lots, error: fetchError } = await supabase
          .from('lots')
          .select('id')
          .eq('quality', quality)
          .eq('color', color)
          .eq('status', 'in_stock');

        if (fetchError) throw fetchError;

        if (lots && lots.length > 0) {
          // Delete all lots for this quality/color combination
          const { error: deleteError } = await supabase
            .from('lots')
            .delete()
            .eq('quality', quality)
            .eq('color', color)
            .eq('status', 'in_stock');

          if (deleteError) throw deleteError;
          totalDeleted += lots.length;
        }
      }

      toast({
        title: t('success') as string,
        description: `${totalDeleted} lots deleted successfully`,
      });

      // Clear selections and refresh data
      setSelectedQualities(new Set());
      setDeleteMode(false);
      fetchPivotData();
    } catch (error: any) {
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedQualities.size === getTotalSelectableItems()) {
      setSelectedQualities(new Set());
    } else {
      const allKeys = new Set<string>();
      filteredData.forEach(qualityData => {
        qualityData.colors.forEach(colorData => {
          allKeys.add(`${qualityData.quality}|${colorData.color}`);
        });
      });
      setSelectedQualities(allKeys);
    }
  };

  const handleSelectQualityColor = (quality: string, color: string) => {
    const key = `${quality}|${color}`;
    const newSelected = new Set(selectedQualities);
    
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    
    setSelectedQualities(newSelected);
  };

  const getTotalSelectableItems = () => {
    return filteredData.reduce((total, qualityData) => 
      total + qualityData.colors.length, 0
    );
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
      {/* Search and Controls */}
      <div className="flex items-center justify-between space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={String(t('searchPlaceholder'))}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => setSearchTerm('')}
            >
              ×
            </Button>
          )}
        </div>
        
        {hasRole('admin') && (
          <div className="flex items-center space-x-2">
            <Button
              variant={deleteMode ? "destructive" : "outline"}
              onClick={() => {
                setDeleteMode(!deleteMode);
                setSelectedQualities(new Set());
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('deleteMode')}
            </Button>
            
            {deleteMode && selectedQualities.size > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    {t('deleteSelected')} ({selectedQualities.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedQualities.size} selected quality/color combinations? {t('actionCannotBeUndone')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete}>
                      {t('delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats - Use dashboard stats for consistency */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('allQualities')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pivotData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('lots')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardStats?.total_in_stock_lots || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('meters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(dashboardStats?.total_meters || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('rolls')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(dashboardStats?.total_rolls || 0).toLocaleString()}
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
                {deleteMode && hasRole('admin') && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedQualities.size > 0 && selectedQualities.size === getTotalSelectableItems()}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="w-[200px]">{t('quality')}</TableHead>
                <TableHead>{t('color')}</TableHead>
                <TableHead className="text-right">{t('lots')}</TableHead>
                <TableHead className="text-right">{t('meters')}</TableHead>
                <TableHead className="text-right">{t('rolls')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
                {deleteMode && hasRole('admin') && (
                  <TableHead className="text-right">{t('delete')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((qualityData) => (
                <TableRow key={qualityData.quality} className="border-b-2">
                  {deleteMode && hasRole('admin') && (
                    <TableCell>
                      <Checkbox
                        checked={qualityData.colors.every(color => 
                          selectedQualities.has(`${qualityData.quality}|${color.color}`)
                        )}
                        onCheckedChange={(checked) => {
                          const newSelected = new Set(selectedQualities);
                          qualityData.colors.forEach(color => {
                            const key = `${qualityData.quality}|${color.color}`;
                            if (checked) {
                              newSelected.add(key);
                            } else {
                              newSelected.delete(key);
                            }
                          });
                          setSelectedQualities(newSelected);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="text-sm">{qualityData.quality}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {qualityData.colors.map(color => (
                        <Badge key={color.color} variant="secondary" className="text-xs">
                          {color.color}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {qualityData.total_lots}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {qualityData.total_meters.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {qualityData.total_rolls.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="bg-black text-white hover:bg-black/90 text-xs"
                      onClick={() => navigateToQualityDetails(qualityData.quality)}
                    >
                      {t('viewQuality')}
                    </Button>
                  </TableCell>
                  {deleteMode && hasRole('admin') && (
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete all colors for quality "{qualityData.quality}"?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => {
                                qualityData.colors.forEach(color => 
                                  handleDeleteQualityColor(qualityData.quality, color.color)
                                );
                              }}
                            >
                              {t('delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No inventory items found matching your search.' : 'No inventory data available.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryPivotTable;