import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Archive, FileJson, FileSpreadsheet, Database, AlertTriangle, CalendarIcon } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface ExportStats {
  totalLogs: number;
  oldestLog: string | null;
  newestLog: string | null;
  byAction: Record<string, number>;
  byEntity: Record<string, number>;
}

const AuditLogExportTab: React.FC = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Get total count
      const { count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });

      // Get oldest and newest logs
      const [oldest, newest] = await Promise.all([
        supabase.from('audit_logs').select('created_at').order('created_at', { ascending: true }).limit(1).single(),
        supabase.from('audit_logs').select('created_at').order('created_at', { ascending: false }).limit(1).single()
      ]);

      // Get breakdown by action
      const { data: actionData } = await supabase
        .from('audit_logs')
        .select('action');
      
      const byAction: Record<string, number> = {};
      (actionData || []).forEach(row => {
        byAction[row.action] = (byAction[row.action] || 0) + 1;
      });

      // Get breakdown by entity
      const { data: entityData } = await supabase
        .from('audit_logs')
        .select('entity_type');
      
      const byEntity: Record<string, number> = {};
      (entityData || []).forEach(row => {
        byEntity[row.entity_type] = (byEntity[row.entity_type] || 0) + 1;
      });

      setStats({
        totalLogs: count || 0,
        oldestLog: oldest.data?.created_at || null,
        newestLog: newest.data?.created_at || null,
        byAction,
        byEntity
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    
    try {
      // Build query
      let query = supabase.from('audit_logs').select('*');
      
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }
      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter as any);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter as any);
      }
      
      query = query.order('created_at', { ascending: false });
      
      setExportProgress(20);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setExportProgress(60);
      
      // Format data for export
      const exportData = (data || []).map(log => ({
        id: log.id,
        timestamp: log.created_at,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        entity_identifier: log.entity_identifier || '',
        user_email: log.user_email,
        user_role: log.user_role,
        is_reversed: log.is_reversed ? 'Yes' : 'No',
        notes: log.notes || '',
        old_data: log.old_data ? JSON.stringify(log.old_data) : '',
        new_data: log.new_data ? JSON.stringify(log.new_data) : ''
      }));
      
      setExportProgress(80);
      
      let content: string;
      let filename: string;
      let mimeType: string;
      
      if (exportFormat === 'json') {
        content = JSON.stringify(exportData, null, 2);
        filename = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.json`;
        mimeType = 'application/json';
      } else {
        // CSV export
        const headers = Object.keys(exportData[0] || {});
        const csvRows = [
          headers.join(','),
          ...exportData.map(row => 
            headers.map(h => {
              const val = String((row as any)[h] || '');
              // Escape quotes and wrap in quotes if contains comma or quote
              if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                return `"${val.replace(/"/g, '""')}"`;
              }
              return val;
            }).join(',')
          )
        ];
        content = csvRows.join('\n');
        filename = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        mimeType = 'text/csv';
      }
      
      setExportProgress(100);
      
      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: language === 'tr' ? 'Başarılı' : 'Success',
        description: language === 'tr' 
          ? `${exportData.length} kayıt dışa aktarıldı` 
          : `Exported ${exportData.length} records`
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: error.message || (language === 'tr' ? 'Dışa aktarma başarısız' : 'Export failed'),
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleArchive = async () => {
    // Archive old logs (move to cold storage or mark as archived)
    toast({
      title: language === 'tr' ? 'Bilgi' : 'Info',
      description: language === 'tr' 
        ? 'Arşivleme özelliği yakında eklenecek' 
        : 'Archive feature coming soon'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === 'tr' ? 'Toplam Kayıt' : 'Total Records'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLogs.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === 'tr' ? 'En Eski Kayıt' : 'Oldest Record'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {stats?.oldestLog ? format(new Date(stats.oldestLog), 'PP') : '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === 'tr' ? 'En Yeni Kayıt' : 'Newest Record'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {stats?.newestLog ? format(new Date(stats.newestLog), 'PP') : '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === 'tr' ? 'Varlık Türleri' : 'Entity Types'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats?.byEntity || {}).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {language === 'tr' ? 'İşlem Dağılımı' : 'Action Breakdown'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats?.byAction || {}).map(([action, count]) => (
              <Badge key={action} variant="outline" className="text-sm">
                {action}: {count.toLocaleString()}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {language === 'tr' ? 'Denetim Kaydı Dışa Aktarma' : 'Audit Log Export'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Denetim kayıtlarını CSV veya JSON formatında dışa aktarın' 
              : 'Export audit logs in CSV or JSON format'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>{language === 'tr' ? 'Tarih Aralığı' : 'Date Range'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>{language === 'tr' ? 'Tarih seçin' : 'Pick a date range'}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Varlık Türü' : 'Entity Type'}</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'tr' ? 'Tümü' : 'All'}</SelectItem>
                  {Object.keys(stats?.byEntity || {}).map(entity => (
                    <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'İşlem' : 'Action'}</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'tr' ? 'Tümü' : 'All'}</SelectItem>
                  {Object.keys(stats?.byAction || {}).map(action => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Format' : 'Format'}</Label>
              <Select value={exportFormat} onValueChange={(v: 'csv' | 'json') => setExportFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      CSV
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
          </div>

          {/* Export Progress */}
          {exporting && (
            <div className="space-y-2">
              <Progress value={exportProgress} />
              <p className="text-sm text-muted-foreground text-center">
                {language === 'tr' ? 'Dışa aktarılıyor...' : 'Exporting...'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {language === 'tr' ? 'Dışa Aktar' : 'Export'}
            </Button>
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="h-4 w-4 mr-2" />
              {language === 'tr' ? 'Arşivle' : 'Archive'}
            </Button>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                {language === 'tr' ? 'Dikkat' : 'Note'}
              </p>
              <p>
                {language === 'tr' 
                  ? 'Büyük veri setleri için dışa aktarma işlemi birkaç dakika sürebilir.'
                  : 'Large data exports may take several minutes to complete.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogExportTab;
