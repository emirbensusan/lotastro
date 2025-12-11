import * as React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, X } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";

export type SortDirection = "asc" | "desc" | null;

interface SortableTableHeadProps {
  label: string;
  sortKey: string;
  currentSort: { key: string; direction: SortDirection } | null;
  onSort: (key: string, direction: SortDirection) => void;
  filterable?: boolean;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterType?: "text" | "select";
  filterOptions?: { value: string; label: string }[];
  className?: string;
}

export function SortableTableHead({
  label,
  sortKey,
  currentSort,
  onSort,
  filterable = false,
  filterValue = "",
  onFilterChange,
  filterType = "text",
  filterOptions = [],
  className = "",
}: SortableTableHeadProps) {
  const { t } = useLanguage();
  const isActive = currentSort?.key === sortKey;
  const direction = isActive ? currentSort.direction : null;

  const handleSort = () => {
    if (!isActive || direction === null) {
      onSort(sortKey, "asc");
    } else if (direction === "asc") {
      onSort(sortKey, "desc");
    } else {
      onSort(sortKey, null);
    }
  };

  const getSortIcon = () => {
    if (!isActive || direction === null) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    if (direction === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <TableHead className={className}>
      <div className="flex items-center gap-1">
        <button
          onClick={handleSort}
          className="flex items-center hover:text-foreground transition-colors"
        >
          {label}
          {getSortIcon()}
        </button>
        
        {filterable && onFilterChange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-6 w-6 p-0 ${filterValue ? 'text-primary' : 'opacity-50'}`}
              >
                <Filter className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('table.filter')} {label}</p>
                {filterType === "text" ? (
                  <Input
                    placeholder={`${t('filter')}...`}
                    value={filterValue}
                    onChange={(e) => onFilterChange(e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <Select value={filterValue} onValueChange={onFilterChange}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={`${t('filter')}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">
                        {t('all')}
                      </SelectItem>
                      {filterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filterValue && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFilterChange("")}
                    className="w-full h-7 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    {t('clearFilters')}
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TableHead>
  );
}
