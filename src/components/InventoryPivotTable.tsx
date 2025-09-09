import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface InventoryItem {
  quality: string;
  color: string;
  total_meters: number;
  total_rolls: number;
  lot_count: number;
}

const InventoryPivotTable = () => {
  const [pivotData, setPivotData] = useState<InventoryItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
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
      
      // Use the database function for better performance and complete data
      const { data: summaryData, error } = await supabase
        .rpc('get_inventory_pivot_summary');

      if (error) throw error;

      // Convert to flat array and sort by total meters descending
      const pivot: InventoryItem[] = (summaryData || []).map(row => ({
        quality: row.quality,
        color: row.color,
        total_meters: Number(row.total_meters),
        total_rolls: Number(row.total_rolls),
        lot_count: Number(row.lot_count)
      })).sort((a, b) => b.total_meters - a.total_meters);

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
    if (selectedItems.size === 0) return;

    try {
      let totalDeleted = 0;
      
      for (const itemKey of selectedItems) {
        const [quality, color] = itemKey.split('|');
        
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
      setSelectedItems(new Set());
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
    if (selectedItems.size === filteredData.length) {
      setSelectedItems(new Set());
    } else {
      const allKeys = new Set<string>();
      filteredData.forEach(item => {
        allKeys.add(`${item.quality}|${item.color}`);
      });
      setSelectedItems(allKeys);
    }
  };

  const handleSelectItem = (quality: string, color: string) => {
    const key = `${quality}|${color}`;
    const newSelected = new Set(selectedItems);
    
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    
    setSelectedItems(newSelected);
  };

  const filteredData = pivotData.filter(item =>
    item.quality.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.color.toLowerCase().includes(searchTerm.toLowerCase())
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
                setSelectedItems(new Set());
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('deleteMode')}
            </Button>
            
            {deleteMode && selectedItems.size > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    {t('deleteSelected')} ({selectedItems.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedItems.size} selected quality/color combinations? {t('actionCannotBeUndone')}
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
                      checked={selectedItems.size > 0 && selectedItems.size === filteredData.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>{t('quality')}</TableHead>
                <TableHead>{t('color')}</TableHead>
                <TableHead className="text-right">{t('meters')}</TableHead>
                <TableHead className="text-right">{t('rolls')}</TableHead>
                <TableHead className="text-right">{t('lots')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
                {deleteMode && hasRole('admin') && (
                  <TableHead className="text-right">{t('delete')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={`${item.quality}-${item.color}`}>
                  {deleteMode && hasRole('admin') && (
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(`${item.quality}|${item.color}`)}
                        onCheckedChange={() => handleSelectItem(item.quality, item.color)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-sm">
                    {item.quality}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.color}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {item.total_meters.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {item.total_rolls.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {item.lot_count}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="bg-black text-white hover:bg-black/90 text-xs"
                      onClick={() => navigateToQualityDetails(item.quality)}
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
                              Are you sure you want to delete all lots for {item.quality} - {item.color}? {t('actionCannotBeUndone')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteQualityColor(item.quality, item.color)}>
                              {t('delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell 
                    colSpan={deleteMode && hasRole('admin') ? 8 : 6} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    {searchTerm ? t('noSearchResults') : t('noInventoryData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryPivotTable;