import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useLanguage } from '@/contexts/LanguageContext';

export interface ExportColumn {
  key: string;
  header: string;
  format?: (value: unknown) => string | number;
}

export interface ExportOptions {
  filename: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  includeTimestamp?: boolean;
  sheetName?: string;
}

export function useExport() {
  const { t } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);

  const formatFilename = useCallback((filename: string, format: string, includeTimestamp?: boolean) => {
    const timestamp = includeTimestamp
      ? `_${new Date().toISOString().split('T')[0]}`
      : '';
    return `${filename}${timestamp}.${format}`;
  }, []);

  const prepareData = useCallback((options: ExportOptions) => {
    return options.data.map((row) => {
      const formattedRow: Record<string, string | number> = {};
      options.columns.forEach((col) => {
        const value = row[col.key];
        formattedRow[col.header] = col.format
          ? col.format(value)
          : value == null
            ? ''
            : String(value);
      });
      return formattedRow;
    });
  }, []);

  const exportToXlsx = useCallback(
    async (options: ExportOptions) => {
      setIsExporting(true);
      try {
        const data = prepareData(options);
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          options.sheetName || 'Data'
        );

        // Auto-size columns
        const maxWidth = 50;
        const colWidths = options.columns.map((col) => {
          const headerLen = col.header.length;
          const maxDataLen = Math.max(
            ...data.map((row) => String(row[col.header] || '').length)
          );
          return { wch: Math.min(Math.max(headerLen, maxDataLen) + 2, maxWidth) };
        });
        worksheet['!cols'] = colWidths;

        const filename = formatFilename(options.filename, 'xlsx', options.includeTimestamp);
        XLSX.writeFile(workbook, filename);

        toast.success(t('exportSuccess') || 'Export completed successfully');
      } catch (error) {
        console.error('Export error:', error);
        toast.error(t('exportError') || 'Failed to export data');
      } finally {
        setIsExporting(false);
      }
    },
    [prepareData, formatFilename, t]
  );

  const exportToCsv = useCallback(
    async (options: ExportOptions) => {
      setIsExporting(true);
      try {
        const data = prepareData(options);
        const headers = options.columns.map((col) => col.header);

        // Escape CSV values
        const escapeCsvValue = (value: string | number) => {
          const str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const csvRows = [
          headers.map(escapeCsvValue).join(','),
          ...data.map((row) =>
            headers.map((h) => escapeCsvValue(row[h] || '')).join(',')
          ),
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\ufeff' + csvContent], {
          type: 'text/csv;charset=utf-8;',
        });

        const filename = formatFilename(options.filename, 'csv', options.includeTimestamp);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);

        toast.success(t('exportSuccess') || 'Export completed successfully');
      } catch (error) {
        console.error('Export error:', error);
        toast.error(t('exportError') || 'Failed to export data');
      } finally {
        setIsExporting(false);
      }
    },
    [prepareData, formatFilename, t]
  );

  const exportData = useCallback(
    async (format: 'xlsx' | 'csv', options: ExportOptions) => {
      if (format === 'xlsx') {
        await exportToXlsx(options);
      } else {
        await exportToCsv(options);
      }
    },
    [exportToXlsx, exportToCsv]
  );

  return {
    exportData,
    exportToXlsx,
    exportToCsv,
    isExporting,
  };
}
