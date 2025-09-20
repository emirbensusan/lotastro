import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Package, Search, ShoppingCart, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const qualitiesParam = searchParams.get('qualities') || '';
  const selectedQualities = qualitiesParam.split(',').filter(Boolean);
  
  const [qualityColorData, setQualityColorData] = useState<QualityColorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentQualityIndex, setCurrentQualityIndex] = useState(0);

  useEffect(() => {
    if (selectedQualities.length === 0) {
      navigate('/inventory');
      return;
    }
    fetchQualityColorData();
  }, [selectedQualities]);

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

      setQualityColorData(allData);
    } catch (error) {
      console.error('Error fetching quality color data:', error);
      toast({
        title: t('error') as string,
        description: "Failed to load quality data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleColorSelection = (quality: string, color: string) => {
    const key = `${quality}|${color}`;
    const newSelected = new Set(selectedColors);
    
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    
    setSelectedColors(newSelected);
  };

  const handleSelectAllForQuality = (quality: string) => {
    const qualityColors = filteredData.filter(item => item.quality === quality);
    const allQualityKeysSelected = qualityColors.every(item => 
      selectedColors.has(`${item.quality}|${item.color}`)
    );

    const newSelected = new Set(selectedColors);
    
    if (allQualityKeysSelected) {
      // Deselect all for this quality
      qualityColors.forEach(item => {
        newSelected.delete(`${item.quality}|${item.color}`);
      });
    } else {
      // Select all for this quality
      qualityColors.forEach(item => {
        newSelected.add(`${item.quality}|${item.color}`);
      });
    }
    
    setSelectedColors(newSelected);
  };

  const handleProceedToLotSelection = () => {
    if (selectedColors.size === 0) {
      toast({
        title: t('error') as string,
        description: "Please select at least one color",
        variant: "destructive",
      });
      return;
    }

    const colorArray = Array.from(selectedColors);
    navigate(`/lot-selection?colors=${encodeURIComponent(colorArray.join(','))}`);
  };

  const filteredData = qualityColorData.filter(item =>
    item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.quality.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by quality for better organization
  const groupedData = filteredData.reduce((groups, item) => {
    if (!groups[item.quality]) {
      groups[item.quality] = [];
    }
    groups[item.quality].push(item);
    return groups;
  }, {} as Record<string, QualityColorData[]>);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToInventory')}
          </Button>
          <h1 className="text-3xl font-bold">{t('bulkColorSelection')}</h1>
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
          <Button variant="ghost" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToInventory')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('bulkColorSelection')}</h1>
            <p className="text-muted-foreground">
              {t('selectedQualities')}: {selectedQualities.length} | {t('selectedColors')}: {selectedColors.size}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Package className="h-8 w-8 text-primary" />
          <Badge variant="secondary">
            {selectedColors.size} {t('colorsSelected')}
          </Badge>
        </div>
      </div>

      {/* Selected Qualities Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('selectedQualities')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {selectedQualities.map((quality, index) => (
              <Badge key={quality} variant="outline" className="text-sm">
                {quality}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            {t('searchColors')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>{t('searchByColorOrQuality')}</Label>
            <Input
              placeholder={t('searchColors') as string}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Color Selection by Quality */}
      <div className="space-y-4">
        {Object.entries(groupedData).map(([quality, colors]) => {
          const qualitySelectedCount = colors.filter(item => 
            selectedColors.has(`${item.quality}|${item.color}`)
          ).length;
          
          return (
            <Card key={quality}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{quality}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      {qualitySelectedCount} / {colors.length} {t('selected')}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectAllForQuality(quality)}
                    >
                      {qualitySelectedCount === colors.length ? t('deselectAll') : t('selectAll')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">{t('select')}</TableHead>
                      <TableHead>{t('color')}</TableHead>
                      <TableHead>{t('lots')}</TableHead>
                      <TableHead>{t('rolls')}</TableHead>
                      <TableHead>{t('meters')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colors.map((item) => {
                      const isSelected = selectedColors.has(`${item.quality}|${item.color}`);
                      
                      return (
                        <TableRow 
                          key={`${item.quality}-${item.color}`}
                          className={`cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleColorSelection(item.quality, item.color)}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell 
                            className="font-medium cursor-pointer"
                            onClick={() => toggleColorSelection(item.quality, item.color)}
                          >
                            {item.color}
                          </TableCell>
                          <TableCell>{item.lot_count}</TableCell>
                          <TableCell>{item.total_rolls}</TableCell>
                          <TableCell>{item.total_meters.toFixed(2)} m</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      {selectedColors.size > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedColors.size} {t('colorsSelected')} across {Object.keys(groupedData).length} {t('qualities')}
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setSelectedColors(new Set())}>
                  {t('clearSelection')}
                </Button>
                <Button onClick={handleProceedToLotSelection}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {t('proceedToLotSelection')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkSelection;