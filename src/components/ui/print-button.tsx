import React, { useCallback } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface PrintButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Content to print (if not provided, prints current page) */
  printContent?: () => HTMLElement | null;
  /** Title for print window */
  documentTitle?: string;
  /** Callback before printing */
  onBeforePrint?: () => void;
  /** Callback after printing */
  onAfterPrint?: () => void;
  /** Show icon only */
  iconOnly?: boolean;
}

export function PrintButton({
  printContent,
  documentTitle,
  onBeforePrint,
  onAfterPrint,
  iconOnly = false,
  children,
  ...props
}: PrintButtonProps) {
  const { t } = useLanguage();

  const handlePrint = useCallback(() => {
    onBeforePrint?.();

    if (printContent) {
      // Print specific content in a new window
      const content = printContent();
      if (!content) return;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        console.error('Failed to open print window');
        return;
      }

      // Get existing stylesheets
      const stylesheets = Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            if (sheet.href) {
              return `<link rel="stylesheet" href="${sheet.href}">`;
            }
            if (sheet.cssRules) {
              const rules = Array.from(sheet.cssRules)
                .map((rule) => rule.cssText)
                .join('\n');
              return `<style>${rules}</style>`;
            }
          } catch (e) {
            // CORS blocked stylesheets
            if (sheet.href) {
              return `<link rel="stylesheet" href="${sheet.href}">`;
            }
          }
          return '';
        })
        .join('\n');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${documentTitle || document.title}</title>
            ${stylesheets}
            <style>
              @media print {
                body { 
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            </style>
          </head>
          <body>
            ${content.outerHTML}
          </body>
        </html>
      `);

      printWindow.document.close();

      // Wait for content to load
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        
        // Close after print dialog closes
        printWindow.onafterprint = () => {
          printWindow.close();
          onAfterPrint?.();
        };
      };
    } else {
      // Print current page
      window.print();
      onAfterPrint?.();
    }
  }, [printContent, documentTitle, onBeforePrint, onAfterPrint]);

  return (
    <Button
      variant="outline"
      size={iconOnly ? 'icon' : 'default'}
      onClick={handlePrint}
      aria-label={String(t('print') || 'Print')}
      {...props}
    >
      <Printer className={iconOnly ? 'h-4 w-4' : 'h-4 w-4 mr-2'} />
      {!iconOnly && (children || t('print') || 'Print')}
    </Button>
  );
}

/**
 * Hook to handle printing with preparation
 */
export function usePrint() {
  const print = useCallback(
    (options?: {
      element?: HTMLElement;
      title?: string;
      onBeforePrint?: () => void;
      onAfterPrint?: () => void;
    }) => {
      const { element, title, onBeforePrint, onAfterPrint } = options || {};

      onBeforePrint?.();

      if (element) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const stylesheets = Array.from(document.styleSheets)
          .map((sheet) => {
            try {
              if (sheet.href) return `<link rel="stylesheet" href="${sheet.href}">`;
              if (sheet.cssRules) {
                return `<style>${Array.from(sheet.cssRules)
                  .map((r) => r.cssText)
                  .join('\n')}</style>`;
              }
            } catch {
              if (sheet.href) return `<link rel="stylesheet" href="${sheet.href}">`;
            }
            return '';
          })
          .join('\n');

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title || document.title}</title>
              ${stylesheets}
            </head>
            <body>${element.outerHTML}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
          printWindow.onafterprint = () => {
            printWindow.close();
            onAfterPrint?.();
          };
        };
      } else {
        window.print();
        onAfterPrint?.();
      }
    },
    []
  );

  return { print };
}
