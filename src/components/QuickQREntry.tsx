import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2, QrCode, Printer } from 'lucide-react';

interface QuickQRData {
  quality: string;
  color: string;
  meters: string;
  lotNumber: string;
  entryDate: string;
  warehouseLocation: string;
}

interface QuickQREntryProps {
  onClose: () => void;
}

const QuickQREntry: React.FC<QuickQREntryProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<any>(null);
  const [formData, setFormData] = useState<QuickQRData>({
    quality: '',
    color: '',
    meters: '',
    lotNumber: '',
    entryDate: new Date().toISOString().split('T')[0],
    warehouseLocation: '',
  });

  const handleInputChange = (field: keyof QuickQRData, value: string) => {
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
      if (!formData.quality || !formData.color || !formData.meters || !formData.lotNumber || !formData.warehouseLocation) {
        throw new Error('Please fill in all required fields');
      }

      const meters = parseFloat(formData.meters);
      if (isNaN(meters) || meters <= 0) {
        throw new Error('Please enter a valid number for meters');
      }

      // Generate QR code URL
      const qrCodeUrl = generateQRCodeUrl(formData.lotNumber);

      // Store in lot queue (you'll need to create this table)
      // For now, we'll create a temporary data structure
      const qrData = {
        ...formData,
        meters: meters,
        qr_code_url: qrCodeUrl,
        status: 'pending_completion',
        created_at: new Date().toISOString(),
      };

      setGeneratedQR(qrData);
      
      toast({
        title: t('qrCodeGenerated') as string,
        description: `QR code for LOT ${formData.lotNumber} generated successfully`,
      });

    } catch (error: any) {
      toast({
        title: t('error') as string,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintQR = () => {
    if (!generatedQR) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - LOT ${generatedQR.lotNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .qr-container { margin: 20px 0; }
              .lot-info { margin: 10px 0; font-size: 14px; }
            </style>
          </head>
          <body>
            <h2>LOT ${generatedQR.lotNumber}</h2>
            <div class="lot-info">Quality: ${generatedQR.quality}</div>
            <div class="lot-info">Color: ${generatedQR.color}</div>
            <div class="lot-info">Meters: ${generatedQR.meters}</div>
            <div class="lot-info">Entry Date: ${generatedQR.entryDate}</div>
            <div class="lot-info">Location: ${generatedQR.warehouseLocation}</div>
            <div class="qr-container">
              <div id="qrcode"></div>
              <p>Scan to view LOT details</p>
              <p style="font-size: 10px; word-break: break-all;">${generatedQR.qr_code_url}</p>
            </div>
          </body>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            QRCode.toCanvas(document.getElementById('qrcode'), '${generatedQR.qr_code_url}', { width: 200 }, function (error) {
              if (error) console.error(error);
              setTimeout(() => window.print(), 500);
            });
          </script>
        </html>
      `);
    }
  };

  if (generatedQR) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <QrCode className="mr-2 h-5 w-5" />
            {t('qrCodeGenerated')}
          </CardTitle>
          <CardDescription>
            LOT {generatedQR.lotNumber} QR code generated successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div id="qr-display" className="mb-4"></div>
            <div className="space-y-2 text-sm">
              <p><strong>{t('intakeQuality')}:</strong> {generatedQR.quality}</p>
              <p><strong>{t('intakeColor')}:</strong> {generatedQR.color}</p>
              <p><strong>{t('meters')}:</strong> {generatedQR.meters}</p>
              <p><strong>{t('lotIntakeNumber')}:</strong> {generatedQR.lotNumber}</p>
              <p><strong>{t('entryDate')}:</strong> {generatedQR.entryDate}</p>
              <p><strong>{t('warehouseLocation')}:</strong> {generatedQR.warehouseLocation}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handlePrintQR} className="flex-1">
              <Printer className="mr-2 h-4 w-4" />
              {t('printQrCode')}
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1">
              {t('cancel')}
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground break-all">
            QR URL: {generatedQR.qr_code_url}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('quickQrEntry')}</CardTitle>
        <CardDescription>
          {t('generateQrDescription')}
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
            <Label htmlFor="warehouseLocation">{t('warehouseLocation')} *</Label>
            <Input
              id="warehouseLocation"
              value={formData.warehouseLocation}
              onChange={(e) => handleInputChange('warehouseLocation', e.target.value)}
              placeholder="e.g., A1-B2-C3"
              required
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  {t('generateQr')}
                </>
              )}
            </Button>
            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
              {t('cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default QuickQREntry;