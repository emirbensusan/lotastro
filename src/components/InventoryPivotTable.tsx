import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ProgressDialog } from '@/components/ui/progress-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Package, Trash2, Filter, ShoppingCart, ArrowRight, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useViewAsRole } from '@/contexts/ViewAsRoleContext';
import { InlineEditableField } from '@/components/InlineEditableField';
import { getMinQualitiesForMultiOrder } from '@/components/OrderFlowSettingsTab';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';
import { TableExportButton, exportToCSV } from '@/components/ui/table-export-button';

interface InventoryItem {
  quality: string;
  normalized_quality: string;
  color: string;
  total_meters: number;
  total_rolls: number;
  lot_count: number;
  incoming_meters: number;
  physical_reserved_meters: number;
  incoming_reserved_meters: number;
  total_reserved_meters: number;
  available_meters: number;
}

interface AggregatedQuality {
  quality: string;
  normalized_quality: string;
  color_count: number;
  total_meters: number;
  total_rolls: number;
  lot_count: number;
  incoming_meters: number;
  total_reserved_meters: number;
  available_meters: number;
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
  
  // Check order mode from URL
  const searchParams = new URLSearchParams(location.search);
  const orderMode = searchParams.get('mode'); // 'sample', 'multi', 'multi-sample', or null
  const isSampleMode = orderMode === 'sample' || orderMode === 'multi-sample';
  const isMultiMode = orderMode === 'multi' || orderMode === 'multi-sample';
  
  const [pivotData, setPivotData] = useState<AggregatedQuality[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false);
  const [selectedQualitiesForBulk, setSelectedQualitiesForBulk] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Sorting state
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>(
    { key: 'total_meters', direction: 'desc' }
  );
  
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

  // Auto-enable bulk selection mode when navigating from Orders page with any order mode
  useEffect(() => {
    if (orderMode) {
      setBulkSelectionMode(true);
    }
  }, [orderMode]);

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
        normalized_quality: row.normalized_quality,
        color: row.color,
        total_meters: Number(row.total_meters),
        total_rolls: Number(row.total_rolls),
        lot_count: Number(row.lot_count),
        incoming_meters: Number(row.incoming_meters || 0),
        physical_reserved_meters: Number(row.physical_reserved_meters || 0),
        incoming_reserved_meters: Number(row.incoming_reserved_meters || 0),
        total_reserved_meters: Number(row.total_reserved_meters || 0),
        available_meters: Number(row.available_meters || 0)
      }));

      // Aggregate by normalized quality
      const qualityMap = new Map<string, AggregatedQuality>();
      
      rawData.forEach(item => {
        if (qualityMap.has(item.normalized_quality)) {
          const existing = qualityMap.get(item.normalized_quality)!;
          existing.color_count += 1;
          existing.total_meters += item.total_meters;
          existing.total_rolls += item.total_rolls;
          existing.lot_count += item.lot_count;
          existing.incoming_meters += item.incoming_meters;
          existing.total_reserved_meters += item.total_reserved_meters;
          existing.available_meters += item.available_meters;
        } else {
          qualityMap.set(item.normalized_quality, {
            quality: item.quality, // Keep the original quality for display
            normalized_quality: item.normalized_quality,
            color_count: 1,
            total_meters: item.total_meters,
            total_rolls: item.total_rolls,
            lot_count: item.lot_count,
            incoming_meters: item.incoming_meters,
            total_reserved_meters: item.total_reserved_meters,
            available_meters: item.available_meters
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

  const navigateToQualityDetails = (normalizedQuality: string) => {
    // Preserve the order mode when navigating to quality details
    const modeParam = orderMode ? `?mode=${orderMode}` : '';
    navigate(`/inventory/${encodeURIComponent(normalizedQuality)}${modeParam}`);
  };

  const navigateToLotDetails = (quality: string, color: string) => {
    navigate(`/inventory/${encodeURIComponent(quality)}/${encodeURIComponent(color)}`);
  };

  const handleDeleteQuality = async (normalizedQuality: string) => {
    try {
      // Show progress dialog
      setProgressDialog({
        isOpen: true,
        title: `Deleting Quality: ${normalizedQuality}`,
        progress: 0,
        statusText: 'Fetching lots to delete...',
        isComplete: false
      });

      // Get all lots for this normalized quality using a query that normalizes quality
      const { data: lots, error: fetchError } = await supabase
        .from('lots')
        .select('id, quality')
        .eq('status', 'in_stock');

      if (fetchError) throw fetchError;

      // Filter lots that match the normalized quality on the frontend
      const { data: normalizeResult, error: normalizeError } = await supabase
        .rpc('normalize_quality', { quality_input: lots?.[0]?.quality || '' });

      if (normalizeError) throw normalizeError;

      // Get all lots that normalize to this quality
      const lotsToDelete = lots?.filter(async (lot) => {
        const { data: normalized } = await supabase
          .rpc('normalize_quality', { quality_input: lot.quality });
        return normalized === normalizedQuality;
      }) || [];

      if (lotsToDelete && lotsToDelete.length > 0) {
        setProgressDialog(prev => ({
          ...prev,
          progress: 30,
          statusText: `Deleting ${lotsToDelete.length} lots...`
        }));

        // Delete all lots for this normalized quality
        const lotIds = lotsToDelete.map(lot => lot.id);
        const { error: deleteError } = await supabase
          .from('lots')
          .delete()
          .in('id', lotIds);

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
          statusText: `${lotsToDelete.length} lots deleted successfully`,
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
      const effectiveRole = getEffectiveRole();
      
      // Senior managers and admins can apply changes directly
      if (effectiveRole === 'senior_manager' || effectiveRole === 'admin') {
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
      } else {
        // Other users submit to approval queue
        const { error } = await supabase
          .from('field_edit_queue')
          .insert({
            table_name: 'lots',
            record_id: null, // For quality changes affecting multiple records
            field_name: 'quality',
            old_value: oldQuality,
            new_value: newQuality,
            submitted_by: profile?.user_id
          });

        if (error) throw error;

        toast({
          title: 'Change Submitted',
          description: `Quality change from "${oldQuality}" to "${newQuality}" submitted for approval`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to update quality: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleSelectAll = () => {
    if (deleteMode) {
      if (selectedItems.size === filteredData.length) {
        setSelectedItems(new Set());
      } else {
        const allKeys = new Set<string>();
        filteredData.forEach(item => {
          allKeys.add(item.normalized_quality);
        });
        setSelectedItems(allKeys);
      }
    } else if (bulkSelectionMode) {
      if (selectedQualitiesForBulk.size === filteredData.length) {
        setSelectedQualitiesForBulk(new Set());
      } else {
        const allKeys = new Set<string>();
        filteredData.forEach(item => {
          allKeys.add(item.normalized_quality);
        });
        setSelectedQualitiesForBulk(allKeys);
      }
    }
  };

  const handleSelectItem = (normalizedQuality: string) => {
    if (deleteMode) {
      const newSelected = new Set(selectedItems);
      
      if (newSelected.has(normalizedQuality)) {
        newSelected.delete(normalizedQuality);
      } else {
        newSelected.add(normalizedQuality);
      }
      
      setSelectedItems(newSelected);
    } else if (bulkSelectionMode) {
      // For single-selection modes (single, sample), auto-proceed immediately
      const isSingleSelectionMode = orderMode === 'single' || orderMode === 'sample';
      
      if (isSingleSelectionMode) {
        // Clear previous selection and navigate directly
        setSelectedQualitiesForBulk(new Set([normalizedQuality]));
        navigateToQualityDetails(normalizedQuality);
      } else {
        // Multi-selection toggle for multi and multi-sample modes
        const newSelected = new Set(selectedQualitiesForBulk);
        
        if (newSelected.has(normalizedQuality)) {
          newSelected.delete(normalizedQuality);
        } else {
          newSelected.add(normalizedQuality);
        }
        
        setSelectedQualitiesForBulk(newSelected);
      }
    }
  };

  const handleProceedToBulkColorSelection = () => {
    if (selectedQualitiesForBulk.size === 0) {
      toast({
        title: String(t('error')),
        description: "Please select at least one quality",
        variant: "destructive",
      });
      return;
    }
    
    // For multi modes, require minimum selections
    const minRequired = getMinQualitiesForMultiOrder();
    if (isMultiMode && selectedQualitiesForBulk.size < minRequired) {
      toast({
        title: String(t('error')),
        description: String(t('multiOrderMinimum')),
        variant: "destructive",
      });
      return;
    }
    
    const selectedQualityNames = Array.from(selectedQualitiesForBulk);
    const modeParam = orderMode ? `?mode=${orderMode}` : '';
    
    // For multi-mode: Navigate to first quality's QualityDetails with pending qualities
    if (isMultiMode && selectedQualityNames.length >= 2) {
      const firstQuality = selectedQualityNames[0];
      const pendingQualities = selectedQualityNames.slice(1);
      const pendingParam = `&pendingQualities=${encodeURIComponent(pendingQualities.join(','))}`;
      navigate(`/inventory/${encodeURIComponent(firstQuality)}${modeParam}${pendingParam}`);
    } else {
      // Single mode or fallback: go to BulkSelection
      const modeQueryParam = orderMode ? `&mode=${orderMode}` : '';
      navigate(`/bulk-selection?qualities=${encodeURIComponent(selectedQualityNames.join(','))}${modeQueryParam}`);
    }
  };

  const toggleBulkSelectionMode = () => {
    setBulkSelectionMode(!bulkSelectionMode);
    setSelectedQualitiesForBulk(new Set());
    if (deleteMode) {
      setDeleteMode(false);
      setSelectedItems(new Set());
    }
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let data = pivotData.filter(item => {
      const matchesSearch = item.normalized_quality.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesQuality = !qualityFilter || item.normalized_quality.toLowerCase().includes(qualityFilter.toLowerCase());
      return matchesSearch && matchesQuality;
    });

    // Apply sorting
    if (currentSort?.key && currentSort?.direction) {
      data = [...data].sort((a, b) => {
        const aVal = a[currentSort.key as keyof AggregatedQuality];
        const bVal = b[currentSort.key as keyof AggregatedQuality];
        const direction = currentSort.direction === 'asc' ? 1 : -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * direction;
        }
        return String(aVal).localeCompare(String(bVal)) * direction;
      });
    }

    return data;
  }, [pivotData, searchTerm, qualityFilter, currentSort]);

  // Paginate the data
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedData.slice(start, start + pageSize);
  }, [filteredAndSortedData, page, pageSize]);

  // For backward compatibility
  const filteredData = paginatedData;
  const totalCount = filteredAndSortedData.length;

  // Get unique qualities for the filter dropdown
  const uniqueQualities = [...new Set(pivotData.map(item => item.normalized_quality))].sort();

  // Helper functions for calculations
  const calculatePhysicalReservedForQuality = (item: AggregatedQuality) => {
    if (item.incoming_meters === 0) return item.total_reserved_meters;
    if (item.total_meters === 0) return 0;
    const physicalRatio = item.total_meters / (item.total_meters + item.incoming_meters);
    return Math.round(item.total_reserved_meters * physicalRatio);
  };

  const calculateIncomingReservedForQuality = (item: AggregatedQuality) => {
    return item.total_reserved_meters - calculatePhysicalReservedForQuality(item);
  };

  const calculateTotalAvailable = () => {
    return Number(dashboardStats?.total_meters || 0) + 
           Number(dashboardStats?.total_incoming_meters || 0) - 
           Number(dashboardStats?.total_reserved_meters || 0);
  };

  const handleSort = (key: string, direction: SortDirection) => {
    setCurrentSort(direction ? { key, direction } : null);
    setPage(1);
  };

  const handleExport = () => {
    const exportData = filteredAndSortedData.map(item => ({
      normalized_quality: item.normalized_quality,
      color_count: item.color_count,
      total_meters: item.total_meters,
      incoming_meters: item.incoming_meters,
      total_reserved_meters: item.total_reserved_meters,
      available_meters: item.available_meters,
      total_rolls: item.total_rolls,
      lot_count: item.lot_count
    }));
    exportToCSV(exportData, [
      { key: 'normalized_quality', label: String(t('quality')) },
      { key: 'color_count', label: String(t('colorCount')) },
      { key: 'total_meters', label: String(t('physicalMeters')) },
      { key: 'incoming_meters', label: String(t('incoming')) },
      { key: 'total_reserved_meters', label: String(t('reserved')) },
      { key: 'available_meters', label: String(t('available')) },
      { key: 'total_rolls', label: String(t('rolls')) },
      { key: 'lot_count', label: String(t('lots')) }
    ], 'inventory-pivot-export');
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

  // Determine if we're in single-selection mode
  const isSingleSelectionMode = orderMode === 'single' || orderMode === 'sample';

  return (
    <div className="space-y-6">
      {/* Contextual instruction banner based on order mode */}
      {orderMode && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
          <p className="text-sm text-primary">
            {orderMode === 'single' && t('selectSingleQualityInstruction')}
            {orderMode === 'sample' && t('selectSampleQualityInstruction')}
            {orderMode === 'multi' && t('selectMultiQualityInstruction')}
            {orderMode === 'multi-sample' && t('selectMultiSampleInstruction')}
          </p>
        </div>
      )}

      {/* Search and Controls */}
      <div className="flex items-center justify-between space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={String(t('searchPlaceholder'))}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => { setSearchTerm(''); setPage(1); }}
            >
              ×
            </Button>
          )}
        </div>
        
        {/* Controls - Order matters: bulk selection for all users, delete mode only for admins */}
        <div className="flex items-center space-x-2">
          <TableExportButton onExport={handleExport} disabled={filteredAndSortedData.length === 0} />
          {!deleteMode && !bulkSelectionMode && (
            <>
              <Button variant="default" onClick={toggleBulkSelectionMode}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Sipariş için toplu kalite seç
              </Button>
              {getEffectiveRole() === 'admin' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteMode(!deleteMode);
                    setSelectedItems(new Set());
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {String(t('deleteMode'))}
                </Button>
              )}
            </>
          )}
          
          {bulkSelectionMode && (
            <>
              <Button 
                variant="default" 
                onClick={handleProceedToBulkColorSelection} 
                disabled={selectedQualitiesForBulk.size === 0}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Proceed to Color Selection ({selectedQualitiesForBulk.size})
              </Button>
              <Button variant="outline" onClick={toggleBulkSelectionMode}>
                Cancel Selection
              </Button>
            </>
          )}
          
          {getEffectiveRole() === 'admin' && deleteMode && (
            <>
              {selectedItems.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      {String(t('deleteSelected'))} ({selectedItems.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{String(t('confirmDelete'))}</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedItems.size} selected qualities? {String(t('actionCannotBeUndone'))}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{String(t('cancel'))}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete}>
                        {String(t('delete'))}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button 
                variant="outline" 
                onClick={() => { 
                  setDeleteMode(false); 
                  setSelectedItems(new Set()); 
                }}
              >
                Cancel Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Stats - Row 1: Physical Inventory */}
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
            <CardTitle className="text-sm font-medium">{t('physicalLots')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats?.total_in_stock_lots || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('physicalMeters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(dashboardStats?.total_meters || 0).toFixed(2)}m</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('physicalRolls')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats?.total_rolls || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats - Row 2: Incoming & Reserved */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('incomingMeters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(dashboardStats?.total_incoming_meters || 0).toFixed(2)}m</div>
            <p className="text-xs text-muted-foreground">{t('expectedStockOnTheWay')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('reservedMeters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(dashboardStats?.total_reserved_meters || 0).toFixed(2)}m</div>
            <p className="text-xs text-muted-foreground">{t('activeReservations')}: {dashboardStats?.active_reservations || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('availableMeters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(dashboardStats?.available_meters || 0).toFixed(2)}m</div>
            <p className="text-xs text-muted-foreground">{t('physicalPlusIncomingMinusReserved')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Breakdown
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('incoming')}: {Number(dashboardStats?.total_incoming_meters || 0).toFixed(2)}m</p>
                    <p>{t('reserved')}: {Number(dashboardStats?.total_reserved_meters || 0).toFixed(2)}m</p>
                    <p>{t('available')}: {Number(dashboardStats?.available_meters || 0).toFixed(2)}m</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('incoming')}:</span>
                <span className="font-medium">{Number(dashboardStats?.total_incoming_meters || 0).toFixed(2)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('reserved')}:</span>
                <span className="font-medium">{Number(dashboardStats?.total_reserved_meters || 0).toFixed(2)}m</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="font-semibold">{t('available')}:</span>
                <span className="font-bold text-primary">{Number(dashboardStats?.available_meters || 0).toFixed(2)}m</span>
              </div>
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
          {/* Top Pagination */}
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />

          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                {(deleteMode || bulkSelectionMode) && (
                  <SortableTableHead
                    label=""
                    sortKey=""
                    currentSort={null}
                    onSort={() => {}}
                    className="w-[50px]"
                  />
                )}
                <SortableTableHead
                  label={String(t('quality'))}
                  sortKey="normalized_quality"
                  currentSort={currentSort}
                  onSort={handleSort}
                  filterable
                  filterValue={qualityFilter}
                  onFilterChange={(v) => { setQualityFilter(v); setPage(1); }}
                  filterType="text"
                />
                <SortableTableHead
                  label={String(t('colorCount'))}
                  sortKey="color_count"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('physicalMeters'))}
                  sortKey="total_meters"
                  currentSort={currentSort}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label={String(t('incoming'))}
                  sortKey="incoming_meters"
                  currentSort={currentSort}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label={String(t('reserved'))}
                  sortKey="total_reserved_meters"
                  currentSort={currentSort}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label={String(t('available'))}
                  sortKey="available_meters"
                  currentSort={currentSort}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label={String(t('rolls'))}
                  sortKey="total_rolls"
                  currentSort={currentSort}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label={String(t('lots'))}
                  sortKey="lot_count"
                  currentSort={currentSort}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label={String(t('actions'))}
                  sortKey=""
                  currentSort={null}
                  onSort={() => {}}
                  className="text-right"
                />
                {deleteMode && getEffectiveRole() === 'admin' && (
                  <SortableTableHead
                    label={String(t('delete'))}
                    sortKey=""
                    currentSort={null}
                    onSort={() => {}}
                    className="text-right"
                  />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(deleteMode || bulkSelectionMode) && (
                <TableRow>
                  <TableCell>
                    <Checkbox
                      checked={(deleteMode ? selectedItems.size : selectedQualitiesForBulk.size) > 0 && 
                               (deleteMode ? selectedItems.size : selectedQualitiesForBulk.size) === filteredData.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell colSpan={10} className="text-sm text-muted-foreground">
                    {deleteMode ? t('selectAllForDelete') : t('selectAllForOrder')}
                  </TableCell>
                </TableRow>
              )}
              {filteredData.map((item) => (
                <TableRow key={item.normalized_quality}>
                  {(deleteMode && getEffectiveRole() === 'admin') && (
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(item.normalized_quality)}
                        onCheckedChange={() => handleSelectItem(item.normalized_quality)}
                      />
                    </TableCell>
                  )}
                  {bulkSelectionMode && (
                    <TableCell>
                      <Checkbox
                        checked={selectedQualitiesForBulk.has(item.normalized_quality)}
                        onCheckedChange={() => handleSelectItem(item.normalized_quality)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-sm">
                    {getEffectiveRole() !== 'warehouse_staff' ? (
                      <InlineEditableField
                        value={item.normalized_quality}
                        onSave={(newValue) => handleQualityUpdate(item.normalized_quality, String(newValue))}
                        placeholder="Enter quality"
                      />
                    ) : (
                      item.normalized_quality
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.color_count} {t('differentColors')}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {item.total_meters.toLocaleString()}
                  </TableCell>
                  
                  {/* Incoming Meters */}
                  <TableCell className="text-right text-sm">
                    <span className="text-blue-600 font-medium">
                      {item.incoming_meters.toLocaleString()}
                    </span>
                  </TableCell>
                  
                  {/* Reserved Meters with tooltip */}
                  <TableCell className="text-right text-sm">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-orange-600 font-medium cursor-help underline decoration-dotted">
                            {item.total_reserved_meters.toLocaleString()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            <div className="font-semibold mb-2">Reservation Breakdown:</div>
                            <div className="flex justify-between gap-4">
                              <span>From Physical Stock:</span>
                              <span className="font-semibold">
                                {calculatePhysicalReservedForQuality(item).toLocaleString()}m
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>From Incoming Stock:</span>
                              <span className="font-semibold">
                                {calculateIncomingReservedForQuality(item).toLocaleString()}m
                              </span>
                            </div>
                            <div className="border-t pt-1 mt-1 flex justify-between gap-4">
                              <span>Total Reserved:</span>
                              <span className="font-bold">
                                {item.total_reserved_meters.toLocaleString()}m
                              </span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  
                  {/* Available Meters - color coded */}
                  <TableCell className="text-right text-sm">
                    <span className={`font-bold ${
                      item.available_meters > 100 ? 'text-green-600' :
                      item.available_meters > 0 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {item.available_meters.toLocaleString()}
                    </span>
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
                    onClick={() => navigateToQualityDetails(item.normalized_quality)}
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
                              Are you sure you want to delete all lots for {item.normalized_quality}? {t('actionCannotBeUndone')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteQuality(item.normalized_quality)}>
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
                    colSpan={deleteMode && getEffectiveRole() === 'admin' ? 11 : 10} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    {searchTerm ? t('noSearchResults') : t('noInventoryData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Bottom Pagination */}
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
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