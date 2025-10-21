import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface IncomingBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface BulkIncomingStockItem {
  id: string;
  supplier_name: string;
  supplier_id?: string;
  invoice_number: string;
  invoice_date: string;
  expected_arrival_date?: string;
  quality: string;
  color: string;
  expected_meters: number;
  notes?: string;
  error?: string;
}

interface Supplier {
  id: string;
  name: string;
}

export const IncomingBulkUpload: React.FC<IncomingBulkUploadProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const [uploadedItems, setUploadedItems] = useState<BulkIncomingStockItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const downloadTemplate = () => {
    const template = [
      {
        supplier_name: 'ABC Textiles',
        invoice_number: 'INV-2025-001',
        invoice_date: '2025-01-20',
        expected_arrival_date: '2025-01-27',
        quality: 'V710',
        color: 'NAVY BLUE',
        expected_meters: 1000,
        notes: 'First shipment of the year'
      },
      {
        supplier_name: 'XYZ Fabrics',
        invoice_number: 'INV-2025-002',
        invoice_date: '2025-01-21',
        expected_arrival_date: '2025-01-28',
        quality: 'V715',
        color: 'NAVY ROYAL',
        expected_meters: 1500,
        notes: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Incoming Stock');
    XLSX.writeFile(workbook, 'incoming_stock_template.xlsx');
  };

  const validateItem = (item: BulkIncomingStockItem, suppliers: Supplier[]): string | null => {
    // Validate supplier exists
    const supplier = suppliers.find(s =>
      s.name.toLowerCase() === item.supplier_name.toLowerCase()
    );
    if (!supplier) {
      return `Supplier "${item.supplier_name}" not found in system`;
    }
    item.supplier_id = supplier.id;

    // Validate invoice number
    if (!item.invoice_number || item.invoice_number.trim().length === 0) {
      return 'Invoice number is required';
    }

    // Validate dates
    if (!item.invoice_date || !/^\d{4}-\d{2}-\d{2}$/.test(item.invoice_date)) {
      return 'Invalid invoice date format (use YYYY-MM-DD)';
    }

    if (item.expected_arrival_date && !/^\d{4}-\d{2}-\d{2}$/.test(item.expected_arrival_date)) {
      return 'Invalid arrival date format (use YYYY-MM-DD)';
    }

    // Validate quality and color
    if (!item.quality || item.quality.trim().length === 0) {
      return 'Quality is required';
    }

    if (!item.color || item.color.trim().length === 0) {
      return 'Color is required';
    }

    // Validate expected meters
    if (!item.expected_meters || item.expected_meters <= 0) {
      return 'Expected meters must be greater than 0';
    }

    return null; // No errors
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Read file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      // Fetch suppliers for validation
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name');

      if (suppliersError) throw suppliersError;

      // Parse and validate items
      const items: BulkIncomingStockItem[] = jsonData.map((row, index) => {
        const normalized: Record<string, any> = {};
        Object.keys(row).forEach((key) => {
          normalized[key.toString().trim().toLowerCase()] = (row as any)[key];
        });

        const item: BulkIncomingStockItem = {
          id: `upload_${index}`,
          supplier_name: normalized['supplier_name'] || normalized['supplier'] || '',
          invoice_number: normalized['invoice_number'] || normalized['invoice'] || '',
          invoice_date: normalized['invoice_date'] || '',
          expected_arrival_date: normalized['expected_arrival_date'] || normalized['arrival_date'] || '',
          quality: normalized['quality'] || '',
          color: normalized['color'] || normalized['colour'] || '',
          expected_meters: parseFloat(normalized['expected_meters'] || normalized['meters'] || '0'),
          notes: normalized['notes'] || ''
        };

        // Validate
    const error = validateItem(item, suppliers);
        if (error) {
          item.error = error;
        }

        return item;
      });

      setUploadedItems(items);
      toast({
        title: t('success') as string,
        description: `${t('successParsedItems').toString().replace('{count}', items.length.toString())}`
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: t('error') as string,
        description: t('failedToParseFile') as string,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUpload = async () => {
    const validItems = uploadedItems.filter(item => !item.error);

    if (validItems.length === 0) {
      toast({
        title: t('error') as string,
        description: t('noValidItems') as string,
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Prepare insert data
      const insertData = validItems.map(item => ({
        supplier_id: item.supplier_id!,
        invoice_number: item.invoice_number,
        invoice_date: item.invoice_date,
        expected_arrival_date: item.expected_arrival_date || null,
        quality: item.quality,
        color: item.color,
        expected_meters: item.expected_meters,
        notes: item.notes || null,
        received_meters: 0,
        reserved_meters: 0,
        status: 'pending_inbound',
        created_by: user.id
      }));

      // Batch insert
      const { error } = await supabase
        .from('incoming_stock')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: `${t('uploadedSuccessfully').toString().replace('{count}', validItems.length.toString())}`
      });

      onSuccess();
      onOpenChange(false);
      setUploadedItems([]);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: t('error') as string,
        description: error.message || t('failedToParseFile') as string,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const validItemsCount = uploadedItems.filter(item => !item.error).length;
  const errorItemsCount = uploadedItems.filter(item => item.error).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('bulkUploadIncomingStock')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Upload section */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="file-upload">{t('uploadExcelCsv')}</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="mt-6"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('template')}
            </Button>
          </div>

          {/* Preview table */}
          {uploadedItems.length > 0 && (
            <>
              <Alert>
                <FileSpreadsheet className="w-4 h-4" />
                <AlertDescription>
                  {t('foundItems').toString().replace('{total}', uploadedItems.length.toString()).replace('{valid}', validItemsCount.toString()).replace('{errors}', errorItemsCount.toString())}
                </AlertDescription>
              </Alert>

              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('supplier')}</TableHead>
                      <TableHead>{t('invoiceHash')}</TableHead>
                      <TableHead>{t('invoiceDate')}</TableHead>
                      <TableHead>{t('quality')}</TableHead>
                      <TableHead>{t('color')}</TableHead>
                      <TableHead>{t('meters')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.supplier_name}</TableCell>
                        <TableCell>{item.invoice_number}</TableCell>
                        <TableCell>{item.invoice_date}</TableCell>
                        <TableCell>{item.quality}</TableCell>
                        <TableCell>{item.color}</TableCell>
                        <TableCell>{item.expected_meters}m</TableCell>
                        <TableCell>
                          {item.error ? (
                            <Badge variant="destructive" className="text-xs">
                              {item.error}
                            </Badge>
                          ) : (
                            <Badge variant="default">{t('validStatus')}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          {uploadedItems.length > 0 && (
            <Button
              onClick={handleConfirmUpload}
              disabled={validItemsCount === 0 || loading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {t('upload')} {validItemsCount} {t('items')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
