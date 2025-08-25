import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { ChevronDown, ChevronRight, Search, Download, Package } from 'lucide-react';

interface Lot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  entry_date: string;
  status: 'in_stock' | 'out_of_stock' | 'partially_fulfilled';
  supplier: { name: string };
}

interface GroupedLot {
  quality: string;
  color: string;
  totalMeters: number;
  totalRolls: number;
  lots: Lot[];
  expanded: boolean;
}

const Inventory = () => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [groupedLots, setGroupedLots] = useState<GroupedLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');

  useEffect(() => {
    fetchLots();
  }, []);

  useEffect(() => {
    filterAndGroupLots();
  }, [lots, searchTerm, qualityFilter, colorFilter]);

  const fetchLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setLots(data || []);
    } catch (error) {
      console.error('Error fetching lots:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndGroupLots = () => {
    let filtered = lots.filter(lot => {
      const matchesSearch = !searchTerm || 
        lot.lot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lot.quality.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lot.color.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesQuality = !qualityFilter || lot.quality === qualityFilter;
      const matchesColor = !colorFilter || lot.color === colorFilter;
      
      return matchesSearch && matchesQuality && matchesColor;
    });

    // Group by quality and color
    const groups = filtered.reduce((acc, lot) => {
      const key = `${lot.quality}-${lot.color}`;
      if (!acc[key]) {
        acc[key] = {
          quality: lot.quality,
          color: lot.color,
          totalMeters: 0,
          totalRolls: 0,
          lots: [],
          expanded: false,
        };
      }
      
      acc[key].totalMeters += lot.meters;
      acc[key].totalRolls += lot.roll_count;
      acc[key].lots.push(lot);
      
      return acc;
    }, {} as Record<string, GroupedLot>);

    setGroupedLots(Object.values(groups));
  };

  const toggleGroup = (index: number) => {
    setGroupedLots(prev => prev.map((group, i) => 
      i === index ? { ...group, expanded: !group.expanded } : group
    ));
  };

  const getLotAge = (entryDate: string) => {
    const days = Math.floor((Date.now() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">In Stock</Badge>;
      case 'out_of_stock':
        return <Badge variant="destructive">Out of Stock</Badge>;
      case 'partially_fulfilled':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const exportToExcel = () => {
    const headers = ['LOT Number', 'Quality', 'Color', 'Meters', 'Rolls', 'Status', 'Entry Date', 'Age (Days)', 'Supplier'];
    const rows = lots.map(lot => [
      lot.lot_number,
      lot.quality,
      lot.color,
      lot.meters,
      lot.roll_count,
      lot.status,
      lot.entry_date,
      getLotAge(lot.entry_date),
      lot.supplier.name
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get unique values for filters
  const uniqueQualities = [...new Set(lots.map(lot => lot.quality))].sort();
  const uniqueColors = [...new Set(lots.map(lot => lot.color))].sort();

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Inventory</h1>
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <Package className="h-8 w-8 text-primary" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>
            Filter inventory by quality, color, or search terms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="LOT number, quality, color..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quality">Quality</Label>
              <select
                id="quality"
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">All Qualities</option>
                {uniqueQualities.map(quality => (
                  <option key={quality} value={quality}>{quality}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <select
                id="color"
                value={colorFilter}
                onChange={(e) => setColorFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">All Colors</option>
                {uniqueColors.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label>Export</Label>
              <Button onClick={exportToExcel} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Overview</CardTitle>
          <CardDescription>
            Expandable view of inventory grouped by quality and color
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {groupedLots.map((group, index) => (
              <Collapsible key={`${group.quality}-${group.color}`}>
                <CollapsibleTrigger
                  onClick={() => toggleGroup(index)}
                  className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {group.expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">{group.quality} - {group.color}</div>
                      <div className="text-sm text-muted-foreground">
                        {group.totalRolls} rolls, {group.totalMeters.toFixed(2)} meters
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline">{group.lots.length} LOTs</Badge>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-2">
                  <div className="ml-8 border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>LOT Number</TableHead>
                          <TableHead>Meters</TableHead>
                          <TableHead>Rolls</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Age (Days)</TableHead>
                          <TableHead>Supplier</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.lots.map((lot) => (
                          <TableRow key={lot.id}>
                            <TableCell className="font-mono">{lot.lot_number}</TableCell>
                            <TableCell>{lot.meters.toFixed(2)}</TableCell>
                            <TableCell>{lot.roll_count}</TableCell>
                            <TableCell>{getStatusBadge(lot.status)}</TableCell>
                            <TableCell>
                              <span className={getLotAge(lot.entry_date) > 90 ? 'text-red-600 font-semibold' : ''}>
                                {getLotAge(lot.entry_date)}
                              </span>
                            </TableCell>
                            <TableCell>{lot.supplier.name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
            
            {groupedLots.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No inventory items found matching your filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;