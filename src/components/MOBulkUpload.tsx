import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Download, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: { id: string; name: string }[];
  onSuccess: () => void;
}

interface BulkItem {
  supplier: string;
  supplier_id?: string;
  quality: string;
  color: string;
  ordered_meters: number;
  customer_name?: string;
  customer_agreed_date?: string;
  expected_completion_date?: string;
  isValid: boolean;
  error?: string;
}

const MOBulkUpload: React.FC<Props> = ({ open, onOpenChange, suppliers, onSuccess }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<BulkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const downloadTemplate = () => {
    const templateData = [
      {
        'Supplier': 'SUPPLIER_NAME',
        'Quality': 'V710',
        'Color': 'RED',
        'Ordered Meters': 1000,
        'Expected Completion Date (YYYY-MM-DD)': '2025-01-15',
        'Customer Name (Optional)': '',
        'Customer Agreed Date (YYYY-MM-DD) (Optional)': '',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Manufacturing Orders');
    XLSX.writeFile(wb, 'manufacturing_orders_template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const parsedItems: BulkItem[] = jsonData.map((row: any) => {
        const supplierName = String(row['Supplier'] || '').trim();
        const quality = String(row['Quality'] || '').trim().toUpperCase();
        const color = String(row['Color'] || '').trim().toUpperCase();
        const orderedMeters = parseFloat(row['Ordered Meters'] || 0);
        const expectedCompletionDate = row['Expected Completion Date (YYYY-MM-DD)'] || '';
        const customerName = row['Customer Name (Optional)'] || '';
        const customerAgreedDate = row['Customer Agreed Date (YYYY-MM-DD) (Optional)'] || '';

        const supplier = suppliers.find(
          s => s.name.toLowerCase() === supplierName.toLowerCase()
        );

        let isValid = true;
        let error = '';

        if (!supplier) {
          isValid = false;
          error = t('mo.supplierNotFound') as string;
        } else if (!quality) {
          isValid = false;
          error = t('qualityRequired') as string;
        } else if (!color) {
          isValid = false;
          error = t('colorRequired') as string;
        } else if (!orderedMeters || orderedMeters <= 0) {
          isValid = false;
          error = t('metersMustBePositive') as string;
        }

        return {
          supplier: supplierName,
          supplier_id: supplier?.id,
          quality,
          color,
          ordered_meters: orderedMeters,
          expected_completion_date: expectedCompletionDate,
          customer_name: customerName,
          customer_agreed_date: customerAgreedDate,
          isValid,
          error,
        };
      });

      setItems(parsedItems);

      const validCount = parsedItems.filter(i => i.isValid).length;
      const errorCount = parsedItems.length - validCount;
      
      toast({
        title: t('success') as string,
        description: (t('foundItems') as string)
          .replace('{total}', String(parsedItems.length))
          .replace('{valid}', String(validCount))
          .replace('{errors}', String(errorCount)),
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: t('error') as string,
        description: t('failedToParseFile') as string,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    const validItems = items.filter(i => i.isValid);
    if (validItems.length === 0) {
      toast({
        title: t('error') as string,
        description: t('noValidItems') as string,
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      const ordersToInsert = validItems.map(item => ({
        supplier_id: item.supplier_id,
        quality: item.quality,
        color: item.color,
        ordered_amount: item.ordered_meters,
        expected_completion_date: item.expected_completion_date || null,
        is_customer_order: !!item.customer_name,
        customer_name: item.customer_name || null,
        customer_agreed_date: item.customer_agreed_date || null,
        created_by: user?.id,
        status: 'ORDERED',
      }));

      const { error } = await supabase
        .from('manufacturing_orders')
        .insert(ordersToInsert);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: (t('uploadedSuccessfully') as string).replace('{count}', String(validItems.length)),
      });

      setItems([]);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error uploading orders:', error);
      toast({
        title: t('error') as string,
        description: error.message || t('mo.uploadError') as string,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const validCount = items.filter(i => i.isValid).length;
  const errorCount = items.length - validCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('mo.bulkUploadTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Controls */}
          <div className="flex gap-4 items-center">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t('template')}
            </Button>
            
            <div className="flex-1">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="mo-bulk-upload"
              />
              <label htmlFor="mo-bulk-upload">
                <Button variant="outline" asChild className="cursor-pointer">
                  <span>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {t('uploadExcelCsv')}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {/* Preview Table */}
          {items.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {validCount} {t('validStatus')}
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {errorCount} {t('error')}
                  </Badge>
                )}
              </div>

              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('supplier')}</TableHead>
                      <TableHead>{t('quality')}</TableHead>
                      <TableHead>{t('color')}</TableHead>
                      <TableHead className="text-right">{t('meters')}</TableHead>
                      <TableHead>{t('mo.eta')}</TableHead>
                      <TableHead>{t('customer')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index} className={!item.isValid ? 'bg-red-50' : ''}>
                        <TableCell>{item.supplier}</TableCell>
                        <TableCell>{item.quality}</TableCell>
                        <TableCell>{item.color}</TableCell>
                        <TableCell className="text-right">{item.ordered_meters.toLocaleString()}</TableCell>
                        <TableCell>{item.expected_completion_date || '-'}</TableCell>
                        <TableCell>{item.customer_name || '-'}</TableCell>
                        <TableCell>
                          {item.isValid ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {t('validStatus')}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              {item.error}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setItems([]);
                  onOpenChange(false);
                }}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleUpload} disabled={uploading || validCount === 0}>
                  {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('upload')} ({validCount} {t('items')})
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MOBulkUpload;