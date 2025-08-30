import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Package, 
  Calendar,
  ArrowUpDown,
  CheckSquare,
  Square
} from 'lucide-react';

interface Lot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  entry_date: string;
  status: string;
  supplier_id: string;
  suppliers?: { name: string };
}

interface InventoryExcelProps {
  mode?: 'view' | 'select';
  onLotSelect?: (lots: Lot[]) => void;
  selectedLots?: string[];
}

const InventoryExcel: React.FC<InventoryExcelProps> = ({ 
  mode = 'view', 
  onLotSelect, 
  selectedLots = [] 
}) => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [filteredLots, setFilteredLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<keyof Lot>('entry_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedItems, setSelectedItems] = useState<string[]>(selectedLots);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  
  const { t } = useLanguage();
  const { toast } = useToast();

  // Get unique values for filters
  const qualities = [...new Set(lots.map(lot => lot.quality))];
  const colors = [...new Set(lots.map(lot => lot.color))];
  const statuses = [...new Set(lots.map(lot => lot.status))];

  useEffect(() => {
    fetchLots();
  }, []);

  useEffect(() => {
    filterAndSort();
  }, [lots, searchTerm, qualityFilter, colorFilter, statusFilter, sortField, sortDirection]);

  const fetchLots = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          *,
          suppliers (name)
        `)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setLots(data || []);
    } catch (error) {
      console.error('Error fetching lots:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch inventory data.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSort = () => {
    let filtered = lots.filter(lot => {
      const matchesSearch = 
        lot.lot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lot.quality.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lot.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lot.suppliers?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesQuality = !qualityFilter || qualityFilter === 'all' || lot.quality === qualityFilter;
      const matchesColor = !colorFilter || colorFilter === 'all' || lot.color === colorFilter;
      
      return matchesSearch && matchesQuality && matchesColor;
    });

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredLots(filtered);
    setCurrentPage(1);
  };

  const handleSort = (field: keyof Lot) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    const currentPageLots = getCurrentPageLots();
    const currentPageIds = currentPageLots.map(lot => lot.id);
    
    if (currentPageIds.every(id => selectedItems.includes(id))) {
      // Deselect all on current page
      setSelectedItems(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // Select all on current page
      setSelectedItems(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  const handleSelectLot = (lotId: string) => {
    setSelectedItems(prev => 
      prev.includes(lotId) 
        ? prev.filter(id => id !== lotId)
        : [...prev, lotId]
    );
  };

  const getCurrentPageLots = () => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLots.slice(startIndex, startIndex + pageSize);
  };

  const totalPages = Math.ceil(filteredLots.length / pageSize);

  const exportToCSV = () => {
    const csvData = filteredLots.map(lot => ({
      'Lot Number': lot.lot_number,
      'Quality': lot.quality,
      'Color': lot.color,
      'Meters': lot.meters,
      'Roll Count': lot.roll_count,
      'Entry Date': lot.entry_date,
      'Status': lot.status,
      'Supplier': lot.suppliers?.name || ''
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Import the utility functions
    const { parseCSVFile, importLotsToDatabase } = await import('@/utils/excelImport');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csv = e.target?.result as string;
        
        toast({
          title: t('importStarted') as string,
          description: `Processing CSV file...`
        });

        // Parse CSV
        const lots = parseCSVFile(csv);
        
        // Import to database
        const result = await importLotsToDatabase(lots);
        
        if (result.success) {
          toast({
            title: t('success') as string,
            description: result.message
          });
          
          // Refresh data
          fetchLots();
        } else {
          toast({
            title: t('importError') as string,
            description: result.message,
            variant: 'destructive'
          });
        }
        
      } catch (error: any) {
        toast({
          title: t('importError') as string,
          description: error.message,
          variant: 'destructive'
        });
      }
    };
    reader.readAsText(file);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'in_stock' ? 'default' : 'secondary';
    return <Badge variant={variant}>{status.replace('_', ' ').toUpperCase()}</Badge>;
  };

  const currentPageLots = getCurrentPageLots();

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={t('searchPlaceholder') as string}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <Select value={qualityFilter} onValueChange={setQualityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Qualities</SelectItem>
              {qualities.map(quality => (
                <SelectItem key={quality} value={quality}>{quality}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={colorFilter} onValueChange={setColorFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Color" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colors</SelectItem>
              {colors.map(color => (
                <SelectItem key={color} value={color}>{color}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map(status => (
                <SelectItem key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => import('@/utils/excelImport').then(({ generateExcelTemplate }) => generateExcelTemplate())}>
            <Download className="h-4 w-4 mr-2" />
            {t('downloadTemplate')}
          </Button>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleImportCSV}
            className="hidden"
            id="csv-upload"
          />
          <Button variant="outline" onClick={() => document.getElementById('csv-upload')?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {t('importExcel')}
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            {t('export')}
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredLots.length)} of {filteredLots.length} lots
        {mode === 'select' && selectedItems.length > 0 && (
          <span className="ml-4 font-medium">
            {selectedItems.length} selected
          </span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {mode === 'select' && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={currentPageLots.length > 0 && currentPageLots.every(lot => selectedItems.includes(lot.id))}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('lot_number')} className="h-8 p-1">
                    Lot Number <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('quality')} className="h-8 p-1">
                    Quality <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('color')} className="h-8 p-1">
                    Color <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('meters')} className="h-8 p-1">
                    Meters <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Rolls</TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('entry_date')} className="h-8 p-1">
                    Entry Date <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageLots.map((lot) => (
                <TableRow key={lot.id}>
                  {mode === 'select' && (
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.includes(lot.id)}
                        onCheckedChange={() => handleSelectLot(lot.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{lot.lot_number}</TableCell>
                  <TableCell>{lot.quality}</TableCell>
                  <TableCell>{lot.color}</TableCell>
                  <TableCell>{lot.meters.toLocaleString()}</TableCell>
                  <TableCell>{lot.roll_count}</TableCell>
                  <TableCell>{formatDate(lot.entry_date)}</TableCell>
                  <TableCell>{lot.suppliers?.name || '-'}</TableCell>
                  <TableCell>{getStatusBadge(lot.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Selection Actions */}
      {mode === 'select' && selectedItems.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg">
          <div className="flex items-center gap-4">
            <span>{selectedItems.length} lots selected</span>
            <Button 
              variant="secondary"
              onClick={() => {
                if (onLotSelect) {
                  const selectedLotObjects = lots.filter(lot => selectedItems.includes(lot.id));
                  onLotSelect(selectedLotObjects);
                }
              }}
            >
              Add to Order
            </Button>
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setSelectedItems([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryExcel;