import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  History, Download, Eye, Trash2, RefreshCw, Clock, 
  CheckCircle, XCircle, Loader2, FileSpreadsheet, FileText,
  BarChart3, Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReportExecution {
  id: string;
  report_config_id: string | null;
  executed_by: string;
  executed_at: string;
  execution_type: string;
  status: string;
  error_message: string | null;
  row_count: number | null;
  duration_ms: number | null;
  output_format: string;
  file_path: string | null;
  file_size_bytes: number | null;
  metadata: Record<string, any>;
  report_name?: string;
  executed_by_name?: string;
}

interface ReportExecutionHistoryProps {
  reportConfigId?: string;
  showFilters?: boolean;
  limit?: number;
}

const ReportExecutionHistory: React.FC<ReportExecutionHistoryProps> = ({
  reportConfigId,
  showFilters = true,
  limit = 50,
}) => {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchExecutions();
  }, [reportConfigId, statusFilter, typeFilter]);

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('report_executions')
        .select(`
          *,
          email_report_configs:report_config_id (name),
          profiles:executed_by (full_name)
        `)
        .order('executed_at', { ascending: false })
        .limit(limit);

      if (reportConfigId) {
        query = query.eq('report_config_id', reportConfigId);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('execution_type', typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setExecutions((data || []).map((exec: any) => ({
        ...exec,
        report_name: exec.email_report_configs?.name || exec.metadata?.report_name || 'Unknown Report',
        executed_by_name: exec.profiles?.full_name || 'System',
      })));
    } catch (error) {
      console.error('Error fetching executions:', error);
      toast({
        title: String(t('error')),
        description: language === 'tr' ? 'Çalıştırma geçmişi yüklenemedi' : 'Failed to load execution history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (execution: ReportExecution) => {
    if (!execution.file_path) {
      toast({
        title: String(t('error')),
        description: language === 'tr' ? 'Dosya bulunamadı' : 'File not available',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('reports')
        .download(execution.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = execution.file_path.split('/').pop() || 'report';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: String(t('error')),
        description: language === 'tr' ? 'Dosya indirilemedi' : 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'tr' ? 'Bu kaydı silmek istediğinizden emin misiniz?' : 'Are you sure you want to delete this record?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('report_executions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: String(t('deleted')),
        description: language === 'tr' ? 'Kayıt silindi' : 'Record deleted',
      });
      fetchExecutions();
    } catch (error) {
      console.error('Error deleting execution:', error);
      toast({
        title: String(t('error')),
        description: language === 'tr' ? 'Kayıt silinemedi' : 'Failed to delete record',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            {language === 'tr' ? 'Tamamlandı' : 'Completed'}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            {language === 'tr' ? 'Başarısız' : 'Failed'}
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {language === 'tr' ? 'Çalışıyor' : 'Running'}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'manual':
        return <Badge variant="outline">{language === 'tr' ? 'Manuel' : 'Manual'}</Badge>;
      case 'scheduled':
        return <Badge variant="secondary">{language === 'tr' ? 'Zamanlanmış' : 'Scheduled'}</Badge>;
      case 'shared':
        return <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">{language === 'tr' ? 'Paylaşımlı' : 'Shared'}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'excel':
        return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
      case 'csv':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-600" />;
      default:
        return <BarChart3 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {language === 'tr' ? 'Çalıştırma Geçmişi' : 'Execution History'}
            </CardTitle>
            <CardDescription>
              {language === 'tr' 
                ? 'Geçmiş rapor çalıştırmalarını görüntüleyin ve indirin' 
                : 'View and download past report executions'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchExecutions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === 'tr' ? 'Yenile' : 'Refresh'}
          </Button>
        </div>

        {showFilters && (
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={language === 'tr' ? 'Durum' : 'Status'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'tr' ? 'Tüm Durumlar' : 'All Status'}</SelectItem>
                  <SelectItem value="completed">{language === 'tr' ? 'Tamamlandı' : 'Completed'}</SelectItem>
                  <SelectItem value="failed">{language === 'tr' ? 'Başarısız' : 'Failed'}</SelectItem>
                  <SelectItem value="running">{language === 'tr' ? 'Çalışıyor' : 'Running'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={language === 'tr' ? 'Tür' : 'Type'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'tr' ? 'Tüm Türler' : 'All Types'}</SelectItem>
                  <SelectItem value="manual">{language === 'tr' ? 'Manuel' : 'Manual'}</SelectItem>
                  <SelectItem value="scheduled">{language === 'tr' ? 'Zamanlanmış' : 'Scheduled'}</SelectItem>
                  <SelectItem value="shared">{language === 'tr' ? 'Paylaşımlı' : 'Shared'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{language === 'tr' ? 'Henüz çalıştırma geçmişi yok' : 'No execution history yet'}</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'tr' ? 'Rapor' : 'Report'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Durum' : 'Status'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Tür' : 'Type'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Format' : 'Format'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Satırlar' : 'Rows'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Süre' : 'Duration'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Çalıştıran' : 'Executed By'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Tarih' : 'Date'}</TableHead>
                  <TableHead>{language === 'tr' ? 'İşlemler' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell className="font-medium">
                      {execution.report_name}
                    </TableCell>
                    <TableCell>{getStatusBadge(execution.status)}</TableCell>
                    <TableCell>{getTypeBadge(execution.execution_type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFormatIcon(execution.output_format)}
                        <span className="text-xs uppercase">{execution.output_format}</span>
                      </div>
                    </TableCell>
                    <TableCell>{execution.row_count ?? '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDuration(execution.duration_ms)}
                    </TableCell>
                    <TableCell className="text-sm">{execution.executed_by_name}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(execution.executed_at), { addSuffix: true })}
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(new Date(execution.executed_at), 'PPpp')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {execution.file_path && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(execution)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                        {execution.error_message && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-3 w-3 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-sm">{execution.error_message}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(execution.id)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportExecutionHistory;
