import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { HierarchicalAutocomplete } from '@/components/HierarchicalAutocomplete';

interface BulkOrderItem {
  id: string;
  lot_number: string;
  roll_count: number;
  line_type: 'standard' | 'sample';
  quality: string;
  color: string;
  meters?: number;
  error?: string;
  lot_age_days?: number;
  available_rolls?: number;
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
  const [manualEntry, setManualEntry] = useState(false);
  const [newItem, setNewItem] = useState<Partial<BulkOrderItem>>({
    quality: '',
    color: '',
    lot_number: '',
    roll_count: 1,
    line_type: 'standard'
  });

const downloadTemplate = () => {
  const headers = ['quality', 'color', 'lot_number', 'roll_count', 'line_type'];
  const template: Record<string, any>[] = [
    { quality: 'V710', color: 'NAVY BLUE', lot_number: 'LOT001', roll_count: 5, line_type: 'standard' },
    { quality: 'V715', color: 'NAVY ROYAL', lot_number: 'LOT002', roll_count: 2, line_type: 'standard' }
  ];

  const worksheet = XLSX.utils.json_to_sheet(template, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Order Items');
  XLSX.writeFile(workbook, 'bulk_order_template.xlsx');
};

const addManualItem = () => {
  if (!newItem.quality || !newItem.color || !newItem.lot_number || !newItem.roll_count) {
    toast.error('Please fill in all required fields');
    return;
  }

  const item: BulkOrderItem = {
    id: Date.now().toString(),
    quality: newItem.quality,
    color: newItem.color,
    lot_number: newItem.lot_number,
    roll_count: newItem.roll_count,
    line_type: newItem.line_type || 'standard',
    meters: newItem.meters,
    lot_age_days: newItem.lot_age_days,
    available_rolls: newItem.available_rolls
  };

  // Basic validation
  if (item.roll_count <= 0) {
    item.error = 'Roll count must be greater than 0';
  } else if (item.available_rolls && item.roll_count > item.available_rolls) {
    item.error = `Only ${item.available_rolls} rolls available`;
  }

  setUploadedItems(prev => [...prev, item]);
  setNewItem({
    quality: '',
    color: '',
    lot_number: '',
    roll_count: 1,
    line_type: 'standard'
  });
  toast.success('Item added successfully');
};

const removeItem = (id: string) => {
  setUploadedItems(prev => prev.filter(item => item.id !== id));
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

const items: BulkOrderItem[] = jsonData.map((row, index) => {
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
    id: `upload_${index}`,
    lot_number,
    roll_count,
    line_type,
    quality: qualityRaw ? qualityRaw.toString().trim() : '',
    color: colorRaw ? colorRaw.toString().trim() : '',
    meters: Number.isFinite(metersParsed as number) ? (metersParsed as number) : undefined,
  };

  // Basic validation
  if (!item.lot_number) {
    item.error = 'Lot number is required';
  } else if (!item.quality) {
    item.error = 'Quality is required';
  } else if (!item.color) {
    item.error = 'Color is required';
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
          {/* Upload Methods */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={!manualEntry ? "default" : "outline"}
              onClick={() => setManualEntry(false)}
              size="sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              File Upload
            </Button>
            <Button
              variant={manualEntry ? "default" : "outline"}
              onClick={() => setManualEntry(true)}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Manual Entry
            </Button>
          </div>

          {!manualEntry ? (
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
          ) : (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-medium">Add Item Manually</h3>
              <HierarchicalAutocomplete
                quality={newItem.quality || ''}
                color={newItem.color || ''}
                selectedLot={newItem.lot_number || ''}
                onQualityChange={(quality) => setNewItem(prev => ({ ...prev, quality }))}
                onColorChange={(color) => setNewItem(prev => ({ ...prev, color }))}
                onLotChange={(lot, lotData) => {
                  setNewItem(prev => ({ 
                    ...prev, 
                    lot_number: lot,
                    meters: lotData?.meters,
                    lot_age_days: lotData?.age_days,
                    available_rolls: lotData?.roll_count
                  }));
                }}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Roll Count *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newItem.roll_count || 1}
                    onChange={(e) => setNewItem(prev => ({ ...prev, roll_count: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label>Line Type</Label>
                  <select
                    className="w-full px-3 py-2 border border-input rounded-md"
                    value={newItem.line_type || 'standard'}
                    onChange={(e) => setNewItem(prev => ({ ...prev, line_type: e.target.value as 'standard' | 'sample' }))}
                  >
                    <option value="standard">Standard</option>
                    <option value="sample">Sample</option>
                  </select>
                </div>
              </div>

              <Button onClick={addManualItem} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          )}

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
    <TableHead>Quality</TableHead>
    <TableHead>Color</TableHead>
    <TableHead>Roll Count</TableHead>
    <TableHead>Meters</TableHead>
    <TableHead>Age (days)</TableHead>
    <TableHead>Type</TableHead>
    <TableHead>Status</TableHead>
    <TableHead>Actions</TableHead>
  </TableRow>
</TableHeader>
                  <TableBody>
{uploadedItems.map((item) => (
  <TableRow key={item.id}>
    <TableCell className="font-medium">{item.lot_number}</TableCell>
    <TableCell>{item.quality}</TableCell>
    <TableCell>{item.color}</TableCell>
    <TableCell>{item.roll_count}</TableCell>
    <TableCell>{item.meters ?? '-'}</TableCell>
    <TableCell>
      {item.lot_age_days ? (
        <Badge variant="outline">{item.lot_age_days}d</Badge>
      ) : '-'}
    </TableCell>
    <TableCell>
      <Badge variant={item.line_type === 'sample' ? 'secondary' : 'default'}>
        {item.line_type}
      </Badge>
    </TableCell>
    <TableCell>
      {item.error ? (
        <Badge variant="destructive">Error: {item.error}</Badge>
      ) : (
        <Badge variant="default">Valid</Badge>
      )}
    </TableCell>
    <TableCell>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => removeItem(item.id)}
      >
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
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