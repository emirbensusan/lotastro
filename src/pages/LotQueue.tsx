import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import { Clock, Package, Edit, CheckCircle } from 'lucide-react';

interface PendingLot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  entry_date: string;
  warehouse_location: string;
  status: string;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
}

const LotQueue = () => {
  const { profile } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { t } = useLanguage();
  const [pendingLots, setPendingLots] = useState<PendingLot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState<PendingLot | null>(null);
  const [completionData, setCompletionData] = useState({
    supplierId: '',
    productionDate: '',
    invoiceDate: '',
    invoiceNumber: '',
    notes: '',
  });

  useEffect(() => {
    fetchPendingLots();
    fetchSuppliers();
  }, []);

  const fetchPendingLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lot_queue')
        .select('*')
        .eq('status', 'pending_completion')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingLots(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending lots:', error);
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const handleCompleteLot = async () => {
    if (!selectedLot || !completionData.supplierId || !completionData.invoiceNumber || !completionData.invoiceDate) {
      toast({
        title: t('validationError') as string,
        description: t('fillRequiredFields') as string,
        variant: "destructive",
      });
      return;
    }

    try {
      // Move to lots table with complete information
      const { error } = await supabase
        .from('lots')
        .insert({
          quality: selectedLot.quality,
          color: selectedLot.color,
          meters: selectedLot.meters,
          lot_number: selectedLot.lot_number,
          entry_date: selectedLot.entry_date,
          supplier_id: completionData.supplierId,
          qr_code_url: `${window.location.origin}/qr/${selectedLot.lot_number}`,
          status: 'in_stock',
        });

      if (error) throw error;

      // Remove from queue
      const { error: deleteError } = await supabase
        .from('lot_queue')
        .delete()
        .eq('id', selectedLot.id);

      if (deleteError) throw deleteError;

      setPendingLots(prev => prev.filter(lot => lot.id !== selectedLot.id));
      setSelectedLot(null);
      setCompletionData({
        supplierId: '',
        productionDate: '',
        invoiceDate: '',
        invoiceNumber: '',
        notes: '',
      });

      toast({
        title: t('success') as string,
        description: `${t('lotMovedSuccess')}`.replace('LOT', `LOT ${selectedLot.lot_number}`),
      });
    } catch (error: any) {
      toast({
        title: t('error') as string,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Permissions
  if (permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPermission('inventory', 'viewlotqueue')) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            {t('noPermissionPage')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('lotQueue')}</h1>
          <Clock className="h-8 w-8 text-primary" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">{t('loading')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('lotQueue')}</h1>
          <p className="text-muted-foreground mt-2">{t('lotQueueDescription')}</p>
        </div>
        <Clock className="h-8 w-8 text-primary" />
      </div>

      {pendingLots.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>{t('pendingLots')}: 0</p>
              <p className="text-sm mt-2">{t('allLotsCompleted')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingLots.map((lot) => (
            <Card key={lot.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    <Package className="mr-2 h-5 w-5" />
                    LOT {lot.lot_number}
                  </CardTitle>
                  <Badge variant="secondary">
                    <Clock className="mr-1 h-3 w-3" />
                    {t('pendingBadge')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('intakeQuality')}</Label>
                    <p className="font-semibold">{lot.quality}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('intakeColor')}</Label>
                    <p className="font-semibold">{lot.color}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('meters')}</Label>
                    <p className="font-semibold">{lot.meters} m</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('warehouseLocation')}</Label>
                    <p className="font-semibold">{lot.warehouse_location}</p>
                  </div>
                </div>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => setSelectedLot(lot)} 
                      className="w-full md:w-auto"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {t('completeLotInfo')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{t('completeLotInfo')} - LOT {lot.lot_number}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                        <div>
                          <Label className="text-sm font-medium">{t('intakeQuality')}</Label>
                          <p>{lot.quality}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">{t('intakeColor')}</Label>
                          <p>{lot.color}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">{t('meters')}</Label>
                          <p>{lot.meters} m</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">{t('warehouseLocation')}</Label>
                          <p>{lot.warehouse_location}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="supplier">{t('intakeSupplier')} *</Label>
                          <Select 
                            value={completionData.supplierId} 
                            onValueChange={(value) => setCompletionData(prev => ({ ...prev, supplierId: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectSupplierPlaceholder') as string} />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="invoiceNumber">{t('invoiceNumber')} *</Label>
                          <Input
                            id="invoiceNumber"
                            value={completionData.invoiceNumber}
                            onChange={(e) => setCompletionData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                            placeholder={t('invoiceNumberPlaceholder') as string}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="invoiceDate">{t('invoiceDate')} *</Label>
                          <Input
                            id="invoiceDate"
                            type="date"
                            value={completionData.invoiceDate}
                            onChange={(e) => setCompletionData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="productionDate">{t('productionDate')}</Label>
                          <Input
                            id="productionDate"
                            type="date"
                            value={completionData.productionDate}
                            onChange={(e) => setCompletionData(prev => ({ ...prev, productionDate: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes">{t('notes')}</Label>
                          <Input
                            id="notes"
                            value={completionData.notes}
                            onChange={(e) => setCompletionData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder={t('additionalNotesPlaceholder') as string}
                          />
                        </div>
                      </div>

                      <Button onClick={handleCompleteLot} className="w-full">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {t('moveToInventory')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LotQueue;