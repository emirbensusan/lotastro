import * as React from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ViewMode } from "@/hooks/useViewMode";

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

export function ViewModeToggle({ 
  viewMode, 
  onViewModeChange, 
  className,
  compact = false
}: ViewModeToggleProps) {
  const { t } = useLanguage();

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onViewModeChange(viewMode === 'table' ? 'cards' : 'table')}
        className={cn("h-8 px-2", className)}
        title={viewMode === 'table' ? String(t('viewAsCards')) : String(t('viewAsTable'))}
      >
        {viewMode === 'table' ? (
          <LayoutGrid className="h-4 w-4" />
        ) : (
          <Table2 className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <ToggleGroup 
      type="single" 
      value={viewMode} 
      onValueChange={(value) => value && onViewModeChange(value as ViewMode)}
      className={cn("border rounded-md", className)}
    >
      <ToggleGroupItem 
        value="table" 
        aria-label={String(t('viewAsTable'))}
        className="h-8 px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <Table2 className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="cards" 
        aria-label={String(t('viewAsCards'))}
        className="h-8 px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
