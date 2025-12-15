import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export interface MobileDataCardField {
  label: string;
  value: React.ReactNode;
  className?: string;
  priority?: 'primary' | 'secondary' | 'tertiary';
}

export interface MobileDataCardProps {
  /** Primary title displayed prominently */
  title: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Badge to display (e.g., status) */
  badge?: {
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
  };
  /** Fields to display in grid layout */
  fields: MobileDataCardField[];
  /** Optional action button */
  onAction?: () => void;
  /** Action button label */
  actionLabel?: string;
  /** Optional click handler for entire card */
  onClick?: () => void;
  /** Whether to show chevron indicator */
  showChevron?: boolean;
  /** Additional className */
  className?: string;
  /** Left border color for visual distinction */
  accentColor?: string;
  /** Optional checkbox for selection */
  checkbox?: React.ReactNode;
}

export const MobileDataCard = React.forwardRef<HTMLDivElement, MobileDataCardProps>(
  ({ 
    title, 
    subtitle, 
    badge, 
    fields, 
    onAction, 
    actionLabel,
    onClick, 
    showChevron = true,
    className,
    accentColor,
    checkbox
  }, ref) => {
    const primaryFields = fields.filter(f => f.priority === 'primary' || !f.priority);
    const secondaryFields = fields.filter(f => f.priority === 'secondary');
    const tertiaryFields = fields.filter(f => f.priority === 'tertiary');

    return (
      <Card 
        ref={ref}
        className={cn(
          "relative overflow-hidden transition-colors",
          onClick && "cursor-pointer hover:bg-accent/50 active:bg-accent",
          accentColor && "border-l-4",
          className
        )}
        style={accentColor ? { borderLeftColor: accentColor } : undefined}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Checkbox if provided */}
            {checkbox && (
              <div className="pt-1" onClick={e => e.stopPropagation()}>
                {checkbox}
              </div>
            )}
            
            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base truncate">{title}</h3>
                  {subtitle && (
                    <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {badge && (
                    <Badge 
                      variant={badge.variant || 'secondary'} 
                      className={cn("text-xs", badge.className)}
                    >
                      {badge.label}
                    </Badge>
                  )}
                  {showChevron && onClick && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Primary fields grid */}
              {primaryFields.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {primaryFields.map((field, idx) => (
                    <div key={idx} className={cn("flex flex-col", field.className)}>
                      <span className="text-muted-foreground text-xs">{field.label}</span>
                      <span className="font-medium">{field.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Secondary fields - smaller text */}
              {secondaryFields.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2 pt-2 border-t">
                  {secondaryFields.map((field, idx) => (
                    <div key={idx} className={cn("flex justify-between", field.className)}>
                      <span className="text-muted-foreground">{field.label}:</span>
                      <span>{field.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tertiary fields - even smaller, muted */}
              {tertiaryFields.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-2">
                  {tertiaryFields.map((field, idx) => (
                    <span key={idx} className={field.className}>
                      {field.label}: {field.value}
                    </span>
                  ))}
                </div>
              )}

              {/* Action button */}
              {onAction && actionLabel && (
                <div className="mt-3" onClick={e => e.stopPropagation()}>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={onAction}
                  >
                    {actionLabel}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

MobileDataCard.displayName = "MobileDataCard";
