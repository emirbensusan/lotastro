import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Package, QrCode, Printer } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
}

interface LotFormData {
  quality: string;
  color: string;
  meters: string;
  lotNumber: string;
  entryDate: string;
  supplierId: string;
  productionDate: string;
  invoiceDate: string;
  invoiceNumber: string;
  warehouseLocation: string;
  notes: string;
}

const LotIntake = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LotFormData>({
    quality: '',
    color: '',
    meters: '',
    lotNumber: '',
    entryDate: new Date().toISOString().split('T')[0],
    supplierId: '',
    productionDate: '',
    invoiceDate: '',
    invoiceNumber: '',
    warehouseLocation: '',
    notes: '',
  });
  const [createdLot, setCreatedLot] = useState<any>(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

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
      toast({
        title: t('error') as string,
        description: "Failed to load suppliers",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof LotFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateQRCodeUrl = (lotNumber: string) => {
    return `${window.location.origin}/qr/${lotNumber}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form
      if (!formData.quality || !formData.color || !formData.meters || !formData.lotNumber || !formData.supplierId || !formData.invoiceNumber || !formData.invoiceDate) {
        throw new Error('Please fill in all required fields');
      }

      const meters = parseFloat(formData.meters);
      if (isNaN(meters) || meters <= 0) {
        throw new Error('Please enter a valid number for meters');
      }

      // Generate QR code URL
      const qrCodeUrl = generateQRCodeUrl(formData.lotNumber);

      // Insert LOT into database
      const { data, error } = await supabase
        .from('lots')
        .insert({
          quality: formData.quality,
          color: formData.color,
          meters: meters,
          lot_number: formData.lotNumber,
          entry_date: formData.entryDate,
          supplier_id: formData.supplierId,
          qr_code_url: qrCodeUrl,
          status: 'in_stock',
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('LOT number already exists. Please use a different LOT number.');
        }
        throw error;
      }

      setCreatedLot(data);
      
      toast({
        title: t('lotCreated') as string,
        description: `LOT ${formData.lotNumber} has been added to inventory`,
      });

      // Reset form
      setFormData({
        quality: '',
        color: '',
        meters: '',
        lotNumber: '',
        entryDate: new Date().toISOString().split('T')[0],
        supplierId: '',
        productionDate: '',
        invoiceDate: '',
        invoiceNumber: '',
        warehouseLocation: '',
        notes: '',
      });

    } catch (error: any) {
      toast({
        title: t('failedToCreateLot') as string,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintQR = () => {
    if (!createdLot) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - LOT ${createdLot.lot_number}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .qr-container { margin: 20px 0; }
              .lot-info { margin: 10px 0; font-size: 14px; }
            </style>
          </head>
          <body>
            <h2>LOT ${createdLot.lot_number}</h2>
            <div class="lot-info">Quality: ${createdLot.quality}</div>
            <div class="lot-info">Color: ${createdLot.color}</div>
            <div class="lot-info">Meters: ${createdLot.meters}</div>
            <div class="qr-container">
              <div id="qrcode"></div>
              <p>Scan to view LOT details</p>
              <p style="font-size: 10px; word-break: break-all;">${createdLot.qr_code_url}</p>
            </div>
          </body>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            QRCode.toCanvas(document.getElementById('qrcode'), '${createdLot.qr_code_url}', { width: 200 }, function (error) {
              if (error) console.error(error);
              setTimeout(() => window.print(), 500);
            });
          </script>
        </html>
      `);
    }
  };

  // Check if user has permission
  if (!profile || (!['warehouse_staff', 'admin'].includes(profile.role))) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('lotIntake')}</h1>
        <Package className="h-8 w-8 text-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LOT Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('newLotEntry')}</CardTitle>
            <CardDescription>
              {t('newLotDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quality">{t('intakeQuality')} *</Label>
                <Input
                  id="quality"
                  value={formData.quality}
                  onChange={(e) => handleInputChange('quality', e.target.value)}
                  placeholder="e.g., Cotton, Polyester, Blend"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">{t('intakeColor')} *</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  placeholder="e.g., Red, Blue, White"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meters">{t('meters')} *</Label>
                <Input
                  id="meters"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.meters}
                  onChange={(e) => handleInputChange('meters', e.target.value)}
                  placeholder="e.g., 100.50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lotNumber">{t('lotIntakeNumber')} *</Label>
                <Input
                  id="lotNumber"
                  value={formData.lotNumber}
                  onChange={(e) => handleInputChange('lotNumber', e.target.value)}
                  placeholder="e.g., LOT001, WH-2024-001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entryDate">{t('entryDate')} *</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => handleInputChange('entryDate', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">{t('intakeSupplier')} *</Label>
                <Select value={formData.supplierId} onValueChange={(value) => handleInputChange('supplierId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier" />
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
                  value={formData.invoiceNumber}
                  onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                  placeholder="e.g., INV-2024-001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceDate">{t('invoiceDate')} *</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                  required
                />
              </div>

              {/* Optional Fields */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-muted-foreground">{t('optionalFields')}</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="productionDate">{t('productionDate')}</Label>
                  <Input
                    id="productionDate"
                    type="date"
                    value={formData.productionDate}
                    onChange={(e) => handleInputChange('productionDate', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warehouseLocation">{t('warehouseLocation')}</Label>
                  <Input
                    id="warehouseLocation"
                    value={formData.warehouseLocation}
                    onChange={(e) => handleInputChange('warehouseLocation', e.target.value)}
                    placeholder="e.g., A1-B2-C3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t('notes')}</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('creatingLot')}
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    {t('createLot')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* QR Code Preview */}
        {createdLot && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <QrCode className="mr-2 h-5 w-5" />
                {t('qrCodeGenerated')}
              </CardTitle>
              <CardDescription>
                LOT {createdLot.lot_number} created successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div id="qr-display" className="mb-4"></div>
                <div className="space-y-2 text-sm">
                  <p><strong>{t('quality')}:</strong> {createdLot.quality}</p>
                  <p><strong>{t('color')}:</strong> {createdLot.color}</p>
                  <p><strong>{t('meters')}:</strong> {createdLot.meters}</p>
                  <p><strong>{t('lotNumber')}:</strong> {createdLot.lot_number}</p>
                </div>
              </div>
              
              <Button onClick={handlePrintQR} className="w-full">
                <Printer className="mr-2 h-4 w-4" />
                {t('printQrCode')}
              </Button>
              
              <div className="text-xs text-muted-foreground break-all">
                QR URL: {createdLot.qr_code_url}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LotIntake;