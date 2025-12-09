import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  FileUp
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ImportResult {
  success: boolean;
  total_rows: number;
  imported_rows: number;
  skipped_duplicates: number;
  error_rows: number;
  errors: { row: number; message: string }[];
  import_batch_id?: string;
  error?: string;
}

const HistoricalImportModal: React.FC<Props> = ({ open, onOpenChange, onSuccess }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const downloadTemplate = () => {
    const csvContent = `kalite_kodu;renk_kodu;tarih;miktar;birim;belge_durumu
V710;RED;2024-01-15;1500;M;confirmed
V710;BLUE;2024-01-15;2000;M;confirmed
A800;CHOCOLATE 4364;2024-01-20;3500;M;reserved
P200;WHITE;2024-02-01;1000;KG;confirmed`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'demand_history_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const fileExt = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      
      if (!validTypes.includes(fileExt) && !selectedFile.type.includes('csv') && !selectedFile.type.includes('spreadsheet')) {
        toast({
          title: t('error') as string,
          description: t('forecast.invalidFileType') as string || 'Please upload a CSV or Excel file',
          variant: 'destructive'
        });
        return;
      }

      // Validate file size (max 20MB)
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast({
          title: t('error') as string,
          description: t('forecast.fileTooLarge') as string || 'File size must be less than 20MB',
          variant: 'destructive'
        });
        return;
      }

      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (user?.id) {
        formData.append('user_id', user.id);
      }

      setProgress(30);

      const { data, error } = await supabase.functions.invoke('forecast-import-history', {
        body: formData,
      });

      setProgress(90);

      if (error) {
        throw new Error(error.message);
      }

      setResult(data as ImportResult);
      setProgress(100);

      if (data.success && data.imported_rows > 0) {
        toast({
          title: t('success') as string,
          description: `${data.imported_rows} ${t('forecast.rowsImported') || 'rows imported successfully'}`,
        });
        onSuccess?.();
      }

    } catch (error: any) {
      console.error('Import error:', error);
      setResult({
        success: false,
        total_rows: 0,
        imported_rows: 0,
        skipped_duplicates: 0,
        error_rows: 0,
        errors: [],
        error: error.message || 'Import failed',
      });
      toast({
        title: t('error') as string,
        description: error.message || t('forecast.importFailed') as string,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(droppedFile);
        input.files = dataTransfer.files;
        handleFileSelect({ target: input } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const resetState = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t('forecast.importHistoricalData') || 'Satış Geçmişi İçe Aktar'}
          </DialogTitle>
          <DialogDescription>
            {t('forecast.importDescription') || 'Upload a CSV file with historical demand data to improve forecast accuracy.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{t('forecast.requiredColumns') || 'Required columns'}:</strong>
              <ul className="list-disc list-inside mt-1 text-sm">
                <li><code>kalite_kodu</code> - {t('quality') || 'Quality code'}</li>
                <li><code>renk_kodu</code> - {t('color') || 'Color code'}</li>
                <li><code>tarih</code> - {t('date') || 'Date'} (YYYY-MM-DD)</li>
                <li><code>miktar</code> - {t('amount') || 'Amount'}</li>
                <li><code>birim</code> - {t('unit') || 'Unit'} (M/KG)</li>
                <li><code>belge_durumu</code> - {t('status') || 'Status'} (confirmed/reserved)</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Download Template Button */}
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            {t('forecast.downloadTemplate') || 'Download Sample CSV Template'}
          </Button>

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="history-file-upload"
            />
            
            {file ? (
              <div className="space-y-2">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  {t('changeFile') || 'Change file'}
                </Button>
              </div>
            ) : (
              <label htmlFor="history-file-upload" className="cursor-pointer">
                <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">
                  {t('forecast.dropFileHere') || 'Drop your file here or click to browse'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  CSV, XLSX, XLS (max 20MB)
                </p>
              </label>
            )}
          </div>

          {/* Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                {t('forecast.processing') || 'Processing...'}
              </p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {result.success ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <div className="flex flex-wrap gap-3 mt-1">
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        {result.imported_rows} {t('forecast.imported') || 'imported'}
                      </Badge>
                      {result.skipped_duplicates > 0 && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                          {result.skipped_duplicates} {t('forecast.duplicatesSkipped') || 'duplicates skipped'}
                        </Badge>
                      )}
                      {result.error_rows > 0 && (
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                          {result.error_rows} {t('errors') || 'errors'}
                        </Badge>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {result.error || t('forecast.importFailed') || 'Import failed'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Details */}
              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">
                    {t('forecast.errorDetails') || 'Error Details'} ({result.errors.length})
                  </h4>
                  <ScrollArea className="h-[200px] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">{t('row') || 'Row'}</TableHead>
                          <TableHead>{t('error') || 'Error'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.errors.map((err, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{err.row}</TableCell>
                            <TableCell className="text-sm text-destructive">{err.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close') || 'Close'}
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('uploading') || 'Uploading...'}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {t('upload') || 'Upload'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HistoricalImportModal;