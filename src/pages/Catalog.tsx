import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Search, 
  Plus, 
  Download, 
  Upload,
  Filter,
  ArrowUpDown,
  BookOpen,
  Columns3,
  X
} from 'lucide-react';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { ViewDetailsButton } from '@/components/ui/view-details-button';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CatalogColumnSelector from '@/components/catalog/CatalogColumnSelector';
import CatalogBulkUpload from '@/components/catalog/CatalogBulkUpload';

interface CatalogItem {
  id: string;
  code: string;
  color_name: string;
  description: string | null;
  lastro_sku_code: string;
  logo_sku_code: string | null;
  status: string;
  type: string;
  is_active: boolean;
  composition: any;
  weaving_knitted: string | null;
  fabric_type: string | null;
  weight_g_m2: number | null;
  produced_unit: string;
  sold_unit: string;
  eu_origin: boolean;
  suppliers: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  temporarily_unavailable: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  end_of_life: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending Approval',
  active: 'Active',
  temporarily_unavailable: 'Temporarily Unavailable',
  blocked: 'Blocked',
  end_of_life: 'End of Life',
};

const TYPE_LABELS: Record<string, string> = {
  lining: 'Lining',
  pocketing: 'Pocketing',
  sleeve_lining: 'Sleeve Lining',
  stretch: 'Stretch',
  knee_lining: 'Knee Lining',
};

const ALL_COLUMNS = [
  { key: 'lastro_sku_code', translationKey: 'catalog.columns.lastroSkuCode', default: false },
  { key: 'code', translationKey: 'catalog.columns.code', default: true },
  { key: 'color_name', translationKey: 'catalog.columns.colorName', default: true },
  { key: 'status', translationKey: 'catalog.columns.status', default: true },
  { key: 'type', translationKey: 'catalog.columns.type', default: true },
  { key: 'description', translationKey: 'catalog.columns.description', default: false },
  { key: 'logo_sku_code', translationKey: 'catalog.columns.logoSkuCode', default: false },
  { key: 'composition', translationKey: 'catalog.columns.composition', default: false },
  { key: 'weaving_knitted', translationKey: 'catalog.columns.construction', default: true },
  { key: 'fabric_type', translationKey: 'catalog.columns.fabricType', default: false },
  { key: 'weight_g_m2', translationKey: 'catalog.columns.weight', default: false },
  { key: 'produced_unit', translationKey: 'catalog.columns.producedUnit', default: false },
  { key: 'sold_unit', translationKey: 'catalog.columns.soldUnit', default: false },
  { key: 'eu_origin', translationKey: 'catalog.columns.euOrigin', default: false },
  { key: 'suppliers', translationKey: 'catalog.columns.suppliers', default: true },
  { key: 'created_at', translationKey: 'catalog.columns.created', default: false },
  { key: 'updated_at', translationKey: 'catalog.columns.updated', default: false },
  { key: 'approved_at', translationKey: 'catalog.columns.approved', default: false },
];

// Column filter state type
interface ColumnFilters {
  [key: string]: string;
}

const Catalog: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Check if returning from detail page
  const isReturning = searchParams.get('loaded') === 'true';
  
  // Column selection state - skip selector if returning or columns exist in localStorage
  const savedColumns = localStorage.getItem('catalog_columns');
  const [showColumnSelector, setShowColumnSelector] = useState(() => {
    return !isReturning && !savedColumns;
  });
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    if (savedColumns) {
      try {
        return JSON.parse(savedColumns);
      } catch (e) {
        return ALL_COLUMNS.filter(c => c.default).map(c => c.key);
      }
    }
    return ALL_COLUMNS.filter(c => c.default).map(c => c.key);
  });
  const [dataLoaded, setDataLoaded] = useState(() => isReturning || !!savedColumns);
  
  // Data state
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});

  // Permissions
  const canView = hasPermission('catalog', 'view');
  const canCreate = hasPermission('catalog', 'create');
  const canImport = hasPermission('catalog', 'import');
  const canExport = hasPermission('catalog', 'export');

  // Bulk upload dialog state
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // Calculate dynamic cell padding based on column count
  const cellPadding = selectedColumns.length > 8 ? 'px-2 py-1' : 'px-2 py-1.5';
  const headerPadding = selectedColumns.length > 8 ? 'px-2 py-1' : 'px-2 py-1.5';

  // Fetch data after column selection or on mount if returning
  const fetchData = async () => {
    if (!canView) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('catalog_items')
        .select('*', { count: 'exact' });

      // Apply search filter
      if (searchQuery) {
        query = query.or(`code.ilike.%${searchQuery}%,color_name.ilike.%${searchQuery}%,lastro_sku_code.ilike.%${searchQuery}%,logo_sku_code.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Apply status filter - exclude blocked by default
      if (statusFilter === 'all') {
        query = query.neq('status', 'blocked');
      } else if (statusFilter === 'all_including_blocked') {
        // Show everything including blocked
      } else {
        query = query.eq('status', statusFilter as any);
      }

      // Apply type filter
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter as any);
      }

      // Apply column-specific filters
      Object.entries(columnFilters).forEach(([column, filterValue]) => {
        if (filterValue && filterValue.trim()) {
          if (column === 'status') {
            query = query.eq('status', filterValue as any);
          } else if (column === 'type') {
            query = query.eq('type', filterValue as any);
          } else if (column === 'eu_origin') {
            query = query.eq('eu_origin', filterValue === 'true');
          } else {
            query = query.ilike(column, `%${filterValue}%`);
          }
        }
      });

      // Apply sorting
      query = query.order(sortColumn as any, { ascending: sortDirection === 'asc' });

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setItems((data as any) || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching catalog items:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch catalog items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when filters change or on mount if returning
  useEffect(() => {
    if (dataLoaded) {
      fetchData();
    }
  }, [dataLoaded, searchQuery, statusFilter, typeFilter, sortColumn, sortDirection, page, columnFilters]);

  const handleColumnSelectionConfirm = (columns: string[]) => {
    setSelectedColumns(columns);
    localStorage.setItem('catalog_columns', JSON.stringify(columns));
    setShowColumnSelector(false);
    setDataLoaded(true);
    // Update URL to mark as loaded
    setSearchParams({ loaded: 'true' });
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const handleRowClick = (item: CatalogItem) => {
    navigate(`/catalog/${item.id}?returnLoaded=true`);
  };

  const handleColumnFilter = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
    setPage(1);
  };

  const clearColumnFilter = (column: string) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[column];
      return newFilters;
    });
    setPage(1);
  };

  const handleExport = async () => {
    try {
      // Fetch all filtered data for export
      let query = supabase.from('catalog_items').select('*');
      
      if (searchQuery) {
        query = query.or(`code.ilike.%${searchQuery}%,color_name.ilike.%${searchQuery}%,lastro_sku_code.ilike.%${searchQuery}%`);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Convert to CSV
      const headers = selectedColumns.map(col => {
        const colDef = ALL_COLUMNS.find(c => c.key === col);
        return colDef ? t(colDef.translationKey) : col;
      });
      const rows = data?.map(item =>
        selectedColumns.map(col => {
          const value = item[col as keyof typeof item];
          if (col === 'composition' && Array.isArray(value)) {
            return value.map((c: any) => `${c.fiber} ${c.percent}%`).join(', ');
          }
          if (typeof value === 'boolean') return value ? 'Yes' : 'No';
          if (value === null) return '';
          return String(value);
        })
      ) || [];

      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catalog_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Success', description: 'Catalog exported successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const renderCellValue = (item: CatalogItem, column: string) => {
    const value = item[column as keyof CatalogItem];

    switch (column) {
      case 'status':
        return (
          <Badge className={`${STATUS_COLORS[value as string] || ''} text-xs`}>
            {STATUS_LABELS[value as string] || value}
          </Badge>
        );
      case 'type':
        return <span className="text-xs">{TYPE_LABELS[value as string] || value}</span>;
      case 'composition':
        if (Array.isArray(value) && value.length > 0) {
          return <span className="text-xs">{value.map((c: any) => `${c.fiber} ${c.percent}%`).join(', ')}</span>;
        }
        return '-';
      case 'eu_origin':
        return value ? '✓' : '-';
      case 'created_at':
      case 'updated_at':
      case 'approved_at':
        return value ? <span className="text-xs">{new Date(value as string).toLocaleDateString()}</span> : '-';
      case 'weight_g_m2':
        return value ? <span className="text-xs">{value} g/m²</span> : '-';
      case 'lastro_sku_code':
        return <span className="font-mono text-xs">{value}</span>;
      default:
        return <span className="text-xs">{value || '-'}</span>;
    }
  };

  const renderColumnFilterPopover = (column: string) => {
    const currentFilter = columnFilters[column] || '';
    
    // Get filter options based on column type
    if (column === 'status') {
      return (
        <div className="space-y-2 p-2">
          <Select value={currentFilter} onValueChange={(v) => handleColumnFilter(column, v)}>
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder={t('catalog.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('catalog.allStatuses')}</SelectItem>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentFilter && (
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => clearColumnFilter(column)}>
              <X className="h-3 w-3 mr-1" /> {t('clearFilters')}
            </Button>
          )}
        </div>
      );
    }
    
    if (column === 'type') {
      return (
        <div className="space-y-2 p-2">
          <Select value={currentFilter} onValueChange={(v) => handleColumnFilter(column, v)}>
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder={t('catalog.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('catalog.allTypes')}</SelectItem>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentFilter && (
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => clearColumnFilter(column)}>
              <X className="h-3 w-3 mr-1" /> {t('clearFilters')}
            </Button>
          )}
        </div>
      );
    }
    
    if (column === 'eu_origin') {
      return (
        <div className="space-y-2 p-2">
          <Select value={currentFilter} onValueChange={(v) => handleColumnFilter(column, v)}>
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder={t('all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('all')}</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
          {currentFilter && (
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => clearColumnFilter(column)}>
              <X className="h-3 w-3 mr-1" /> {t('clearFilters')}
            </Button>
          )}
        </div>
      );
    }
    
    // Default text filter
    return (
      <div className="space-y-2 p-2">
        <Input
          placeholder={`${t('filter')}...`}
          value={currentFilter}
          onChange={(e) => handleColumnFilter(column, e.target.value)}
          className="h-8 text-xs"
        />
        {currentFilter && (
          <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => clearColumnFilter(column)}>
            <X className="h-3 w-3 mr-1" /> {t('clearFilters')}
          </Button>
        )}
      </div>
    );
  };

  // Show column selector first
  if (showColumnSelector) {
    return (
      <CatalogColumnSelector
        allColumns={ALL_COLUMNS}
        selectedColumns={selectedColumns}
        onConfirm={handleColumnSelectionConfirm}
        onCancel={() => navigate(-1)}
      />
    );
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">{t('catalog.title')}</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowColumnSelector(true)}
            className="h-8"
          >
            <Columns3 className="h-3.5 w-3.5 mr-1.5" />
            {t('catalog.columnsButton')}
          </Button>
          
          {canExport && (
            <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t('export')}
            </Button>
          )}
          
          {canImport && (
            <Button variant="outline" size="sm" onClick={() => setBulkUploadOpen(true)} className="h-8">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {t('catalog.import')}
            </Button>
          )}
          
          {canCreate && (
            <Button size="sm" onClick={() => navigate('/catalog/new')} className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('catalog.create')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters + Top Pagination */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t('catalog.searchPlaceholder') as string}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[150px] h-8 text-sm">
                  <SelectValue placeholder={t('catalog.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('catalog.allStatuses')}</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[150px] h-8 text-sm">
                  <SelectValue placeholder={t('catalog.allTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('catalog.allTypes')}</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Top Pagination */}
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <BookOpen className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">{t('catalog.noItems')}</p>
              {canCreate && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/catalog/new')}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {t('catalog.createFirst')}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="h-8">
                    {selectedColumns.map(col => {
                      const colDef = ALL_COLUMNS.find(c => c.key === col);
                      const hasFilter = !!columnFilters[col];
                      return (
                        <TableHead 
                          key={col}
                          className={`${headerPadding} text-xs font-medium`}
                        >
                          <div className="flex items-center gap-1">
                            <span 
                              className="cursor-pointer hover:text-foreground"
                              onClick={() => handleSort(col)}
                            >
                              {colDef ? t(colDef.translationKey) : col}
                            </span>
                            {sortColumn === col && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className={`h-5 w-5 p-0 ${hasFilter ? 'text-primary' : 'text-muted-foreground'}`}>
                                  <Filter className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-0" align="start">
                                {renderColumnFilterPopover(col)}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </TableHead>
                      );
                    })}
                    <TableHead className={`w-20 ${headerPadding}`}></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow 
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50 h-8"
                      onClick={() => handleRowClick(item)}
                    >
                      {selectedColumns.map(col => (
                        <TableCell key={col} className={cellPadding}>
                          {renderCellValue(item, col)}
                        </TableCell>
                      ))}
                      <TableCell className={cellPadding}>
                        <ViewDetailsButton onClick={() => {}} showLabel={true} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Bottom Pagination */}
          <div className="p-3 border-t">
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bulk Upload Dialog */}
      <CatalogBulkUpload
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default Catalog;