import React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Reservation {
  id: string;
  reservation_number: string;
  customer_name: string;
  customer_id: string | null;
  status: string;
  reserved_date: string;
  hold_until: string | null;
  created_at: string;
  notes: string | null;
  reservation_lines: Array<{
    id: string;
    scope: 'INVENTORY' | 'INCOMING';
    quality: string;
    color: string;
    reserved_meters: number;
    lot_id: string | null;
    incoming_stock_id: string | null;
    lot?: {
      lot_number: string;
      warehouse_location: string | null;
    };
    incoming_stock?: {
      invoice_number: string | null;
      suppliers: {
        name: string;
      };
    };
  }>;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface ReservationExportProps {
  reservations: Reservation[];
}

export default function ReservationExport({ reservations }: ReservationExportProps) {
  const exportReservations = () => {
    try {
      // Summary sheet
      const summaryData = reservations.map(res => ({
        'Reservation #': res.reservation_number,
        'Customer Name': res.customer_name,
        'Customer ID': res.customer_id || '',
        'Status': res.status.toUpperCase(),
        'Reserved Date': res.reserved_date,
        'Hold Until': res.hold_until || '',
        'Total Meters': res.reservation_lines.reduce((sum, line) => sum + line.reserved_meters, 0).toFixed(2),
        'Line Count': res.reservation_lines.length,
        'Created By': res.profiles?.full_name || res.profiles?.email || '',
        'Created At': new Date(res.created_at).toLocaleString(),
        'Notes': res.notes || ''
      }));

      // Line items sheet
      const lineItemsData: any[] = [];
      reservations.forEach(res => {
        res.reservation_lines.forEach(line => {
          lineItemsData.push({
            'Reservation #': res.reservation_number,
            'Customer': res.customer_name,
            'Status': res.status.toUpperCase(),
            'Type': line.scope,
            'Quality': line.quality,
            'Color': line.color,
            'Meters': line.reserved_meters.toFixed(2),
            'Source': line.scope === 'INVENTORY'
              ? line.lot?.lot_number
              : line.incoming_stock?.invoice_number || 'N/A',
            'Location': line.scope === 'INVENTORY'
              ? line.lot?.warehouse_location || ''
              : line.incoming_stock?.suppliers?.name || ''
          });
        });
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(summaryData);
      const ws2 = XLSX.utils.json_to_sheet(lineItemsData);

      // Set column widths
      ws1['!cols'] = [
        { wch: 20 }, // Reservation #
        { wch: 25 }, // Customer Name
        { wch: 15 }, // Customer ID
        { wch: 12 }, // Status
        { wch: 15 }, // Reserved Date
        { wch: 15 }, // Hold Until
        { wch: 12 }, // Total Meters
        { wch: 10 }, // Line Count
        { wch: 20 }, // Created By
        { wch: 20 }, // Created At
        { wch: 40 }  // Notes
      ];

      ws2['!cols'] = [
        { wch: 20 }, // Reservation #
        { wch: 25 }, // Customer
        { wch: 12 }, // Status
        { wch: 12 }, // Type
        { wch: 20 }, // Quality
        { wch: 15 }, // Color
        { wch: 12 }, // Meters
        { wch: 20 }, // Source
        { wch: 25 }  // Location
      ];

      XLSX.utils.book_append_sheet(wb, ws1, 'Reservations');
      XLSX.utils.book_append_sheet(wb, ws2, 'Line Items');

      // Export
      const filename = `Reservations_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success('Reservations exported successfully');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Failed to export reservations');
    }
  };

  return (
    <Button variant="outline" onClick={exportReservations} size="sm">
      <FileDown className="h-4 w-4 mr-2" />
      Export to Excel
    </Button>
  );
}
