import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ColumnBrowser, TableDefinition, ColumnDefinition, TableRelationship } from '../ColumnBrowser';
import { JoinPathDisplay } from '../JoinPathDisplay';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface ColumnBrowserTabProps {
  reportName: string;
  onReportNameChange: (name: string) => void;
  selectedColumns: ColumnDefinition[];
  onColumnsChange: (columns: ColumnDefinition[]) => void;
}

export const ColumnBrowserTab: React.FC<ColumnBrowserTabProps> = ({
  reportName,
  onReportNameChange,
  selectedColumns,
  onColumnsChange,
}) => {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  
  const [tables, setTables] = useState<TableDefinition[]>([]);
  const [relationships, setRelationships] = useState<TableRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [joinPath, setJoinPath] = useState<TableRelationship[]>([]);
  const [canJoin, setCanJoin] = useState(true);
  const [joinError, setJoinError] = useState<string | undefined>();

  // Get unique tables from selected columns
  const selectedTables = [...new Set(selectedColumns.map(c => c.table))];

  // Fetch all tables and relationships on mount
  useEffect(() => {
    const fetchSchema = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-report-schema', {
          body: { mode: 'getAllColumnsWithRelationships' },
        });
        
        if (error) throw error;
        
        setTables(data.tables || []);
        setRelationships(data.relationships || []);
      } catch (error) {
        console.error('Error fetching schema:', error);
        toast({
          title: String(t('error')),
          description: 'Failed to load schema',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchSchema();
  }, []);

  // Update join path when selected tables change
  useEffect(() => {
    const updateJoinPath = async () => {
      if (selectedTables.length <= 1) {
        setJoinPath([]);
        setCanJoin(true);
        setJoinError(undefined);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-report-schema', {
          body: { mode: 'getJoinPath', tables: selectedTables },
        });
        
        if (error) throw error;
        
        setJoinPath(data.joinPath || []);
        setCanJoin(data.canJoin);
        setJoinError(data.error);
      } catch (error) {
        console.error('Error getting join path:', error);
      }
    };
    
    updateJoinPath();
  }, [selectedTables.join(',')]);

  const handleValidateColumn = useCallback(async (column: ColumnDefinition): Promise<{ canJoin: boolean; error?: string }> => {
    // If no columns selected yet, or column is from already selected table, allow
    if (selectedColumns.length === 0 || selectedTables.includes(column.table)) {
      return { canJoin: true };
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-report-schema', {
        body: { 
          mode: 'validateColumnCompatibility',
          tables: selectedTables,
          checkTable: column.table,
        },
      });
      
      if (error) throw error;
      
      if (!data.canJoin) {
        setValidationErrors(prev => ({
          ...prev,
          [`${column.table}.${column.key}`]: data.error || 'Cannot join tables',
        }));
      }
      
      return { canJoin: data.canJoin, error: data.error };
    } catch (error) {
      console.error('Error validating column:', error);
      return { canJoin: false, error: 'Validation failed' };
    }
  }, [selectedColumns, selectedTables]);

  const handleColumnToggle = useCallback((column: ColumnDefinition) => {
    const isSelected = selectedColumns.some(c => c.key === column.key && c.table === column.table);
    
    if (isSelected) {
      // Remove column
      const newColumns = selectedColumns.filter(c => !(c.key === column.key && c.table === column.table));
      onColumnsChange(newColumns);
      
      // Clear any validation error for this column
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[`${column.table}.${column.key}`];
        return next;
      });
    } else {
      // Add column
      onColumnsChange([...selectedColumns, column]);
    }
  }, [selectedColumns, onColumnsChange]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('reportBuilder.reportName')}</Label>
        <Input
          value={reportName}
          onChange={(e) => onReportNameChange(e.target.value)}
          placeholder={String(t('reportBuilder.reportNamePlaceholder'))}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>
          {language === 'tr' ? 'Sütun Seçin' : 'Select Columns'}
        </Label>
        <p className="text-sm text-muted-foreground">
          {language === 'tr' 
            ? 'Rapora eklemek istediğiniz sütunları seçin. Sistem ilişkili tabloları otomatik olarak birleştirecek.'
            : 'Select columns to add to your report. The system will automatically join related tables.'
          }
        </p>
      </div>

      <ColumnBrowser
        tables={tables}
        relationships={relationships}
        selectedColumns={selectedColumns}
        onColumnToggle={handleColumnToggle}
        onValidateColumn={handleValidateColumn}
        validationErrors={validationErrors}
        loading={loading}
      />

      <JoinPathDisplay
        joinPath={joinPath}
        selectedTables={selectedTables}
        canJoin={canJoin}
        error={joinError}
      />
    </div>
  );
};
