import React, { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, ChevronDown, ChevronRight, Plus, Check, 
  Calendar, Hash, Type, ToggleLeft, DollarSign,
  AlertCircle, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
}

export interface TableDefinition {
  table: string;
  labelEn: string;
  labelTr: string;
  descriptionEn: string;
  descriptionTr: string;
  columns: ColumnDefinition[];
  columnCount: number;
}

export interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-many' | 'many-to-one' | 'one-to-one';
}

interface ColumnBrowserProps {
  tables: TableDefinition[];
  relationships: TableRelationship[];
  selectedColumns: ColumnDefinition[];
  onColumnToggle: (column: ColumnDefinition) => void;
  onValidateColumn: (column: ColumnDefinition) => Promise<{ canJoin: boolean; error?: string }>;
  validationErrors: Record<string, string>;
  loading?: boolean;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type,
  number: Hash,
  date: Calendar,
  currency: DollarSign,
  boolean: ToggleLeft,
};

export const ColumnBrowser: React.FC<ColumnBrowserProps> = ({
  tables,
  relationships,
  selectedColumns,
  onColumnToggle,
  onValidateColumn,
  validationErrors,
  loading = false,
}) => {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [validatingColumn, setValidatingColumn] = useState<string | null>(null);

  // Get tables that have selected columns
  const selectedTables = useMemo(() => {
    return [...new Set(selectedColumns.map(c => c.table))];
  }, [selectedColumns]);

  // Filter columns by search
  const filteredTables = useMemo(() => {
    if (!search.trim()) return tables;
    
    const searchLower = search.toLowerCase();
    return tables.map(table => {
      const filteredColumns = table.columns.filter(col => {
        const label = language === 'tr' ? col.labelTr : col.labelEn;
        return (
          label.toLowerCase().includes(searchLower) ||
          col.key.toLowerCase().includes(searchLower) ||
          table.table.toLowerCase().includes(searchLower)
        );
      });
      return { ...table, columns: filteredColumns };
    }).filter(table => table.columns.length > 0);
  }, [tables, search, language]);

  const toggleTable = useCallback((table: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(table)) {
        next.delete(table);
      } else {
        next.add(table);
      }
      return next;
    });
  }, []);

  const isColumnSelected = useCallback((column: ColumnDefinition) => {
    return selectedColumns.some(c => c.key === column.key && c.table === column.table);
  }, [selectedColumns]);

  const handleColumnClick = useCallback(async (column: ColumnDefinition) => {
    if (isColumnSelected(column)) {
      onColumnToggle(column);
      return;
    }

    // Validate if column can be added
    setValidatingColumn(`${column.table}.${column.key}`);
    try {
      const result = await onValidateColumn(column);
      if (result.canJoin) {
        onColumnToggle(column);
      }
    } finally {
      setValidatingColumn(null);
    }
  }, [isColumnSelected, onColumnToggle, onValidateColumn]);

  const getColumnError = useCallback((column: ColumnDefinition) => {
    return validationErrors[`${column.table}.${column.key}`];
  }, [validationErrors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={language === 'tr' ? 'Sütun veya tablo ara...' : 'Search columns or tables...'}
          className="pl-9"
        />
      </div>

      {/* Selected count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {language === 'tr' ? 'Seçili sütunlar:' : 'Selected columns:'}{' '}
          <span className="font-medium text-foreground">{selectedColumns.length}</span>
        </span>
        {selectedTables.length > 0 && (
          <span className="text-muted-foreground">
            {language === 'tr' ? 'Tablolar:' : 'Tables:'}{' '}
            <span className="font-medium text-foreground">{selectedTables.join(', ')}</span>
          </span>
        )}
      </div>

      {/* Table list */}
      <ScrollArea className="h-[400px] border rounded-lg">
        <div className="p-2 space-y-1">
          {filteredTables.map((table) => {
            const isExpanded = expandedTables.has(table.table);
            const hasSelectedColumns = selectedColumns.some(c => c.table === table.table);
            const selectedCount = selectedColumns.filter(c => c.table === table.table).length;
            
            return (
              <Collapsible key={table.table} open={isExpanded} onOpenChange={() => toggleTable(table.table)}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start px-2 py-2 h-auto",
                      hasSelectedColumns && "bg-primary/5"
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 mr-2 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2 shrink-0" />
                    )}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {language === 'tr' ? table.labelTr : table.labelEn}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {table.columnCount}
                        </Badge>
                        {selectedCount > 0 && (
                          <Badge variant="default" className="text-xs">
                            {selectedCount} {language === 'tr' ? 'seçili' : 'selected'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-normal">
                        {language === 'tr' ? table.descriptionTr : table.descriptionEn}
                      </p>
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 pl-2 border-l space-y-1 py-1">
                    {table.columns.map((column) => {
                      const selected = isColumnSelected(column);
                      const error = getColumnError(column);
                      const isValidating = validatingColumn === `${column.table}.${column.key}`;
                      const TypeIcon = typeIcons[column.type] || Type;
                      
                      return (
                        <button
                          key={`${column.table}.${column.key}`}
                          onClick={() => handleColumnClick(column)}
                          disabled={isValidating}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                            selected 
                              ? "bg-primary/10 text-primary" 
                              : error 
                                ? "bg-destructive/10 text-destructive"
                                : "hover:bg-muted",
                            isValidating && "opacity-50 cursor-wait"
                          )}
                        >
                          {isValidating ? (
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                          ) : selected ? (
                            <Check className="h-4 w-4 shrink-0" />
                          ) : error ? (
                            <AlertCircle className="h-4 w-4 shrink-0" />
                          ) : (
                            <Plus className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100" />
                          )}
                          <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">
                            {language === 'tr' ? column.labelTr : column.labelEn}
                          </span>
                          <span className="text-xs text-muted-foreground">{column.type}</span>
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
