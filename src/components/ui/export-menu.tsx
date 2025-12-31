import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export type ExportFormat = 'xlsx' | 'csv';

interface ExportMenuProps {
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
  className?: string;
  formats?: ExportFormat[];
}

const formatConfig = {
  xlsx: {
    label: 'Excel (.xlsx)',
    icon: FileSpreadsheet,
  },
  csv: {
    label: 'CSV (.csv)',
    icon: FileText,
  },
};

export function ExportMenu({
  onExport,
  disabled,
  className,
  formats = ['xlsx', 'csv'],
}: ExportMenuProps) {
  const { t } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setActiveFormat(format);
    try {
      await onExport(format);
    } finally {
      setIsExporting(false);
      setActiveFormat(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting}
          className={cn('min-w-[100px]', className)}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('exporting') || 'Exporting...'}
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              {t('export') || 'Export'}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => {
          const config = formatConfig[format];
          const Icon = config.icon;
          const isActive = activeFormat === format;

          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleExport(format)}
              disabled={isExporting}
            >
              {isActive ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 mr-2" />
              )}
              {config.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
