import * as React from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface ViewDetailsButtonProps {
  onClick: () => void;
  showLabel?: boolean;
  className?: string;
}

export function ViewDetailsButton({
  onClick,
  showLabel = true,
  className = "",
}: ViewDetailsButtonProps) {
  const { t } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={`bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 ${className}`}
    >
      <Eye className="h-3 w-3" />
      {showLabel && <span className="ml-1">{t('table.seeDetails')}</span>}
    </Button>
  );
}
