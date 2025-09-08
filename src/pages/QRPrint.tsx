import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";

interface LotDetails {
  lot_number: string;
  quality: string;
  color: string;
  entry_date: string;
  supplier_name: string;
}

export default function QRPrint() {
  const { lotNumber } = useParams<{ lotNumber: string }>();
  const [searchParams] = useSearchParams();
  const [lotDetails, setLotDetails] = useState<LotDetails | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const size = searchParams.get('size') || 'medium';
  const batch = searchParams.get('batch') === 'true';
  const batchLots = searchParams.get('lots')?.split(',') || [];

  useEffect(() => {
    if (lotNumber) {
      fetchLotDetails();
    }
    
    // Auto-trigger print dialog after content loads
    const timer = setTimeout(() => {
      window.print();
    }, 1000);

    return () => clearTimeout(timer);
  }, [lotNumber]);

  const fetchLotDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          lot_number,
          quality,
          color,
          entry_date,
          suppliers!lots_supplier_id_fkey(name)
        `)
        .eq('lot_number', lotNumber)
        .single();

      if (error) throw error;

      const details: LotDetails = {
        lot_number: data.lot_number,
        quality: data.quality,
        color: data.color,
        entry_date: data.entry_date,
        supplier_name: data.suppliers?.name || 'Unknown'
      };

      setLotDetails(details);

      // Generate QR code
      const qrData = `${window.location.origin}/qr/${lotNumber}`;
      const qrUrl = await QRCode.toDataURL(qrData, {
        width: getQRSize(),
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Error fetching lot details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQRSize = () => {
    switch (size) {
      case 'small': return 128;
      case 'large': return 512;
      default: return 256; // medium
    }
  };

  const getLabelSize = () => {
    switch (size) {
      case 'small': return 'w-24 h-32';
      case 'large': return 'w-96 h-48';
      default: return 'w-48 h-64'; // medium
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Preparing print layout...</p>
        </div>
      </div>
    );
  }

  if (!lotDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Lot Not Found</h1>
          <p>The requested lot number "{lotNumber}" could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 print:p-0">
      {/* Print-optimized layout */}
      <div className="print:hidden mb-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">QR Code Print Preview</h1>
          <p className="text-gray-600">This page will automatically trigger the print dialog</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 justify-center items-start">
        {batch && batchLots.length > 0 ? (
          // Batch printing layout
          batchLots.map((lot, index) => (
            <div key={index} className={`${getLabelSize()} border-2 border-gray-300 print:border-black flex flex-col items-center justify-center p-2 bg-white`}>
              <div className="text-center mb-2">
                <div className="text-xs font-bold">LOTASTRO</div>
                <div className="text-lg font-bold">{lot}</div>
              </div>
              {qrCodeUrl && (
                <img 
                  src={qrCodeUrl} 
                  alt={`QR Code for ${lot}`}
                  className="max-w-full max-h-32"
                />
              )}
              <div className="text-xs text-center mt-1">
                <div>Scan to view details</div>
              </div>
            </div>
          ))
        ) : (
          // Single QR code layout
          <div className={`${getLabelSize()} border-2 border-gray-300 print:border-black flex flex-col items-center justify-center p-4 bg-white mx-auto`}>
            {/* Header */}
            <div className="text-center mb-4">
              <div className="text-sm font-bold text-gray-800">LOTASTRO</div>
              <div className="text-2xl font-bold">{lotDetails.lot_number}</div>
            </div>

            {/* QR Code */}
            {qrCodeUrl && (
              <div className="mb-4">
                <img 
                  src={qrCodeUrl} 
                  alt={`QR Code for ${lotDetails.lot_number}`}
                  className="max-w-full"
                />
              </div>
            )}

            {/* Lot Details */}
            <div className="text-center text-xs space-y-1">
              <div><strong>Quality:</strong> {lotDetails.quality}</div>
              <div><strong>Color:</strong> {lotDetails.color}</div>
              <div><strong>Entry:</strong> {new Date(lotDetails.entry_date).toLocaleDateString()}</div>
              <div><strong>Supplier:</strong> {lotDetails.supplier_name}</div>
            </div>

            {/* Footer */}
            <div className="text-xs text-center mt-4 text-gray-600">
              Scan QR code to view full details
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            margin: 0.5in;
            size: auto;
          }
          
          body {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:border-black {
            border-color: black !important;
          }
        }
      `}</style>
    </div>
  );
}