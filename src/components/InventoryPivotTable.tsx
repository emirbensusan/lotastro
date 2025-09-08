import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Search, Package, Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  entry_date: string;
  age_days: number;
  supplier_name?: string;
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

interface InventoryPivotTableProps {
  onLotsSelected: (lots: SelectedLot[]) => void;
  preSelectedQuality?: string;
  preSelectedColor?: string;
  className?: string;
}

type SortField = 'quality' | 'color' | 'lot_number' | 'meters' | 'roll_count' | 'age_days';
type SortDirection = 'asc' | 'desc';

export function InventoryPivotTable({ 
  onLotsSelected, 
  preSelectedQuality, 
  preSelectedColor,
  className 
}: InventoryPivotTableProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLots, setSelectedLots] = useState<Map<string, SelectedLot>>(new Map());
  const [sortField, setSortField] = useState<SortField>('age_days');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    // Apply pre-filters if provided
    if (preSelectedQuality || preSelectedColor) {
      let filtered = searchTerm;
      if (preSelectedQuality && preSelectedColor) {
        filtered = `${preSelectedQuality} ${preSelectedColor}`;
      } else if (preSelectedQuality) {
        filtered = preSelectedQuality;
      } else if (preSelectedColor) {
        filtered = preSelectedColor;
      }
      setSearchTerm(filtered);
    }
  }, [preSelectedQuality, preSelectedColor]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lots')
        .select(`
          id,
          lot_number,
          quality,
          color,
          meters,
          roll_count,
          entry_date,
          suppliers(name)
        `)
        .eq('status', 'in_stock')
        .gt('roll_count', 0)
        .order('entry_date', { ascending: true }); // FIFO by default

      if (error) throw error;

      const formattedData = data.map(item => ({
        ...item,
        supplier_name: item.suppliers?.[0]?.name || 'Unknown',
        age_days: Math.floor((new Date().getTime() - new Date(item.entry_date).getTime()) / (1000 * 60 * 60 * 24))
      }));

      setInventory(formattedData);
    } catch (error: any) {
      toast.error(`Error loading inventory: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedInventory = useMemo(() => {
    let filtered = inventory;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = inventory.filter(item =>
        item.quality.toLowerCase().includes(search) ||
        item.color.toLowerCase().includes(search) ||
        item.lot_number.toLowerCase().includes(search) ||
        item.supplier_name?.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [inventory, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleLotSelection = (item: InventoryItem, isSelected: boolean) => {
    const newSelectedLots = new Map(selectedLots);
    
    if (isSelected) {
      newSelectedLots.set(item.id, {
        lotId: item.id,
        quality: item.quality,
        color: item.color,
        lotNumber: item.lot_number,
        meters: item.meters,
        availableRolls: item.roll_count,
        rollCount: 1, // Default to 1 roll
        lineType: 'standard'
      });
    } else {
      newSelectedLots.delete(item.id);
    }
    
    setSelectedLots(newSelectedLots);
    onLotsSelected(Array.from(newSelectedLots.values()));
  };

  const handleRollCountChange = (lotId: string, rollCount: number) => {
    const newSelectedLots = new Map(selectedLots);
    const lot = newSelectedLots.get(lotId);
    if (lot && rollCount > 0 && rollCount <= lot.availableRolls) {
      lot.rollCount = rollCount;
      newSelectedLots.set(lotId, lot);
      setSelectedLots(newSelectedLots);
      onLotsSelected(Array.from(newSelectedLots.values()));
    }
  };

  const handleLineTypeChange = (lotId: string, lineType: 'sample' | 'standard') => {
    const newSelectedLots = new Map(selectedLots);
    const lot = newSelectedLots.get(lotId);
    if (lot) {
      lot.lineType = lineType;
      newSelectedLots.set(lotId, lot);
      setSelectedLots(newSelectedLots);
      onLotsSelected(Array.from(newSelectedLots.values()));
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  if (loading) {
    return <div className="p-8 text-center">Loading inventory data...</div>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Header */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by quality, color, lot number, or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="outline" className="flex items-center space-x-1">
          <Package className="h-3 w-3" />
          <span>{filteredAndSortedInventory.length} lots available</span>
        </Badge>
      </div>

      {/* Selected Items Summary */}
      {selectedLots.size > 0 && (
        <div className="p-4 bg-primary/5 rounded-lg border">
          <h3 className="font-medium mb-2">Selected Lots ({selectedLots.size})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from(selectedLots.values()).map(lot => (
              <Badge key={lot.lotId} variant="secondary" className="justify-between">
                <span>{lot.quality} {lot.color} ({lot.rollCount}/{lot.availableRolls})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Pivot Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Select</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('quality')}
              >
                <div className="flex items-center space-x-1">
                  <span>Quality</span>
                  <SortIcon field="quality" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('color')}
              >
                <div className="flex items-center space-x-1">
                  <span>Color</span>
                  <SortIcon field="color" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('lot_number')}
              >
                <div className="flex items-center space-x-1">
                  <span>Lot #</span>
                  <SortIcon field="lot_number" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('meters')}
              >
                <div className="flex items-center space-x-1">
                  <span>Meters</span>
                  <SortIcon field="meters" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('roll_count')}
              >
                <div className="flex items-center space-x-1">
                  <span>Rolls</span>
                  <SortIcon field="roll_count" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('age_days')}
              >
                <div className="flex items-center space-x-1">
                  <span>Age (Days)</span>
                  <SortIcon field="age_days" />
                </div>
              </TableHead>
              <TableHead>Roll Count</TableHead>
              <TableHead>Line Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedInventory.map((item) => {
              const isSelected = selectedLots.has(item.id);
              const selectedLot = selectedLots.get(item.id);
              
              return (
                <TableRow 
                  key={item.id}
                  className={isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleLotSelection(item, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{item.quality}</TableCell>
                  <TableCell>{item.color}</TableCell>
                  <TableCell>{item.lot_number}</TableCell>
                  <TableCell>{item.meters.toLocaleString()}</TableCell>
                  <TableCell>{item.roll_count}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span className={item.age_days > 180 ? 'text-amber-600' : ''}>
                        {item.age_days}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isSelected && (
                      <Input
                        type="number"
                        min="1"
                        max={item.roll_count}
                        value={selectedLot?.rollCount || 1}
                        onChange={(e) => handleRollCountChange(item.id, parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {isSelected && (
                      <select
                        value={selectedLot?.lineType || 'standard'}
                        onChange={(e) => handleLineTypeChange(item.id, e.target.value as 'sample' | 'standard')}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="standard">Standard</option>
                        <option value="sample">Sample</option>
                      </select>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filteredAndSortedInventory.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No inventory items match your search criteria.
        </div>
      )}
    </div>
  );
}