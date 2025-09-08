import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from "@/hooks/use-toast";
import { QrCode, Upload, Camera, Package, Calendar, MapPin, Plus, Printer } from 'lucide-react';
import QuickQREntry from '@/components/QuickQREntry';
import QRCameraScanner from '@/components/QRCameraScanner';
import { toast } from "sonner";

interface LotDetails {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  entry_date: string;
  status: string;
  supplier: { name: string };
}

const QRScan = () => {
  const { lotNumber } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedLotId, setSelectedLotId] = useState('');
  const [lotDetails, setLotDetails] = useState<LotDetails | null>(null);
  const [availableLots, setAvailableLots] = useState<{id: string, lot_number: string, quality: string, color: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    fetchAvailableLots();
    // If we have a LOT number from URL params (QR scan), fetch it immediately
    if (lotNumber) {
      fetchLotDetailsByNumber(lotNumber);
    }
  }, [lotNumber]);

  const fetchAvailableLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('id, lot_number, quality, color')
        .order('lot_number');

      if (error) throw error;
      setAvailableLots(data || []);
    } catch (error) {
      console.error('Error fetching lots:', error);
    }
  };

  const fetchLotDetailsByNumber = async (lotNum: string) => {
    setLoading(true);
    setError('');
    setLotDetails(null);

    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .eq('lot_number', lotNum)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setError((t('lotNotFound') as string).replace('{lotNumber}', lotNum));
        } else {
          throw error;
        }
      } else {
        setLotDetails(data);
      }
    } catch (error: any) {
      console.error('Error fetching lot details:', error);
      setError(t('failedToFetch') as string);
      toast.error(t('failedToFetch') as string);
    } finally {
      setLoading(false);
    }
  };

  const fetchLotDetailsById = async (lotId: string) => {
    setLoading(true);
    setError('');
    setLotDetails(null);

    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .eq('id', lotId)
        .single();

      if (error) throw error;
      setLotDetails(data);
    } catch (error: any) {
      console.error('Error fetching lot details:', error);
      setError(t('failedToFetch') as string);
      toast.error(t('failedToFetch') as string);
    } finally {
      setLoading(false);
    }
  };

  const handleLotSelect = (lotId: string) => {
    setSelectedLotId(lotId);
    if (lotId) {
      fetchLotDetailsById(lotId);
    } else {
      setLotDetails(null);
    }
  };

  const handleQRCodeDetected = (qrData: string) => {
    // Extract lot number from QR data (assuming format: domain/qr/lotNumber)
    const lotMatch = qrData.match(/\/qr\/(.+)$/);
    if (lotMatch) {
      const detectedLotNumber = lotMatch[1];
      fetchLotDetailsByNumber(detectedLotNumber);
      toast.success(`QR Code detected: ${detectedLotNumber}`);
    } else {
      toast.error("Invalid QR code format");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Open QR scanner dialog for file upload
    setShowQRScanner(true);
  };

  const startCameraScanning = () => {
    // Open QR scanner dialog for camera scanning
    setShowQRScanner(true);
  };

  const getLotAge = (entryDate: string) => {
    const days = Math.floor((Date.now() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="bg-green-100 text-green-800">{t('inStock')}</Badge>;
      case 'out_of_stock':
        return <Badge variant="destructive">{t('outOfStock')}</Badge>;
      case 'partially_fulfilled':
        return <Badge className="bg-yellow-100 text-yellow-800">{t('partiallyFulfilled')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // If user is not logged in and trying to access QR scan result
  if (lotNumber && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <QrCode className="h-12 w-12 mx-auto mb-4 text-primary" />
            <CardTitle>{t('qrCodeScanned')}</CardTitle>
            <CardDescription>
              {t('pleaseLogin')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {t('lotNumber')}: <span className="font-mono">{lotNumber}</span>
            </p>
            <Button onClick={() => window.location.href = '/auth'} className="w-full">
              {t('signInToView')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('qrCodeScanner')}</h1>
        <QrCode className="h-8 w-8 text-primary" />
      </div>

      {/* QR Scanner Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Camera className="mr-2 h-5 w-5" />
              {t('scanQrCode')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={startCameraScanning} className="w-full">
              {t('scanQrCode')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Upload className="mr-2 h-5 w-5" />
              {t('uploadQrImage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline" 
              className="w-full"
            >
              {t('uploadFile')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Package className="mr-2 h-5 w-5" />
              {t('selectLotFrom')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedLotId} onValueChange={handleLotSelect}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectLotPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {availableLots.map((lot) => (
                  <SelectItem key={lot.id} value={lot.id}>
                    {lot.lot_number} - {lot.quality} ({lot.color})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Plus className="mr-2 h-5 w-5" />
              {t('generateQr')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={showQuickEntry} onOpenChange={setShowQuickEntry}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full">
                  {t('generateQr')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('quickQrEntry')}</DialogTitle>
                </DialogHeader>
                <QuickQREntry onClose={() => setShowQuickEntry(false)} />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* LOT Details */}
      {error && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">{t('loading')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {lotDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                {t('lotDetails')}
              </span>
              {getStatusBadge(lotDetails.status)}
            </CardTitle>
            <CardDescription className="flex items-center justify-between">
              <span>
                {t('lotNumber')}: <span className="font-mono text-foreground">{lotDetails.lot_number}</span>
              </span>
              <Button
                onClick={() => window.open(`/print/qr/${lotDetails.lot_number}?size=medium`, '_blank')}
                variant="outline"
                size="sm"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print QR
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('quality')}</Label>
                  <p className="text-lg font-semibold">{lotDetails.quality}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('color')}</Label>
                  <p className="text-lg font-semibold">{lotDetails.color}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('meters')}</Label>
                  <p className="text-lg font-semibold">{lotDetails.meters.toFixed(2)} m</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('rollCount')}</Label>
                  <p className="text-lg font-semibold">{lotDetails.roll_count}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    {t('entryDate')}
                  </Label>
                  <p className="text-lg font-semibold">
                    {new Date(lotDetails.entry_date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getLotAge(lotDetails.entry_date)} {t('days') as string} {(t('age') as string).toLowerCase()}
                  </p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground flex items-center">
                    <MapPin className="mr-1 h-4 w-4" />
                    {t('supplier')}
                  </Label>
                  <p className="text-lg font-semibold">{lotDetails.supplier.name}</p>
                </div>
              </div>
            </div>
            
            {getLotAge(lotDetails.entry_date) > 90 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ {(t('oldLotWarning') as string).replace('{days}', getLotAge(lotDetails.entry_date).toString())}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('howToUse')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {(t('qrInstructions') as string[]).map((instruction: string, index: number) => (
            <p key={index}>• {instruction}</p>
          ))}
        </CardContent>
      </Card>
      
      <QRCameraScanner
        open={showQRScanner}
        onOpenChange={setShowQRScanner}
        onQRCodeDetected={handleQRCodeDetected}
      />
    </div>
  );
};

export default QRScan;