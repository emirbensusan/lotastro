import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Package, Search, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

interface QualityColorData {
  quality: string;
  normalized_quality: string;
  color: string;
  total_meters: number;
  total_rolls: number;
  lot_count: number;
}

interface SelectedColor {
  quality: string;
  color: string;
  normalized_quality: string;
}

const BulkSelection = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [allColorData, setAllColorData] = useState<QualityColorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<SelectedColor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');

  const qualitiesParam = searchParams.get('qualities');
  const selectedQualities = qualitiesParam ? qualitiesParam.split(',') : [];

  useEffect(() => {
    if (selectedQualities.length === 0) {
      navigate('/inventory');
      return;
    }
    fetchQualityColorData();
  }, [qualitiesParam]);

  const fetchQualityColorData = async () => {
    try {
      setLoading(true);
      const allData: QualityColorData[] = [];

      // Fetch data for each selected quality
      for (const normalizedQuality of selectedQualities) {
        const { data, error } = await supabase
          .rpc('get_lots_by_normalized_quality', {
            target_normalized_quality: normalizedQuality
          });

        if (error) throw error;

        // Group by color for this quality
        const colorGroups = (data || []).reduce((groups: Record<string, any>, lot: any) => {
          if (!groups[lot.color]) {
            groups[lot.color] = {
              quality: lot.quality,
              normalized_quality: normalizedQuality,
              color: lot.color,
              total_meters: 0,
              total_rolls: 0,
              lot_count: 0
            };
          }
          
          groups[lot.color].total_meters += lot.meters;
          groups[lot.color].total_rolls += lot.roll_count;
          groups[lot.color].lot_count += 1;
          
          return groups;
        }, {});

        allData.push(...Object.values(colorGroups));
      }

      setAllColorData(allData);
    } catch (error) {
      console.error('Error fetching quality color data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load color data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleColorSelection = (quality: string, color: string) => {
    const item = allColorData.find(d => d.quality === quality && d.color === color);
    const normalizedQuality = item?.normalized_quality || quality;
    
    const isSelected = selectedColors.some(
      selected => selected.quality === quality && selected.color === color
    );

    if (isSelected) {
      setSelectedColors(selectedColors.filter(
        selected => !(selected.quality === quality && selected.color === color)
      ));
    } else {
      setSelectedColors([...selectedColors, { 
        quality, 
        color, 
        normalized_quality: normalizedQuality 
      }]);
    }
  };

  const handleSelectAll = () => {
    if (selectedColors.length === filteredData.length) {
      // Deselect all
      setSelectedColors([]);
    } else {
      // Select all filtered items
      setSelectedColors(filteredData.map(item => ({
        quality: item.quality,
        color: item.color,
        normalized_quality: item.normalized_quality
      })));
    }
  };

  const handleProceedToLotSelection = () => {
    if (selectedColors.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one color',
        variant: 'destructive',
      });
      return;
    }

    // Navigate to lot selection with selected colors
    const colorParams = selectedColors.map(item => 
      `${encodeURIComponent(item.quality)}:${encodeURIComponent(item.color)}`
    ).join(',');
    
    navigate(`/lot-selection?colors=${colorParams}`);
  };

  // Filter and sort data for display
  const filteredData = allColorData.filter(item => {
    const matchesSearch = item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.quality.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesQuality = !qualityFilter || 
                          item.quality.toLowerCase().includes(qualityFilter.toLowerCase()) ||
                          item.normalized_quality.toLowerCase().includes(qualityFilter.toLowerCase());
    return matchesSearch && matchesQuality;
  }).sort((a, b) => {
    // Sort by quality first, then by color
    if (a.quality !== b.quality) {
      return a.quality.localeCompare(b.quality);
    }
    return a.color.localeCompare(b.color);
  });

  // Calculate summary statistics
  const totalQualities = new Set(allColorData.map(item => item.normalized_quality)).size;
  const totalColors = allColorData.length;
  const selectedColorsCount = selectedColors.length;
  const totalAvailableStock = allColorData.reduce((sum, item) => sum + item.total_meters, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Bulk Color Selection</h1>
          </div>
          <Package className="h-8 w-8 text-primary" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Bulk Color Selection</h1>
        </div>
        <Package className="h-8 w-8 text-primary" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalQualities}</div>
            <p className="text-muted-foreground">Qualities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalColors}</div>
            <p className="text-muted-foreground">Available Colors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{selectedColorsCount}</div>
            <p className="text-muted-foreground">Colors Selected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{Math.round(totalAvailableStock).toLocaleString()}</div>
            <p className="text-muted-foreground">Total Meters</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex items-center justify-between space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search colors or qualities..."
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
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Quality Filter
              {qualityFilter && <span className="ml-1 text-xs bg-primary text-primary-foreground rounded px-1">1</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Quality</label>
              <Textarea
                placeholder="Enter quality to filter (e.g., P200, A800)..."
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className="min-h-[60px]"
              />
              {qualityFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQualityFilter('')}
                  className="w-full"
                >
                  Clear Filter
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Color Selection Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Color Selection</CardTitle>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {filteredData.length} colors available
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedColors.length === filteredData.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedColors.length === filteredData.length && filteredData.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Lots</TableHead>
                  <TableHead className="text-right">Rolls</TableHead>
                  <TableHead className="text-right">Meters</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => {
                  const isSelected = selectedColors.some(
                    selected => selected.quality === item.quality && selected.color === item.color
                  );

                  return (
                    <TableRow 
                      key={`${item.quality}-${item.color}`}
                      className={isSelected ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleColorSelection(item.quality, item.color)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.quality}</TableCell>
                      <TableCell>{item.color}</TableCell>
                      <TableCell className="text-right">{item.lot_count}</TableCell>
                      <TableCell className="text-right">{item.total_rolls}</TableCell>
                      <TableCell className="text-right">{Math.round(item.total_meters).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No colors found matching your search criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Footer */}
      {selectedColors.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="font-medium">
                {selectedColors.length} colors selected across {new Set(selectedColors.map(c => c.normalized_quality)).size} qualities
              </span>
              <Button variant="outline" onClick={() => setSelectedColors([])}>
                Clear Selection
              </Button>
            </div>
            <Button onClick={handleProceedToLotSelection}>
              Proceed to Lot Selection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkSelection;