import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  FileText, Plus, Edit, Trash2, Copy, 
  FileSpreadsheet, Mail, Database
} from 'lucide-react';

interface ReportConfig {
  id: string;
  name: string;
  report_type: string;
  data_source: string | null;
  selected_joins: string[];
  columns_config: any[];
  columns: string[];
  filters: Record<string, any>;
  include_charts: boolean;
  output_formats: string[];
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const OUTPUT_FORMATS = [
  { key: 'html', labelEn: 'HTML Email', labelTr: 'HTML E-posta', icon: Mail },
  { key: 'csv', labelEn: 'CSV File', labelTr: 'CSV Dosyası', icon: FileSpreadsheet },
  { key: 'excel', labelEn: 'Excel File', labelTr: 'Excel Dosyası', icon: FileSpreadsheet },
];

const ReportTemplatesTab: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('email_report_configs')
        .select('*')
        .order('name');

      if (error) throw error;
      
      setConfigs((data || []).map(d => ({
        ...d,
        columns: Array.isArray(d.columns) ? d.columns as string[] : [],
        columns_config: Array.isArray(d.columns_config) ? d.columns_config : [],
        selected_joins: Array.isArray(d.selected_joins) ? d.selected_joins as string[] : [],
        filters: typeof d.filters === 'object' ? d.filters as Record<string, any> : {},
        output_formats: d.output_formats || ['html'],
        include_charts: d.include_charts ?? false,
      })));
    } catch (error) {
      console.error('Error fetching report configs:', error);
      toast({
        title: String(t('error')),
        description: String(t('reportTemplates.loadError')),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    navigate('/reports/builder');
  };

  const handleEdit = (config: ReportConfig) => {
    navigate(`/reports/builder/${config.id}`);
  };

  const handleDuplicate = (config: ReportConfig) => {
    navigate(`/reports/builder?duplicate=${config.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(String(t('reportTemplates.deleteConfirm')))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_report_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: String(t('deleted')),
        description: String(t('reportTemplates.deleteSuccess')),
      });
      fetchConfigs();
    } catch (error) {
      console.error('Error deleting config:', error);
      toast({
        title: String(t('error')),
        description: String(t('reportTemplates.deleteError')),
        variant: 'destructive',
      });
    }
  };

  const getDataSourceLabel = (config: ReportConfig) => {
    return config.data_source || config.report_type || '-';
  };

  const getColumnsCount = (config: ReportConfig) => {
    if (config.columns_config && config.columns_config.length > 0) {
      return config.columns_config.length;
    }
    return config.columns?.length || 0;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('reportTemplates.title')}
            </CardTitle>
            <CardDescription>
              {t('reportTemplates.description')}
            </CardDescription>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t('reportTemplates.newReport')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('reportTemplates.noTemplates')}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t('reportTemplates.reportName')}</TableHead>
                  <TableHead>{t('reportBuilder.dataSource')}</TableHead>
                  <TableHead>{t('reportTemplates.columns')}</TableHead>
                  <TableHead>{t('reportTemplates.outputFormats')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(config => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.name}</span>
                        {config.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            {t('system')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">{getDataSourceLabel(config)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getColumnsCount(config)} {t('reportTemplates.columnsCount')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {config.output_formats?.map(fmt => {
                          const format = OUTPUT_FORMATS.find(f => f.key === fmt);
                          if (!format) return null;
                          const Icon = format.icon;
                          return (
                            <TooltipProvider key={fmt}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="secondary" className="h-6 w-6 p-0 flex items-center justify-center">
                                    <Icon className="h-3 w-3" />
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {language === 'tr' ? format.labelTr : format.labelEn}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(config)}>
                          <Edit className="h-3 w-3 mr-1" />
                          {t('edit')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(config)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        {!config.is_system && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(config.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportTemplatesTab;
