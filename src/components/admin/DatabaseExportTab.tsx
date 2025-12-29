import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, Loader2, HardDrive, FileSpreadsheet, FileJson, FileText, History, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

type ExportFormat = 'excel' | 'csv' | 'json';

interface ExportTable {
  key: string;
  label: string;
  labelTr: string;
  description: string;
  descriptionTr: string;
}

interface ExportLog {
  id: string;
  export_type: string;
  tables_included: string[];
  file_size_bytes: number | null;
  row_counts: Record<string, number> | null;
  started_at: string;
  completed_at: string | null;
  status: string;
  error_message: string | null;
}

const EXPORT_TABLES: ExportTable[] = [
  {
    key: 'lots',
    label: 'Inventory (Lots)',
    labelTr: 'Envanter (Lotlar)',
    description: 'All lots with their details',
    descriptionTr: 'Tüm lotlar ve detayları',
  },
  {
    key: 'rolls',
    label: 'Rolls',
    labelTr: 'Rulolar',
    description: 'All rolls within lots',
    descriptionTr: 'Lotlardaki tüm rulolar',
  },
  {
    key: 'orders',
    label: 'Orders',
    labelTr: 'Siparişler',
    description: 'All orders with lines',
    descriptionTr: 'Tüm siparişler ve satırları',
  },
  {
    key: 'reservations',
    label: 'Reservations',
    labelTr: 'Rezervasyonlar',
    description: 'All reservations with lines',
    descriptionTr: 'Tüm rezervasyonlar ve satırları',
  },
  {
    key: 'catalog_items',
    label: 'Catalog',
    labelTr: 'Katalog',
    description: 'All catalog items',
    descriptionTr: 'Tüm katalog öğeleri',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    labelTr: 'Tedarikçiler',
    description: 'All suppliers',
    descriptionTr: 'Tüm tedarikçiler',
  },
  {
    key: 'incoming_stock',
    label: 'Incoming Stock',
    labelTr: 'Gelen Stok',
    description: 'Pending and received stock',
    descriptionTr: 'Bekleyen ve alınan stok',
  },
  {
    key: 'inventory_snapshots',
    label: 'Historical Inventory Snapshots',
    labelTr: 'Geçmiş Envanter Anlık Görüntüleri',
    description: 'Daily inventory snapshots',
    descriptionTr: 'Günlük envanter anlık görüntüleri',
  },
  {
    key: 'order_snapshots',
    label: 'Historical Order Snapshots',
    labelTr: 'Geçmiş Sipariş Anlık Görüntüleri',
    description: 'Daily order snapshots',
    descriptionTr: 'Günlük sipariş anlık görüntüleri',
  },
  {
    key: 'audit_logs',
    label: 'Audit Logs (Last 90 days)',
    labelTr: 'Denetim Günlükleri (Son 90 gün)',
    description: 'Recent audit trail',
    descriptionTr: 'Son denetim kaydı',
  },
];

const DatabaseExportTab: React.FC = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [selectedTables, setSelectedTables] = useState<string[]>(['lots', 'orders', 'reservations']);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [exporting, setExporting] = useState(false);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    fetchExportLogs();
  }, []);

  const fetchExportLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('database_export_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setExportLogs((data || []) as unknown as ExportLog[]);
    } catch (error) {
      console.error('Error fetching export logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleTable = (tableKey: string) => {
    setSelectedTables((prev) =>
      prev.includes(tableKey)
        ? prev.filter((t) => t !== tableKey)
        : [...prev, tableKey]
    );
  };

  const selectAll = () => {
    setSelectedTables(EXPORT_TABLES.map((t) => t.key));
  };

  const selectNone = () => {
    setSelectedTables([]);
  };

  const handleExport = async () => {
    if (selectedTables.length === 0) {
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'En az bir tablo seçin' : 'Select at least one table',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('export-database', {
        body: {
          tables: selectedTables,
          format: exportFormat,
        },
      });

      if (error) throw error;

      if (data?.downloadUrl) {
        // Trigger download
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename || `database-export.${exportFormat === 'excel' ? 'xlsx' : exportFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: language === 'tr' ? 'Başarılı' : 'Success',
          description: language === 'tr' ? 'Dışa aktarma tamamlandı' : 'Export completed successfully',
        });
      } else if (data?.base64) {
        // Handle base64 response
        const byteCharacters = atob(data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType || 'application/octet-stream' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.filename || `database-export.${exportFormat === 'excel' ? 'xlsx' : exportFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: language === 'tr' ? 'Başarılı' : 'Success',
          description: language === 'tr' ? 'Dışa aktarma tamamlandı' : 'Export completed successfully',
        });
      }

      fetchExportLogs();
    } catch (error: any) {
      console.error('Error exporting database:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: error.message || (language === 'tr' ? 'Dışa aktarma başarısız' : 'Export failed'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'excel':
        return <FileSpreadsheet className="h-4 w-4" />;
      case 'json':
        return <FileJson className="h-4 w-4" />;
      case 'csv':
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {language === 'tr' ? 'Veritabanı Dışa Aktarma' : 'Database Export'}
          </CardTitle>
          <CardDescription>
            {language === 'tr'
              ? 'Verilerinizin tam bir yedeğini çeşitli formatlarda indirin'
              : 'Download a complete backup of your data in various formats'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export Format Selection */}
          <div className="space-y-2">
            <Label>{language === 'tr' ? 'Dışa Aktarma Formatı' : 'Export Format'}</Label>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel (.xlsx)
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CSV (ZIP)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    JSON
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{language === 'tr' ? 'Dahil Edilecek Tablolar' : 'Tables to Include'}</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {language === 'tr' ? 'Tümünü Seç' : 'Select All'}
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  {language === 'tr' ? 'Hiçbirini Seçme' : 'Select None'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EXPORT_TABLES.map((table) => (
                <div
                  key={table.key}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTables.includes(table.key)
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => toggleTable(table.key)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedTables.includes(table.key)}
                      onCheckedChange={() => toggleTable(table.key)}
                    />
                    <div>
                      <p className="font-medium">
                        {language === 'tr' ? table.labelTr : table.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === 'tr' ? table.descriptionTr : table.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Count */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            {selectedTables.length} {language === 'tr' ? 'tablo seçildi' : 'tables selected'}
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={exporting || selectedTables.length === 0}
            className="w-full"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting
              ? (language === 'tr' ? 'Dışa Aktarılıyor...' : 'Exporting...')
              : (language === 'tr' ? 'Veritabanını İndir' : 'Download Database')}
          </Button>
        </CardContent>
      </Card>

      {/* Export History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {language === 'tr' ? 'Dışa Aktarma Geçmişi' : 'Export History'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : exportLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {language === 'tr' ? 'Henüz dışa aktarma yapılmadı' : 'No exports yet'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'tr' ? 'Tarih' : 'Date'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Format' : 'Format'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Tablolar' : 'Tables'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Boyut' : 'Size'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Durum' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exportLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.started_at), 'dd MMM yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFormatIcon(log.export_type as ExportFormat)}
                        {log.export_type.toUpperCase()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.tables_included.length} tables</Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(log.file_size_bytes)}</TableCell>
                    <TableCell>
                      {log.status === 'completed' ? (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {language === 'tr' ? 'Tamamlandı' : 'Completed'}
                        </Badge>
                      ) : log.status === 'failed' ? (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          {language === 'tr' ? 'Başarısız' : 'Failed'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          {language === 'tr' ? 'Devam Ediyor' : 'In Progress'}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseExportTab;
