import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, Loader2, FileSpreadsheet, FileText, 
  Download, ChevronDown, BarChart3
} from 'lucide-react';

interface RunReportButtonProps {
  reportId: string;
  reportName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  onExecutionComplete?: () => void;
}

const RunReportButton: React.FC<RunReportButtonProps> = ({
  reportId,
  reportName,
  variant = 'default',
  size = 'default',
  onExecutionComplete,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);

  const runReport = async (format: 'html' | 'excel' | 'csv' | 'pdf') => {
    setRunning(true);
    setSelectedFormat(format);
    const startTime = Date.now();

    try {
      const { data: user } = await supabase.auth.getUser();
      
      // Create execution record
      const { data: execution, error: execError } = await supabase
        .from('report_executions')
        .insert({
          report_config_id: reportId,
          executed_by: user.user?.id,
          execution_type: 'manual',
          status: 'running',
          output_format: format,
          metadata: { report_name: reportName },
        })
        .select('id')
        .single();

      if (execError) throw execError;

      // Generate report
      const { data: reportData, error: reportError } = await supabase.functions.invoke(
        'generate-report-attachment',
        {
          body: {
            config_id: reportId,
            format,
          },
        }
      );

      if (reportError) throw reportError;

      const duration = Date.now() - startTime;

      // Update execution record with success
      await supabase
        .from('report_executions')
        .update({
          status: 'completed',
          row_count: reportData.row_count || 0,
          duration_ms: duration,
          file_path: reportData.file_path || null,
          file_size_bytes: reportData.file_size || null,
        })
        .eq('id', execution.id);

      // Handle download based on format
      if (format === 'html' || format === 'pdf') {
        // Open in new tab for HTML/PDF preview
        const blob = new Blob([reportData.content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        // Download file for other formats
        let blob: Blob;
        let filename: string;
        
        if (format === 'excel') {
          // Decode base64 to blob for Excel
          const binary = atob(reportData.content);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          filename = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        } else if (format === 'csv') {
          blob = new Blob([reportData.content], { type: 'text/csv' });
          filename = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        } else {
          throw new Error('Unsupported format');
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: language === 'tr' ? 'Rapor Oluşturuldu' : 'Report Generated',
        description: language === 'tr' 
          ? `${reportData.row_count || 0} satır, ${(duration / 1000).toFixed(1)} saniye`
          : `${reportData.row_count || 0} rows, ${(duration / 1000).toFixed(1)} seconds`,
      });

      onExecutionComplete?.();

    } catch (error: any) {
      console.error('Error running report:', error);
      
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: error.message || (language === 'tr' ? 'Rapor oluşturulamadı' : 'Failed to generate report'),
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
      setSelectedFormat(null);
    }
  };

  const formatOptions = [
    { key: 'html', label: language === 'tr' ? 'HTML Önizleme' : 'HTML Preview', icon: BarChart3 },
    { key: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
    { key: 'csv', label: 'CSV', icon: FileText },
    { key: 'pdf', label: language === 'tr' ? 'PDF (Yazdır)' : 'PDF (Print)', icon: FileText },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={running}>
          {running ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {language === 'tr' ? 'Çalıştır' : 'Run'}
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formatOptions.map((option, index) => (
          <React.Fragment key={option.key}>
            <DropdownMenuItem
              onClick={() => runReport(option.key as any)}
              disabled={running}
            >
              <option.icon className="h-4 w-4 mr-2" />
              {option.label}
              {running && selectedFormat === option.key && (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              )}
            </DropdownMenuItem>
            {index === 0 && <DropdownMenuSeparator />}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RunReportButton;
