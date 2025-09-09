import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ColorData {
  color: string;
  total_meters: number;
  total_rolls: number;
  lot_count: number;
}

const QualityDetails = () => {
  const { quality } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [colors, setColors] = useState<ColorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [qualityTotals, setQualityTotals] = useState({
    total_meters: 0,
    total_rolls: 0,
    total_lots: 0
  });

  useEffect(() => {
    if (quality) {
      fetchColorData();
    }
  }, [quality]);

  const fetchColorData = async () => {
    try {
      setLoading(true);
      
      const { data: lotsData, error } = await supabase
        .from('lots')
        .select('color, meters, roll_count')
        .eq('quality', quality)
        .eq('status', 'in_stock');

      if (error) throw error;

      // Group by color
      const colorMap = new Map<string, { meters: number; rolls: number; count: number }>();

      lotsData.forEach(lot => {
        if (!colorMap.has(lot.color)) {
          colorMap.set(lot.color, { meters: 0, rolls: 0, count: 0 });
        }
        
        const colorData = colorMap.get(lot.color)!;
        colorData.meters += Number(lot.meters);
        colorData.rolls += lot.roll_count;
        colorData.count += 1;
      });

      // Convert to array and sort by meters (descending)
      const colorsArray = Array.from(colorMap.entries()).map(([color, data]) => ({
        color,
        total_meters: data.meters,
        total_rolls: data.rolls,
        lot_count: data.count,
      })).sort((a, b) => b.total_meters - a.total_meters);

      // Calculate totals
      const totals = {
        total_meters: colorsArray.reduce((sum, color) => sum + color.total_meters, 0),
        total_rolls: colorsArray.reduce((sum, color) => sum + color.total_rolls, 0),
        total_lots: colorsArray.reduce((sum, color) => sum + color.lot_count, 0),
      };

      setColors(colorsArray);
      setQualityTotals(totals);
    } catch (error) {
      console.error('Error fetching color data:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to load color data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const navigateToLotDetails = (color: string) => {
    navigate(`/inventory/${encodeURIComponent(quality!)}/${encodeURIComponent(color)}`);
  };

  const navigateBack = () => {
    navigate('/inventory');
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

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={navigateBack} className="cursor-pointer">
              {t('inventory')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{quality}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{quality}</h1>
          <p className="text-muted-foreground">
            {colors.length} {colors.length === 1 ? 'color' : 'colors'} • {qualityTotals.total_lots} {t('lots')} • {qualityTotals.total_meters.toLocaleString()} {t('meters')} • {qualityTotals.total_rolls.toLocaleString()} {t('rolls')}
          </p>
        </div>
        <Button variant="outline" onClick={navigateBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToInventory')}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('lots')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualityTotals.total_lots}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('meters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualityTotals.total_meters.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('rolls')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualityTotals.total_rolls.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Colors Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('availableColors')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('color')}</TableHead>
                <TableHead className="text-right">{t('lots')}</TableHead>
                <TableHead className="text-right">{t('meters')}</TableHead>
                <TableHead className="text-right">{t('rolls')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colors.map((colorData) => (
                <TableRow 
                  key={colorData.color} 
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigateToLotDetails(colorData.color)}
                >
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded border border-muted-foreground/20"
                        style={{ backgroundColor: colorData.color.toLowerCase() === 'white' ? '#f8f9fa' : colorData.color.toLowerCase() }}
                      />
                      <span className="font-medium">{colorData.color}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {colorData.lot_count}
                  </TableCell>
                  <TableCell className="text-right">
                    {colorData.total_meters.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {colorData.total_rolls.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToLotDetails(colorData.color);
                      }}
                    >
                      {t('selectLots')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {colors.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No colors available for this quality
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityDetails;