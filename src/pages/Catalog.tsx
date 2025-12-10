import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Settings2, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  ArrowUpDown,
  BookOpen,
  Columns3,
  Eye
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CatalogColumnSelector from '@/components/catalog/CatalogColumnSelector';
import CatalogFilters from '@/components/catalog/CatalogFilters';
import CatalogCustomFieldsAdmin from '@/components/catalog/CatalogCustomFieldsAdmin';

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
  { key: 'lastro_sku_code', label: 'LTA SKU', default: true },
  { key: 'code', label: 'Quality Code', default: true },
  { key: 'color_name', label: 'Color', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'type', label: 'Type', default: true },
  { key: 'description', label: 'Description', default: false },
  { key: 'logo_sku_code', label: 'Logo SKU', default: false },
  { key: 'composition', label: 'Composition', default: false },
  { key: 'weaving_knitted', label: 'Construction', default: true },
  { key: 'weight_g_m2', label: 'Weight (g/m²)', default: false },
  { key: 'produced_unit', label: 'Produced Unit', default: false },
  { key: 'sold_unit', label: 'Sold Unit', default: false },
  { key: 'eu_origin', label: 'EU Origin', default: false },
  { key: 'suppliers', label: 'Suppliers', default: true },
  { key: 'created_at', label: 'Created', default: false },
  { key: 'updated_at', label: 'Updated', default: false },
  { key: 'approved_at', label: 'Approved', default: false },
];

const Catalog: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Column selection state
  const [showColumnSelector, setShowColumnSelector] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    ALL_COLUMNS.filter(c => c.default).map(c => c.key)
  );
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Data state
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);

  // Permissions
  // Permissions
  const canView = hasPermission('catalog', 'view');
  const canCreate = hasPermission('catalog', 'create');
  const canImport = hasPermission('catalog', 'import');
  const canExport = hasPermission('catalog', 'export');
  const canManageFields = hasPermission('catalog', 'manage_custom_fields');

  // Custom fields dialog state
  const [customFieldsDialogOpen, setCustomFieldsDialogOpen] = useState(false);

  // Load saved view from URL or localStorage
  useEffect(() => {
    const savedColumns = localStorage.getItem('catalog_columns');
    if (savedColumns) {
      try {
        setSelectedColumns(JSON.parse(savedColumns));
      } catch (e) {
        // Use defaults
      }
    }
  }, []);

  // Fetch data after column selection
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

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      // Apply type filter
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter as any);
      }

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

  // Fetch data when filters change
  useEffect(() => {
    if (dataLoaded) {
      fetchData();
    }
  }, [dataLoaded, searchQuery, statusFilter, typeFilter, sortColumn, sortDirection, page]);

  const handleColumnSelectionConfirm = (columns: string[]) => {
    setSelectedColumns(columns);
    localStorage.setItem('catalog_columns', JSON.stringify(columns));
    setShowColumnSelector(false);
    setDataLoaded(true);
    fetchData();
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
    navigate(`/catalog/${item.id}`);
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
      const headers = selectedColumns.map(col => ALL_COLUMNS.find(c => c.key === col)?.label || col);
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
          <Badge className={STATUS_COLORS[value as string] || ''}>
            {STATUS_LABELS[value as string] || value}
          </Badge>
        );
      case 'type':
        return TYPE_LABELS[value as string] || value;
      case 'composition':
        if (Array.isArray(value) && value.length > 0) {
          return value.map((c: any) => `${c.fiber} ${c.percent}%`).join(', ');
        }
        return '-';
      case 'eu_origin':
        return value ? '✓' : '-';
      case 'created_at':
      case 'updated_at':
      case 'approved_at':
        return value ? new Date(value as string).toLocaleDateString() : '-';
      case 'weight_g_m2':
        return value ? `${value} g/m²` : '-';
      case 'lastro_sku_code':
        return <span className="font-mono text-xs">{value}</span>;
      default:
        return value || '-';
    }
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('catalog.title')}</h1>
          <Badge variant="outline">{totalCount} {t('catalog.items')}</Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowColumnSelector(true)}
          >
            <Columns3 className="h-4 w-4 mr-2" />
            {t('catalog.columns')}
          </Button>
          
          {canExport && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              {t('export')}
            </Button>
          )}
          
          {canImport && (
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              {t('catalog.import')}
            </Button>
          )}
          
          {canManageFields && (
            <Button variant="outline" size="sm" onClick={() => setCustomFieldsDialogOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              {t('catalog.customFields')}
            </Button>
          )}
          
          {canCreate && (
            <Button size="sm" onClick={() => navigate('/catalog/new')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('catalog.create')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('catalog.searchPlaceholder') as string}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
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
              <SelectTrigger className="w-[180px]">
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
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <BookOpen className="h-12 w-12 mb-4 opacity-50" />
              <p>{t('catalog.noItems')}</p>
              {canCreate && (
                <Button variant="outline" className="mt-4" onClick={() => navigate('/catalog/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('catalog.createFirst')}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectedColumns.map(col => {
                      const colDef = ALL_COLUMNS.find(c => c.key === col);
                      return (
                        <TableHead 
                          key={col}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort(col)}
                        >
                          <div className="flex items-center gap-1">
                            {colDef?.label || col}
                            {sortColumn === col && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow 
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(item)}
                    >
                      {selectedColumns.map(col => (
                        <TableCell key={col}>
                          {renderCellValue(item, col)}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                {t('showing')} {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} {t('of')} {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {t('page')} {page} {t('of')} {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Fields Admin Dialog */}
      <CatalogCustomFieldsAdmin
        open={customFieldsDialogOpen}
        onOpenChange={setCustomFieldsDialogOpen}
      />
    </div>
  );
};

export default Catalog;
