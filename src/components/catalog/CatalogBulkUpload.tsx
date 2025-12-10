import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Download, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import XLSX from 'xlsx-js-style';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface CatalogBulkItem {
  code: string;
  color_name: string;
  type: string;
  description?: string;
  logo_sku_code?: string;
  composition?: string;
  weaving_knitted?: string;
  fabric_type?: string;
  weight_g_m2?: number;
  produced_unit?: string;
  sold_unit?: string;
  eu_origin?: boolean;
  dyeing_batch_size?: number;
  suppliers?: string;
  sustainable_notes?: string;
  product_notes?: string;
  care_instructions?: string;
  isValid: boolean;
  error?: string;
}

const VALID_TYPES = ['lining', 'pocketing', 'sleeve_lining', 'stretch', 'knee_lining'];
const VALID_UNITS = ['meters', 'kilograms'];

// All template columns - mandatory fields marked with *
const TEMPLATE_COLUMNS = [
  'Quality Code*',
  'Color Name*',
  'Type',
  'Description',
  'Logo SKU Code',
  'Composition',
  'Weaving/Knitted',
  'Fabric Type',
  'Weight (g/m²)',
  'Produced Unit (meters/kilograms)',
  'Sold Unit (meters/kilograms)',
  'EU Origin (Y/N)',
  'Dyeing Batch Size',
  'Suppliers',
  'Sustainable Notes',
  'Product Notes',
  'Care Instructions'
];

const MANDATORY_COLUMNS = ['Quality Code*', 'Color Name*'];

const CatalogBulkUpload: React.FC<Props> = ({ open, onOpenChange, onSuccess }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogBulkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existingItems, setExistingItems] = useState<Set<string>>(new Set());

  // Fetch existing catalog items to check for duplicates
  useEffect(() => {
    if (open) {
      fetchExistingItems();
    }
  }, [open]);

  const fetchExistingItems = async () => {
    const { data } = await supabase
      .from('catalog_items')
      .select('code, color_name');
    
    if (data) {
      const keys = new Set(data.map(item => `${item.code.toLowerCase()}-${item.color_name.toLowerCase()}`));
      setExistingItems(keys);
    }
  };

  const generateSkuCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'LTA-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const downloadTemplate = () => {
    // Create sample data row
    const sampleData = {
      'Quality Code*': 'V710',
      'Color Name*': 'BLACK',
      'Type': 'lining',
      'Description': 'Premium lining fabric',
      'Logo SKU Code': '',
      'Composition': '100% Polyester',
      'Weaving/Knitted': 'Woven',
      'Fabric Type': 'Satin',
      'Weight (g/m²)': 120,
      'Produced Unit (meters/kilograms)': 'meters',
      'Sold Unit (meters/kilograms)': 'meters',
      'EU Origin (Y/N)': 'N',
      'Dyeing Batch Size': 1000,
      'Suppliers': 'Supplier A, Supplier B',
      'Sustainable Notes': '',
      'Product Notes': '',
      'Care Instructions': 'Machine wash cold'
    };

    // Create worksheet with headers
    const ws = XLSX.utils.json_to_sheet([sampleData], { header: TEMPLATE_COLUMNS });

    // Define orange style for mandatory columns
    const orangeStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFCC80' } },
      font: { bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center' }
    };

    // Define regular header style
    const regularStyle = {
      font: { bold: true },
      alignment: { horizontal: 'center' }
    };

    // Apply styles to header row
    TEMPLATE_COLUMNS.forEach((col, index) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: index });
      if (!ws[cellRef]) return;
      
      if (MANDATORY_COLUMNS.includes(col)) {
        ws[cellRef].s = orangeStyle;
      } else {
        ws[cellRef].s = regularStyle;
      }
    });

    // Set column widths
    ws['!cols'] = TEMPLATE_COLUMNS.map(col => ({
      wch: Math.max(col.length + 2, 15)
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Catalog Items');
    XLSX.writeFile(wb, 'catalog_items_template.xlsx');
  };

  const parseComposition = (compositionStr: string): { fiber: string; percentage: number }[] | null => {
    if (!compositionStr || !compositionStr.trim()) return null;
    
    const parts = compositionStr.split(',').map(p => p.trim());
    const result: { fiber: string; percentage: number }[] = [];
    
    for (const part of parts) {
      const match = part.match(/(\d+)%?\s*(.+)/);
      if (match) {
        result.push({
          percentage: parseInt(match[1], 10),
          fiber: match[2].trim()
        });
      }
    }
    
    return result.length > 0 ? result : null;
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

      const parsedItems: CatalogBulkItem[] = jsonData.map((row: any) => {
        // Handle both with and without asterisk in column names
        const code = String(row['Quality Code*'] || row['Quality Code'] || '').trim().toUpperCase();
        const color_name = String(row['Color Name*'] || row['Color Name'] || '').trim().toUpperCase();
        const type = String(row['Type'] || 'lining').trim().toLowerCase();
        const description = row['Description'] || '';
        const logo_sku_code = row['Logo SKU Code'] || '';
        const composition = row['Composition'] || '';
        const weaving_knitted = row['Weaving/Knitted'] || '';
        const fabric_type = row['Fabric Type'] || '';
        const weight_g_m2 = parseFloat(row['Weight (g/m²)']) || undefined;
        const produced_unit = String(row['Produced Unit (meters/kilograms)'] || 'meters').toLowerCase();
        const sold_unit = String(row['Sold Unit (meters/kilograms)'] || 'meters').toLowerCase();
        const eu_origin_raw = String(row['EU Origin (Y/N)'] || 'N').toUpperCase();
        const eu_origin = eu_origin_raw === 'Y' || eu_origin_raw === 'YES' || eu_origin_raw === 'TRUE';
        const dyeing_batch_size = parseFloat(row['Dyeing Batch Size']) || undefined;
        const suppliers = row['Suppliers'] || '';
        const sustainable_notes = row['Sustainable Notes'] || '';
        const product_notes = row['Product Notes'] || '';
        const care_instructions = row['Care Instructions'] || '';

        let isValid = true;
        let error = '';

        // Validation
        if (!code) {
          isValid = false;
          error = t('catalog.bulkUpload.codeRequired') as string;
        } else if (!color_name) {
          isValid = false;
          error = t('catalog.bulkUpload.colorRequired') as string;
        } else if (!VALID_TYPES.includes(type)) {
          isValid = false;
          error = t('catalog.bulkUpload.invalidType') as string;
        } else if (weight_g_m2 !== undefined && weight_g_m2 <= 0) {
          isValid = false;
          error = t('catalog.bulkUpload.invalidWeight') as string;
        } else if (dyeing_batch_size !== undefined && dyeing_batch_size <= 0) {
          isValid = false;
          error = t('catalog.bulkUpload.invalidBatchSize') as string;
        } else if (existingItems.has(`${code.toLowerCase()}-${color_name.toLowerCase()}`)) {
          isValid = false;
          error = t('catalog.bulkUpload.duplicateExists') as string;
        }

        return {
          code,
          color_name,
          type,
          description,
          logo_sku_code,
          composition,
          weaving_knitted,
          fabric_type,
          weight_g_m2,
          produced_unit: VALID_UNITS.includes(produced_unit) ? produced_unit : 'meters',
          sold_unit: VALID_UNITS.includes(sold_unit) ? sold_unit : 'meters',
          eu_origin,
          dyeing_batch_size,
          suppliers,
          sustainable_notes,
          product_notes,
          care_instructions,
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
      const itemsToInsert = validItems.map(item => ({
        code: item.code,
        color_name: item.color_name,
        lastro_sku_code: generateSkuCode(),
        type: item.type as any,
        description: item.description || null,
        logo_sku_code: item.logo_sku_code || null,
        composition: parseComposition(item.composition || ''),
        weaving_knitted: item.weaving_knitted || null,
        fabric_type: item.fabric_type || null,
        weight_g_m2: item.weight_g_m2 || null,
        produced_unit: item.produced_unit as any,
        sold_unit: item.sold_unit as any,
        eu_origin: item.eu_origin || false,
        dyeing_batch_size: item.dyeing_batch_size || null,
        suppliers: item.suppliers || null,
        sustainable_notes: item.sustainable_notes || null,
        product_notes: item.product_notes || null,
        care_instructions: item.care_instructions || null,
        status: 'pending_approval' as const,
        is_active: false,
        created_by_user_id: user?.id,
      }));

      const { error } = await supabase
        .from('catalog_items')
        .insert(itemsToInsert);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: (t('catalog.bulkUpload.uploadSuccess') as string).replace('{count}', String(validItems.length)),
      });

      setItems([]);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error uploading catalog items:', error);
      toast({
        title: t('error') as string,
        description: error.message || t('catalog.bulkUpload.uploadError') as string,
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('catalog.bulkUpload.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <p className="text-sm text-muted-foreground">
            {t('catalog.bulkUpload.instructions')}
          </p>
          
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#FFCC80' }} />
            {t('catalog.bulkUpload.mandatoryFieldsNote')}
          </p>

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
                id="catalog-bulk-upload"
              />
              <label htmlFor="catalog-bulk-upload">
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
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
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
                      <TableHead>{t('catalog.columns.code')}</TableHead>
                      <TableHead>{t('catalog.columns.colorName')}</TableHead>
                      <TableHead>{t('catalog.columns.type')}</TableHead>
                      <TableHead>{t('catalog.columns.composition')}</TableHead>
                      <TableHead>{t('catalog.columns.weight')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index} className={!item.isValid ? 'bg-destructive/10' : ''}>
                        <TableCell className="font-mono">{item.code}</TableCell>
                        <TableCell>{item.color_name}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.composition || '-'}</TableCell>
                        <TableCell>{item.weight_g_m2 ? `${item.weight_g_m2} g/m²` : '-'}</TableCell>
                        <TableCell>
                          {item.isValid ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
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

export default CatalogBulkUpload;
