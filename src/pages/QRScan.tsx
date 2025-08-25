import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { QrCode, Search, Package, Calendar, MapPin } from 'lucide-react';

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
  const [manualLotNumber, setManualLotNumber] = useState('');
  const [lotDetails, setLotDetails] = useState<LotDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If we have a LOT number from URL params (QR scan), fetch it immediately
    if (lotNumber) {
      fetchLotDetails(lotNumber);
    }
  }, [lotNumber]);

  const fetchLotDetails = async (lotNum: string) => {
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
          setError(`LOT number "${lotNum}" not found`);
        } else {
          throw error;
        }
      } else {
        setLotDetails(data);
      }
    } catch (error: any) {
      console.error('Error fetching lot details:', error);
      setError('Failed to fetch LOT details');
      toast({
        title: "Error",
        description: "Failed to fetch LOT details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualLotNumber.trim()) {
      fetchLotDetails(manualLotNumber.trim());
    }
  };

  const getLotAge = (entryDate: string) => {
    const days = Math.floor((Date.now() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="bg-green-100 text-green-800">In Stock</Badge>;
      case 'out_of_stock':
        return <Badge variant="destructive">Out of Stock</Badge>;
      case 'partially_fulfilled':
        return <Badge className="bg-yellow-100 text-yellow-800">Partially Fulfilled</Badge>;
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
            <CardTitle>QR Code Scanned</CardTitle>
            <CardDescription>
              Please log in to view LOT details
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              LOT Number: <span className="font-mono">{lotNumber}</span>
            </p>
            <Button onClick={() => window.location.href = '/auth'} className="w-full">
              Sign In to View Details
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">QR Code Scanner</h1>
        <QrCode className="h-8 w-8 text-primary" />
      </div>

      {/* Manual Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="mr-2 h-5 w-5" />
            LOT Lookup
          </CardTitle>
          <CardDescription>
            Search for LOT details by number or scan QR code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSearch} className="flex space-x-2">
            <div className="flex-1">
              <Input
                value={manualLotNumber}
                onChange={(e) => setManualLotNumber(e.target.value)}
                placeholder="Enter LOT number (e.g., LOT001)"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </form>
        </CardContent>
      </Card>

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
              <p className="text-muted-foreground">Loading LOT details...</p>
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
                LOT Details
              </span>
              {getStatusBadge(lotDetails.status)}
            </CardTitle>
            <CardDescription>
              LOT Number: <span className="font-mono text-foreground">{lotDetails.lot_number}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Quality</Label>
                  <p className="text-lg font-semibold">{lotDetails.quality}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Color</Label>
                  <p className="text-lg font-semibold">{lotDetails.color}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Meters</Label>
                  <p className="text-lg font-semibold">{lotDetails.meters.toFixed(2)} m</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Roll Count</Label>
                  <p className="text-lg font-semibold">{lotDetails.roll_count}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    Entry Date
                  </Label>
                  <p className="text-lg font-semibold">
                    {new Date(lotDetails.entry_date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getLotAge(lotDetails.entry_date)} days old
                  </p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground flex items-center">
                    <MapPin className="mr-1 h-4 w-4" />
                    Supplier
                  </Label>
                  <p className="text-lg font-semibold">{lotDetails.supplier.name}</p>
                </div>
              </div>
            </div>
            
            {getLotAge(lotDetails.entry_date) > 90 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ This LOT is over {getLotAge(lotDetails.entry_date)} days old. Consider reviewing for aging inventory.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use QR Scanner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Use any QR code scanner app on your mobile device</p>
          <p>• Scan the QR code printed on the textile roll</p>
          <p>• You'll be redirected to this page with LOT details</p>
          <p>• Alternatively, you can manually enter the LOT number above</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRScan;