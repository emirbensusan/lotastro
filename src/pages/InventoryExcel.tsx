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
import { useNavigate } from 'react-router-dom';
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
  Square,
  ShoppingCart,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
  invoice_number?: string;
  invoice_date?: string;
}

interface InventoryExcelProps {
  mode?: 'view' | 'select';
  onLotSelect?: (lots: Lot[]) => void;
  selectedLots?: string[];
}

// Create Order Actions Component
const CreateOrderActions = ({ selectedItems, lots, onClear, onLotSelect }: {
  selectedItems: string[];
  lots: Lot[];
  onClear: () => void;
  onLotSelect?: (lots: Lot[]) => void;
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleCreateOrder = () => {
    const selectedLotObjects = lots.filter(lot => selectedItems.includes(lot.id));
    // Navigate to orders page with pre-filled data
    navigate('/orders', { 
      state: { 
        prefilledLots: selectedLotObjects.map(lot => ({
          lotId: lot.id,
          quality: lot.quality,
          color: lot.color,
          lotNumber: lot.lot_number,
          meters: lot.meters,
          availableRolls: lot.roll_count,
          rollCount: 1,
          lineType: 'standard' as const
        }))
      }
    });
  };

  return (
    <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg">
      <div className="flex items-center gap-4">
        <span>{selectedItems.length} {t('selectedLots')}</span>
        <Button 
          variant="secondary"
          onClick={handleCreateOrder}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          {t('createOrder')}
        </Button>
        {onLotSelect && (
          <Button 
            variant="secondary"
            onClick={() => {
              const selectedLotObjects = lots.filter(lot => selectedItems.includes(lot.id));
              onLotSelect(selectedLotObjects);
            }}
          >
            {t('addToOrder')}
          </Button>
        )}
        <Button 
          variant="ghost"
          size="sm"
          onClick={onClear}
        >
          {t('clear')}
        </Button>
      </div>
    </div>
  );
};

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
  const [statusFilter, setStatusFilter] = useState('in_stock');
  const [sortField, setSortField] = useState<keyof Lot>('entry_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedItems, setSelectedItems] = useState<string[]>(selectedLots);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  
  const [expandedQualities, setExpandedQualities] = useState<Set<string>>(new Set());
  const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
  
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Group lots by quality -> color -> lots
  const groupedData = React.useMemo(() => {
    const groups: Record<string, Record<string, Lot[]>> = {};
    
    filteredLots.forEach(lot => {
      if (!groups[lot.quality]) {
        groups[lot.quality] = {};
      }
      if (!groups[lot.quality][lot.color]) {
        groups[lot.quality][lot.color] = [];
      }
      groups[lot.quality][lot.color].push(lot);
    });
    
    return groups;
  }, [filteredLots]);

  const toggleQuality = (quality: string) => {
    const newExpanded = new Set(expandedQualities);
    if (newExpanded.has(quality)) {
      newExpanded.delete(quality);
      // Also collapse all colors under this quality
      Object.keys(groupedData[quality] || {}).forEach(color => {
        const colorKey = `${quality}-${color}`;
        expandedColors.delete(colorKey);
      });
      setExpandedColors(new Set(expandedColors));
    } else {
      newExpanded.add(quality);
    }
    setExpandedQualities(newExpanded);
  };

  const toggleColor = (quality: string, color: string) => {
    const colorKey = `${quality}-${color}`;
    const newExpanded = new Set(expandedColors);
    if (newExpanded.has(colorKey)) {
      newExpanded.delete(colorKey);
    } else {
      newExpanded.add(colorKey);
    }
    setExpandedColors(newExpanded);
  };

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
      const matchesStatus = !statusFilter || statusFilter === 'all' || lot.status === statusFilter;
      
      return matchesSearch && matchesQuality && matchesColor && matchesStatus;
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

  const handleDeleteLot = async (lotId: string, lotNumber: string) => {
    try {
      const { error } = await supabase
        .from('lots')
        .delete()
        .eq('id', lotId);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: `${t('lotNumber')}: ${lotNumber} ${t('deletedSuccessfully')}`
      });

      // Remove from selected items if it was selected
      setSelectedItems(prev => prev.filter(id => id !== lotId));
      
      // Refresh data
      fetchLots();
    } catch (error: any) {
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive'
      });
    }
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
                <SelectValue placeholder={t('quality')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allQualities')}</SelectItem>
              {qualities.map(quality => (
                <SelectItem key={quality} value={quality}>{quality}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={colorFilter} onValueChange={setColorFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('color')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allColors')}</SelectItem>
              {colors.map(color => (
                <SelectItem key={color} value={color}>{color}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
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
        {t('showing')} {Object.keys(groupedData).length} {(t('quality') as string).toLowerCase()}, {Object.values(groupedData).flatMap(colors => Object.keys(colors)).length} {(t('color') as string).toLowerCase()}, {filteredLots.length} {(t('lots') as string).toLowerCase()}
        {selectedItems.length > 0 && (
          <span className="ml-4 font-medium">
            {selectedItems.length} {t('selected')}
          </span>
        )}
      </div>

      {/* Hierarchical Inventory Structure */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {selectedItems.length > 0 && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={currentPageLots.length > 0 && currentPageLots.every(lot => selectedItems.includes(lot.id))}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>{t('quality')}</TableHead>
                <TableHead>{t('color')}</TableHead>
                <TableHead>{t('lotNumber')}</TableHead>
                <TableHead>{t('meters')}</TableHead>
                <TableHead>{t('rolls')}</TableHead>
                <TableHead>{t('entryDate')}</TableHead>
                <TableHead>{t('supplier')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('invoiceNumber')}</TableHead>
                {profile?.role === 'admin' && <TableHead className="w-20">{t('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedData).map(([quality, colors]) => {
                const isQualityExpanded = expandedQualities.has(quality);
                const qualityLots = Object.values(colors).flat();
                const qualityTotalLots = qualityLots.length;
                const qualityTotalMeters = qualityLots.reduce((sum, lot) => sum + lot.meters, 0);
                const qualityTotalRolls = qualityLots.reduce((sum, lot) => sum + lot.roll_count, 0);
                const qualityEarliestDate = qualityLots.reduce((earliest, lot) => 
                  new Date(lot.entry_date) < new Date(earliest) ? lot.entry_date : earliest, 
                  qualityLots[0]?.entry_date || ''
                );
                const qualitySuppliers = [...new Set(qualityLots.map(lot => lot.suppliers?.name).filter(Boolean))];
                const qualitySupplierText = qualitySuppliers.length > 1 ? t('multiple') : qualitySuppliers[0] || '-';
                
                return (
                  <React.Fragment key={quality}>
                    {/* Quality Row */}
                    <TableRow 
                      className="bg-muted/50 font-semibold cursor-pointer hover:bg-muted/70"
                      onClick={() => toggleQuality(quality)}
                    >
                      {selectedItems.length > 0 && <TableCell></TableCell>}
                      <TableCell className="flex items-center">
                        <span className="mr-2">
                          {isQualityExpanded ? '▼' : '▶'}
                        </span>
                        <Package className="h-4 w-4 mr-2" />
                        {quality} ({Object.keys(colors).length} colors, {qualityTotalLots} lots)
                      </TableCell>
                      <TableCell className="text-muted-foreground">{Object.keys(colors).length} colors</TableCell>
                      <TableCell className="text-muted-foreground">{qualityTotalLots} lots</TableCell>
                      <TableCell className="font-medium">{qualityTotalMeters.toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{qualityTotalRolls}</TableCell>
                      <TableCell>{formatDate(qualityEarliestDate)}</TableCell>
                      <TableCell>{qualitySupplierText}</TableCell>
                      <TableCell><Badge variant="default">IN STOCK</Badge></TableCell>
                      <TableCell>{qualityLots.filter(lot => lot.invoice_number).length > 0 ? 
                        qualityLots.filter(lot => lot.invoice_number).length + ' invoices' : '-'}</TableCell>
                    </TableRow>
                    
                    {/* Color Rows */}
                    {isQualityExpanded && Object.entries(colors).map(([color, lots]) => {
                      const colorKey = `${quality}-${color}`;
                      const isColorExpanded = expandedColors.has(colorKey);
                      const colorTotalMeters = lots.reduce((sum, lot) => sum + lot.meters, 0);
                      const colorTotalRolls = lots.reduce((sum, lot) => sum + lot.roll_count, 0);
                      const colorEarliestDate = lots.reduce((earliest, lot) => 
                        new Date(lot.entry_date) < new Date(earliest) ? lot.entry_date : earliest, 
                        lots[0]?.entry_date || ''
                      );
                      const colorSuppliers = [...new Set(lots.map(lot => lot.suppliers?.name).filter(Boolean))];
                      const colorSupplierText = colorSuppliers.length > 1 ? t('multiple') : colorSuppliers[0] || '-';
                      
                      return (
                        <React.Fragment key={colorKey}>
                          {/* Color Row */}
                          <TableRow 
                            className="bg-muted/25 cursor-pointer hover:bg-muted/40"
                            onClick={() => toggleColor(quality, color)}
                          >
                            {selectedItems.length > 0 && <TableCell></TableCell>}
                            <TableCell className="pl-8"></TableCell>
                            <TableCell className="flex items-center">
                              <span className="mr-2">
                                {isColorExpanded ? '▼' : '▶'}
                              </span>
                              <div 
                                className="w-4 h-4 rounded mr-2 border"
                                style={{ backgroundColor: color.toLowerCase() }}
                              ></div>
                              {color} ({lots.length} lots)
                            </TableCell>
                            <TableCell className="text-muted-foreground">{lots.length} lots</TableCell>
                             <TableCell className="font-medium">{colorTotalMeters.toLocaleString()}</TableCell>
                             <TableCell className="font-medium">{colorTotalRolls}</TableCell>
                             <TableCell>{formatDate(colorEarliestDate)}</TableCell>
                             <TableCell>{colorSupplierText}</TableCell>
                             <TableCell><Badge variant="default">IN STOCK</Badge></TableCell>
                             <TableCell>{lots.filter(lot => lot.invoice_number).length > 0 ? 
                               lots.filter(lot => lot.invoice_number).length + ' invoices' : '-'}</TableCell>
                          </TableRow>
                          
                          {/* LOT Rows */}
                          {isColorExpanded && lots.map((lot) => (
                            <TableRow key={lot.id} className="hover:bg-muted/10">
                              {selectedItems.length > 0 && (
                                <TableCell>
                                  <Checkbox
                                    checked={selectedItems.includes(lot.id)}
                                    onCheckedChange={() => handleSelectLot(lot.id)}
                                  />
                                </TableCell>
                              )}
                              <TableCell className="pl-8"></TableCell>
                              <TableCell className="pl-8"></TableCell>
                              <TableCell className="font-medium pl-8">{lot.lot_number}</TableCell>
                              <TableCell>{lot.meters.toLocaleString()}</TableCell>
                              <TableCell>{lot.roll_count}</TableCell>
                               <TableCell>{formatDate(lot.entry_date)}</TableCell>
                               <TableCell>{lot.suppliers?.name || '-'}</TableCell>
                                <TableCell>{getStatusBadge(lot.status)}</TableCell>
                                <TableCell>{lot.invoice_number || '-'}</TableCell>
                                {profile?.role === 'admin' && (
                                  <TableCell>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {t('confirmDeleteLot')} {lot.lot_number}? {t('actionCannotBeUndone')}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                          <AlertDialogAction 
                                            onClick={() => handleDeleteLot(lot.id, lot.lot_number)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
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
      {selectedItems.length > 0 && (
        <CreateOrderActions 
          selectedItems={selectedItems}
          lots={lots}
          onClear={() => setSelectedItems([])}
          onLotSelect={onLotSelect}
        />
      )}
    </div>
  );
};

export default InventoryExcel;