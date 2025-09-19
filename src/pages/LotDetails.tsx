import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Package, Calendar, Building2 } from 'lucide-react';

interface LotDetail {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  entry_date: string;
  invoice_number?: string;
  invoice_date?: string;
  suppliers?: { name: string };
  age_days: number;
  rolls?: { meters: number; position: number }[];
  roll_breakdown?: string;
}

const LotDetails = () => {
  const { quality, color } = useParams<{ quality: string; color: string }>();
  const [lots, setLots] = useState<LotDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuantities, setSelectedQuantities] = useState<{ [lotId: string]: number }>({});
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { addToCart } = usePOCart();
  const { toast } = useToast();

  useEffect(() => {
    if (quality && color) {
      fetchLotDetails();
    }
  }, [quality, color]);

  const formatRollBreakdown = (rolls: { meters: number; position: number }[]): string => {
    if (!rolls || rolls.length === 0) return '';
    
    // Sort rolls by position
    const sortedRolls = rolls.sort((a, b) => a.position - b.position);
    
    // Group consecutive rolls with the same meter value
    const groupedRolls: string[] = [];
    const meterCounts: { [key: number]: number } = {};
    const individualMeters: number[] = [];
    
    // Count occurrences of each meter value
    sortedRolls.forEach(roll => {
      meterCounts[roll.meters] = (meterCounts[roll.meters] || 0) + 1;
    });
    
    // Create the breakdown string
    const groups: string[] = [];
    const processedMeters = new Set<number>();
    
    sortedRolls.forEach(roll => {
      if (!processedMeters.has(roll.meters)) {
        const count = meterCounts[roll.meters];
        if (count > 1) {
          groups.push(`${count}x${roll.meters}`);
        } else {
          individualMeters.push(roll.meters);
        }
        processedMeters.add(roll.meters);
      }
    });
    
    // Combine grouped and individual meters
    let breakdown = '';
    if (groups.length > 0) {
      breakdown += `(${groups.join(')')}-(')}`;
    }
    if (individualMeters.length > 0) {
      if (breakdown) breakdown += '-';
      breakdown += individualMeters.join('-');
    }
    
    return breakdown;
  };

  const fetchLotDetails = async () => {
    if (!quality || !color) return;

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
          invoice_number,
          invoice_date,
          suppliers(name),
          rolls(meters, position)
        `)
        .eq('quality', decodeURIComponent(quality))
        .eq('color', decodeURIComponent(color))
        .eq('status', 'in_stock')
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Calculate age and roll breakdown for each lot
      const lotsWithAge = data.map(lot => ({
        ...lot,
        age_days: Math.floor((new Date().getTime() - new Date(lot.entry_date).getTime()) / (1000 * 3600 * 24)),
        roll_breakdown: formatRollBreakdown(lot.rolls || [])
      }));

      setLots(lotsWithAge);

      // Initialize selected quantities
      const initialQuantities: { [lotId: string]: number } = {};
      lotsWithAge.forEach(lot => {
        initialQuantities[lot.id] = 1;
      });
      setSelectedQuantities(initialQuantities);

    } catch (error) {
      console.error('Error fetching lot details:', error);
      toast({
        title: String(t('error')),
        description: 'Failed to load lot details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (lotId: string, quantity: number) => {
    const lot = lots.find(l => l.id === lotId);
    if (lot) {
      const validQuantity = Math.max(1, Math.min(quantity, lot.roll_count));
      setSelectedQuantities(prev => ({
        ...prev,
        [lotId]: validQuantity
      }));
    }
  };

  const handleAddToCart = (lot: LotDetail) => {
    const quantity = selectedQuantities[lot.id] || 1;
    addToCart({
      id: lot.id,
      lot_number: lot.lot_number,
      quality: lot.quality,
      color: lot.color,
      meters: lot.meters,
      roll_count: lot.roll_count,
      selectedRolls: quantity,
      entry_date: lot.entry_date,
      supplier_name: lot.suppliers?.name,
      invoice_number: lot.invoice_number,
      invoice_date: lot.invoice_date,
      age_days: lot.age_days,
    });

    toast({
        title: String(t('addedToCart')),
        description: `${lot.lot_number} (${quantity} ${String(t('rolls'))}) ${String(t('addedToCart'))}`,
    });
  };

  const handleAddAllToCart = () => {
    lots.forEach(lot => {
      const quantity = selectedQuantities[lot.id] || 1;
      addToCart({
        id: lot.id,
        lot_number: lot.lot_number,
        quality: lot.quality,
        color: lot.color,
        meters: lot.meters,
        roll_count: lot.roll_count,
        selectedRolls: quantity,
        entry_date: lot.entry_date,
        supplier_name: lot.suppliers?.name,
        invoice_number: lot.invoice_number,
        invoice_date: lot.invoice_date,
        age_days: lot.age_days,
      });
    });

    toast({
      title: String(t('success')),
      description: `${lots.length} ${String(t('lots'))} ${String(t('addedToCart'))}`,
    });
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
            <BreadcrumbLink onClick={() => navigate('/inventory')} className="cursor-pointer">
              {t('inventory')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{decodeURIComponent(quality || '')} - {decodeURIComponent(color || '')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToInventory')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {decodeURIComponent(quality || '')} - {decodeURIComponent(color || '')}
            </h1>
            <p className="text-muted-foreground">
              {lots.length} {t('availableLots')} • {lots.reduce((sum, lot) => sum + lot.roll_count, 0)} {t('rolls')} • {lots.reduce((sum, lot) => sum + lot.meters, 0).toLocaleString()} {t('meters')}
            </p>
          </div>
        </div>
        
        {lots.length > 0 && (
          <Button onClick={handleAddAllToCart} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('addAllToCart')}
          </Button>
        )}
      </div>

      {/* Lots Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('availableLots')}</CardTitle>
        </CardHeader>
        <CardContent>
          {lots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noLotsAvailable')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('lotNumber')}</TableHead>
                  <TableHead className="text-right">{t('meters')}</TableHead>
                  <TableHead className="text-right">{t('rolls')}</TableHead>
                  <TableHead>{t('rollMeters')}</TableHead>
                  <TableHead className="text-center">{t('quantity')}</TableHead>
                  <TableHead>{t('supplier')}</TableHead>
                  <TableHead>{t('entryDate')}</TableHead>
                  <TableHead>{t('age')}</TableHead>
                  <TableHead className="text-right">{t('actionAdd')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium">{lot.lot_number}</TableCell>
                    <TableCell className="text-right">{lot.meters.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{lot.roll_count}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {lot.roll_breakdown || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={1}
                        max={lot.roll_count}
                        value={selectedQuantities[lot.id] || 1}
                        onChange={(e) => handleQuantityChange(lot.id, parseInt(e.target.value) || 1)}
                        className="w-20 text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{lot.suppliers?.name || t('unknown')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(lot.entry_date).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lot.age_days > 30 ? "destructive" : lot.age_days > 14 ? "secondary" : "default"}>
                        {lot.age_days} {t('days')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(lot)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('addToCart')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LotDetails;