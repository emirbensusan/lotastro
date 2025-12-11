import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface TableExportButtonProps {
  onExport: () => void;
  disabled?: boolean;
  className?: string;
}

export function TableExportButton({
  onExport,
  disabled = false,
  className = "",
}: TableExportButtonProps) {
  const { t } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onExport}
      disabled={disabled}
      className={className}
    >
      <Download className="h-4 w-4 mr-1" />
      {t('table.export')}
    </Button>
  );
}

// Utility function to export data to CSV
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string
) {
  if (data.length === 0) return;

  const headers = columns.map((col) => col.label).join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key];
        // Escape quotes and wrap in quotes if contains comma or quote
        const stringValue = String(value ?? "");
        if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(",")
  );

  const csvContent = [headers, ...rows].join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
