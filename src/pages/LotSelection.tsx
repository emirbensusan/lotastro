import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Package, Filter } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';

interface Lot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  status: string;
  entry_date: string;
  supplier_id: string;
  suppliers?: {
    name: string;
  };
}

interface SelectedLot {
  lotId: string;
  quality: string;
  color: string;
  lotNumber: string;
  meters: number;
  availableRolls: number;
  rollCount: number;
  lineType: 'sample' | 'standard';
}

const LotSelection = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  
  const quality = searchParams.get('quality') || '';
  const color = searchParams.get('color') || '';
  
  const [lots, setLots] = useState<Lot[]>([]);
  const [filteredLots, setFilteredLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLots, setSelectedLots] = useState<SelectedLot[]>([]);
  
  // Filters
  const [dateFilter, setDateFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!quality || !color) {
      navigate('/orders');
      return;
    }
    fetchLots();
    fetchSuppliers();
  }, [quality, color]);

  useEffect(() => {
    applyFilters();
  }, [lots, dateFilter, supplierFilter, searchTerm]);

  const fetchLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          *,
          suppliers (
            name
          )
        `)
        .eq('status', 'in_stock')
        .eq('quality', quality)
        .eq('color', color)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setLots(data || []);
    } catch (error) {
      console.error('Error fetching lots:', error);
      toast({
        title: t('error') as string,
        description: "Failed to load lots",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...lots];

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setDate(now.getDate());
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(lot => new Date(lot.entry_date) >= filterDate);
    }

    // Supplier filter
    if (supplierFilter !== 'all') {
      filtered = filtered.filter(lot => lot.supplier_id === supplierFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lot => 
        lot.lot_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLots(filtered);
  };

  const toggleLotSelection = (lot: Lot) => {
    const isSelected = selectedLots.some(sl => sl.lotId === lot.id);
    
    if (isSelected) {
      setSelectedLots(prev => prev.filter(sl => sl.lotId !== lot.id));
    } else {
      setSelectedLots(prev => [...prev, {
        lotId: lot.id,
        quality: lot.quality,
        color: lot.color,
        lotNumber: lot.lot_number,
        meters: lot.meters,
        availableRolls: lot.roll_count,
        rollCount: 1,
        lineType: 'standard'
      }]);
    }
  };

  const updateRollCount = (lotId: string, rollCount: number) => {
    setSelectedLots(prev => prev.map(sl => 
      sl.lotId === lotId ? { ...sl, rollCount } : sl
    ));
  };

  const updateLineType = (lotId: string, lineType: 'sample' | 'standard') => {
    setSelectedLots(prev => prev.map(sl => 
      sl.lotId === lotId ? { ...sl, lineType } : sl
    ));
  };

  const proceedToOrder = () => {
    if (selectedLots.length === 0) {
      toast({
        title: t('validationError') as string,
        description: "Please select at least one lot",
        variant: "destructive",
      });
      return;
    }

    navigate('/orders', {
      state: {
        prefilledLots: selectedLots,
        quality,
        color
      }
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
          <h1 className="text-3xl font-bold">Select Lots</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToOrders')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('selectLots')}</h1>
            <p className="text-muted-foreground">
              {t('quality')}: <span className="font-medium">{quality}</span> | {t('color')}: <span className="font-medium">{color}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Package className="h-8 w-8 text-primary" />
          <Badge variant="secondary">
            {selectedLots.length} {t('selected')}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            {t('filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t('search')}</Label>
              <Input
                placeholder={t('searchLots') as string}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('dateRange')}</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allDates')}</SelectItem>
                  <SelectItem value="today">{t('today')}</SelectItem>
                  <SelectItem value="week">{t('lastWeek')}</SelectItem>
                  <SelectItem value="month">{t('lastMonth')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('supplier')}</Label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allSuppliers')}</SelectItem>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setDateFilter('all');
                  setSupplierFilter('all');
                  setSearchTerm('');
                }}
              >
                {t('clearFilters')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lots Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('availableLots')} ({filteredLots.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('select')}</TableHead>
                <TableHead>{t('lotNumber')}</TableHead>
                <TableHead>{t('supplier')}</TableHead>
                <TableHead>{t('meters')}</TableHead>
                <TableHead>{t('rollCount')}</TableHead>
                <TableHead>{t('entryDate')}</TableHead>
                <TableHead>{t('rollsToOrder')}</TableHead>
                <TableHead>{t('type')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLots.map((lot) => {
                const isSelected = selectedLots.some(sl => sl.lotId === lot.id);
                const selectedLot = selectedLots.find(sl => sl.lotId === lot.id);
                
                return (
                  <TableRow 
                    key={lot.id} 
                    className={isSelected ? "bg-primary/5" : ""}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLotSelection(lot)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-mono">{lot.lot_number}</TableCell>
                    <TableCell>{lot.suppliers?.name || 'Unknown'}</TableCell>
                    <TableCell>{lot.meters.toFixed(2)} m</TableCell>
                    <TableCell>{lot.roll_count}</TableCell>
                    <TableCell>{format(new Date(lot.entry_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      {isSelected && (
                        <Input
                          type="number"
                          min="1"
                          max={lot.roll_count}
                          value={selectedLot?.rollCount || 1}
                          onChange={(e) => updateRollCount(lot.id, parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {isSelected && (
                        <Select
                          value={selectedLot?.lineType || 'standard'}
                          onValueChange={(value: 'sample' | 'standard') => updateLineType(lot.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">{t('standard')}</SelectItem>
                            <SelectItem value="sample">{t('sample')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredLots.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {t('noLotsAvailable')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Lots Summary */}
      {selectedLots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('selectedLotsSummary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {selectedLots.map((selectedLot) => {
                const lot = lots.find(l => l.id === selectedLot.lotId);
                return (
                  <div key={selectedLot.lotId} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="font-mono">{selectedLot.lotNumber}</span>
                    <span>{selectedLot.rollCount} rolls ({selectedLot.lineType})</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setSelectedLots([])}>
                {t('clearSelection')}
              </Button>
              <Button onClick={proceedToOrder}>
                {t('proceedToOrder')} ({selectedLots.length} {t('lots')})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LotSelection;