import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

interface BulkOrderItem {
  lot_number: string;
  roll_count: number;
  line_type: 'standard' | 'sample';
  quality?: string;
  color?: string;
  meters?: number;
  error?: string;
}

interface OrderBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (items: BulkOrderItem[]) => void;
}

export default function OrderBulkUpload({
  open,
  onOpenChange,
  onUpload
}: OrderBulkUploadProps) {
  const [uploadedItems, setUploadedItems] = useState<BulkOrderItem[]>([]);
  const [uploading, setUploading] = useState(false);

const downloadTemplate = () => {
  const headers = ['quality', 'color', 'lot', 'roll count', 'meters'];
  const template: Record<string, any>[] = [
    { quality: 'Premium', color: 'Blue', lot: 'LOT001', 'roll count': 5, meters: 1200 },
    { quality: 'Standard', color: 'Red', lot: 'LOT002', 'roll count': 2, meters: 450 }
  ];

  const worksheet = XLSX.utils.json_to_sheet(template, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Order Items');
  XLSX.writeFile(workbook, 'order_items_template.xlsx');
};

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

const items: BulkOrderItem[] = jsonData.map((row) => {
  // Normalize keys to lowercase for flexible header matching
  const normalized: Record<string, any> = {};
  Object.keys(row).forEach((key) => {
    normalized[key.toString().trim().toLowerCase()] = (row as any)[key];
  });

  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (k in normalized && normalized[k] !== undefined && normalized[k] !== null) {
        return normalized[k];
      }
    }
    return undefined;
  };

  const lotRaw = get('lot', 'lot number', 'lot_number', 'lotnumber', 'lot no', 'lotno', 'lot #', 'lot#');
  const rollRaw = get('roll count', 'roll_count', 'rolls', 'roll', 'qty', 'quantity');
  const lineTypeRaw = get('line type', 'line_type', 'type', 'line');
  const qualityRaw = get('quality');
  const colorRaw = get('color', 'colour');
  const metersRaw = get('meters', 'meter', 'm');

  const lot_number = (lotRaw ?? '').toString().trim();
  const roll_count = parseInt((rollRaw ?? '').toString().trim(), 10) || 0;
  const metersParsed = metersRaw !== undefined && metersRaw !== ''
    ? parseFloat((metersRaw ?? '').toString().trim())
    : undefined;

  const line_type: 'standard' | 'sample' =
    (lineTypeRaw ?? '').toString().trim().toLowerCase() === 'sample' ? 'sample' : 'standard';

  const item: BulkOrderItem = {
    lot_number,
    roll_count,
    line_type,
    quality: qualityRaw ? qualityRaw.toString() : '',
    color: colorRaw ? colorRaw.toString() : '',
    meters: Number.isFinite(metersParsed as number) ? (metersParsed as number) : undefined,
  };

  // Basic validation
  if (!item.lot_number) {
    item.error = 'Lot number is required';
  } else if (item.roll_count <= 0) {
    item.error = 'Roll count must be greater than 0';
  } else if (item.meters !== undefined && item.meters <= 0) {
    item.error = 'Meters must be greater than 0';
  }

  return item;
});

      setUploadedItems(items);
      toast.success(`Parsed ${items.length} items from file`);
    } catch (error) {
      toast.error('Failed to parse file. Please check format.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUpload = () => {
    const validItems = uploadedItems.filter(item => !item.error);
    
    if (validItems.length === 0) {
      toast.error('No valid items to upload');
      return;
    }

    onUpload(validItems);
    onOpenChange(false);
    setUploadedItems([]);
  };

  const validItemsCount = uploadedItems.filter(item => !item.error).length;
  const errorItemsCount = uploadedItems.filter(item => item.error).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Upload Order Items</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="file-upload">Upload Excel/CSV File</Label>
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
              Template
            </Button>
          </div>

          {uploadedItems.length > 0 && (
            <>
              <div className="flex gap-4">
                <Alert>
                  <FileSpreadsheet className="w-4 h-4" />
                  <AlertDescription>
                    Found {uploadedItems.length} items: {validItemsCount} valid, {errorItemsCount} with errors
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
<TableHeader>
  <TableRow>
    <TableHead>Lot Number</TableHead>
    <TableHead>Roll Count</TableHead>
    <TableHead>Meters</TableHead>
    <TableHead>Type</TableHead>
    <TableHead>Quality</TableHead>
    <TableHead>Color</TableHead>
    <TableHead>Status</TableHead>
  </TableRow>
</TableHeader>
                  <TableBody>
{uploadedItems.map((item, index) => (
  <TableRow key={index}>
    <TableCell>{item.lot_number}</TableCell>
    <TableCell>{item.roll_count}</TableCell>
    <TableCell>{item.meters ?? '-'}</TableCell>
    <TableCell>
      <Badge variant={item.line_type === 'sample' ? 'secondary' : 'default'}>
        {item.line_type}
      </Badge>
    </TableCell>
    <TableCell>{item.quality}</TableCell>
    <TableCell>{item.color}</TableCell>
    <TableCell>
      {item.error ? (
        <Badge variant="destructive">Error: {item.error}</Badge>
      ) : (
        <Badge variant="default">Valid</Badge>
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
            Cancel
          </Button>
          {uploadedItems.length > 0 && (
            <Button 
              onClick={handleConfirmUpload}
              disabled={validItemsCount === 0}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload {validItemsCount} Items
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}