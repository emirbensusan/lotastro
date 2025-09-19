import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ProgressDialog } from '@/components/ui/progress-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Package, Trash2, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useViewAsRole } from '@/contexts/ViewAsRoleContext';
import { InlineEditableField } from '@/components/InlineEditableField';

interface InventoryItem {
  quality: string;
  color: string;
  total_meters: number;
  total_rolls: number;
  lot_count: number;
}

interface AggregatedQuality {
  quality: string;
  color_count: number;
  total_meters: number;
  total_rolls: number;
  lot_count: number;
}

const InventoryPivotTable = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { hasRole, profile } = useAuth();
  const { viewAsRole } = useViewAsRole();
  
  // Get the effective role (viewAsRole takes precedence)
  const getEffectiveRole = () => viewAsRole || profile?.role;
  
  // Check if we're in sample mode
  const searchParams = new URLSearchParams(location.search);
  const isSampleMode = searchParams.get('mode') === 'sample';
  
  const [pivotData, setPivotData] = useState<AggregatedQuality[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Sample selection dialog state
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
  const [selectedLotForSample, setSelectedLotForSample] = useState<{
    id: string;
    lot_number: string;
    quality: string;
    color: string;
    supplier_name: string;
    entry_date: string;
  } | null>(null);
  
  // Progress dialog state
  const [progressDialog, setProgressDialog] = useState({
    isOpen: false,
    title: '',
    progress: 0,
    statusText: '',
    isComplete: false
  });

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

      // Convert to flat array and aggregate by quality
      const rawData: InventoryItem[] = (summaryData || []).map(row => ({
        quality: row.quality,
        color: row.color,
        total_meters: Number(row.total_meters),
        total_rolls: Number(row.total_rolls),
        lot_count: Number(row.lot_count)
      }));

      // Aggregate by quality
      const qualityMap = new Map<string, AggregatedQuality>();
      
      rawData.forEach(item => {
        if (qualityMap.has(item.quality)) {
          const existing = qualityMap.get(item.quality)!;
          existing.color_count += 1;
          existing.total_meters += item.total_meters;
          existing.total_rolls += item.total_rolls;
          existing.lot_count += item.lot_count;
        } else {
          qualityMap.set(item.quality, {
            quality: item.quality,
            color_count: 1,
            total_meters: item.total_meters,
            total_rolls: item.total_rolls,
            lot_count: item.lot_count
          });
        }
      });

      const pivot: AggregatedQuality[] = Array.from(qualityMap.values())
        .sort((a, b) => b.total_meters - a.total_meters);

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
    if (isSampleMode) {
      // In sample mode, navigate to quality selection but keep sample mode
      navigate(`/inventory/${encodeURIComponent(quality)}?mode=sample`);
    } else {
      navigate(`/inventory/${encodeURIComponent(quality)}`);
    }
  };

  const navigateToLotDetails = (quality: string, color: string) => {
    navigate(`/inventory/${encodeURIComponent(quality)}/${encodeURIComponent(color)}`);
  };

  const handleDeleteQuality = async (quality: string) => {
    try {
      // Show progress dialog
      setProgressDialog({
        isOpen: true,
        title: `Deleting Quality: ${quality}`,
        progress: 0,
        statusText: 'Fetching lots to delete...',
        isComplete: false
      });

      // Get all lots for this quality
      const { data: lots, error: fetchError } = await supabase
        .from('lots')
        .select('id')
        .eq('quality', quality)
        .eq('status', 'in_stock');

      if (fetchError) throw fetchError;

      if (lots && lots.length > 0) {
        setProgressDialog(prev => ({
          ...prev,
          progress: 30,
          statusText: `Deleting ${lots.length} lots...`
        }));

        // Delete all lots for this quality
        const { error: deleteError } = await supabase
          .from('lots')
          .delete()
          .eq('quality', quality)
          .eq('status', 'in_stock');

        if (deleteError) throw deleteError;

        setProgressDialog(prev => ({
          ...prev,
          progress: 80,
          statusText: 'Refreshing data...'
        }));

        // Refresh data
        await fetchPivotData();

        setProgressDialog(prev => ({
          ...prev,
          progress: 100,
          statusText: `${lots.length} lots deleted successfully`,
          isComplete: true
        }));
      } else {
        setProgressDialog(prev => ({
          ...prev,
          progress: 100,
          statusText: 'No lots found to delete',
          isComplete: true
        }));
      }
    } catch (error: any) {
      setProgressDialog(prev => ({
        ...prev,
        progress: 100,
        statusText: `Error: ${error.message}`,
        isComplete: true
      }));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;

    try {
      const selectedArray = Array.from(selectedItems);
      let totalDeleted = 0;
      let current = 0;

      // Show progress dialog
      setProgressDialog({
        isOpen: true,
        title: `Deleting ${selectedArray.length} Selected Items`,
        progress: 0,
        statusText: 'Starting bulk deletion...',
        isComplete: false
      });
      
      for (const quality of selectedArray) {
        current++;
        
        setProgressDialog(prev => ({
          ...prev,
          progress: Math.floor((current / selectedArray.length) * 70),
          statusText: `Processing item ${current} of ${selectedArray.length}: ${quality}`
        }));

        // Get all lots for this quality
        const { data: lots, error: fetchError } = await supabase
          .from('lots')
          .select('id')
          .eq('quality', quality)
          .eq('status', 'in_stock');

        if (fetchError) throw fetchError;

        if (lots && lots.length > 0) {
          // Delete all lots for this quality
          const { error: deleteError } = await supabase
            .from('lots')
            .delete()
            .eq('quality', quality)
            .eq('status', 'in_stock');

          if (deleteError) throw deleteError;
          totalDeleted += lots.length;
        }
      }

      setProgressDialog(prev => ({
        ...prev,
        progress: 85,
        statusText: 'Refreshing data...'
      }));

      // Clear selections and refresh data
      setSelectedItems(new Set());
      setDeleteMode(false);
      await fetchPivotData();

      setProgressDialog(prev => ({
        ...prev,
        progress: 100,
        statusText: `${totalDeleted} lots deleted successfully`,
        isComplete: true
      }));
    } catch (error: any) {
      setProgressDialog(prev => ({
        ...prev,
        progress: 100,
        statusText: `Error: ${error.message}`,
        isComplete: true
      }));
    }
  };

  const handleQualityUpdate = async (oldQuality: string, newQuality: string) => {
    if (oldQuality === newQuality) return;

    try {
      // Update all lots with this quality
      const { error } = await supabase
        .from('lots')
        .update({ quality: newQuality })
        .eq('quality', oldQuality)
        .eq('status', 'in_stock');

      if (error) throw error;

      // Refresh the data
      await fetchPivotData();
      
      toast({
        title: 'Quality Updated',
        description: `Updated quality from "${oldQuality}" to "${newQuality}"`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to update quality: ${error.message}`,
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
        allKeys.add(item.quality);
      });
      setSelectedItems(allKeys);
    }
  };

  const handleSelectItem = (quality: string) => {
    const newSelected = new Set(selectedItems);
    
    if (newSelected.has(quality)) {
      newSelected.delete(quality);
    } else {
      newSelected.add(quality);
    }
    
    setSelectedItems(newSelected);
  };

  const filteredData = pivotData.filter(item => {
    const matchesSearch = item.quality.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesQuality = !qualityFilter || item.quality.toLowerCase().includes(qualityFilter.toLowerCase());
    return matchesSearch && matchesQuality;
  });

  // Get unique qualities for the filter dropdown
  const uniqueQualities = [...new Set(pivotData.map(item => item.quality))].sort();

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
        
        {getEffectiveRole() === 'admin' && (
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
                      Are you sure you want to delete {selectedItems.size} selected qualities? {t('actionCannotBeUndone')}
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
                {deleteMode && getEffectiveRole() === 'admin' && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedItems.size > 0 && selectedItems.size === filteredData.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>
                  <div className="flex items-center space-x-2">
                    <span>Kalite</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Filter className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Filter by quality</p>
                          <Textarea
                            placeholder="Type to filter qualities..."
                            value={qualityFilter}
                            onChange={(e) => setQualityFilter(e.target.value)}
                            className="min-h-[60px]"
                          />
                          {qualityFilter && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setQualityFilter('')}
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
                <TableHead>Renk Sayısı</TableHead>
                <TableHead className="text-right">Toplam Stoktaki Metraj</TableHead>
                <TableHead className="text-right">{t('rolls')}</TableHead>
                <TableHead className="text-right">Farklı Lot Sayısı</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
                {deleteMode && getEffectiveRole() === 'admin' && (
                  <TableHead className="text-right">{t('delete')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.quality}>
                  {deleteMode && getEffectiveRole() === 'admin' && (
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(item.quality)}
                        onCheckedChange={() => handleSelectItem(item.quality)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-sm">
                    {getEffectiveRole() === 'warehouse_staff' ? (
                      <InlineEditableField
                        value={item.quality}
                        onSave={(newValue) => handleQualityUpdate(item.quality, String(newValue))}
                        placeholder="Enter quality"
                      />
                    ) : (
                      item.quality
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.color_count} color{item.color_count !== 1 ? 's' : ''}
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
                    className={`text-xs ${isSampleMode ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-black text-white hover:bg-black/90'}`}
                    onClick={() => navigateToQualityDetails(item.quality)}
                  >
                    {isSampleMode ? t('selectForSample') : t('viewQuality')}
                  </Button>
                  </TableCell>
                  {deleteMode && getEffectiveRole() === 'admin' && (
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
                              Are you sure you want to delete all lots for {item.quality}? {t('actionCannotBeUndone')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteQuality(item.quality)}>
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
                    colSpan={deleteMode && getEffectiveRole() === 'admin' ? 8 : 6} 
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

      {/* Progress Dialog */}
      <ProgressDialog
        isOpen={progressDialog.isOpen}
        title={progressDialog.title}
        progress={progressDialog.progress}
        statusText={progressDialog.statusText}
        isComplete={progressDialog.isComplete}
        onComplete={() => setProgressDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default InventoryPivotTable;