import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  History, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Edit2, 
  RefreshCw,
  CheckCircle 
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  catalog_item_id: string;
  changed_by_user_id: string | null;
  changed_at: string;
  change_type: string;
  field_changes: any;
  user_email?: string;
}

interface CatalogHistoryTabProps {
  catalogItemId: string;
}

const CHANGE_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  create: {
    icon: <Plus className="h-4 w-4" />,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: 'Created',
  },
  update: {
    icon: <Edit2 className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: 'Updated',
  },
  status_change: {
    icon: <RefreshCw className="h-4 w-4" />,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    label: 'Status Changed',
  },
  approval: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    label: 'Approved',
  },
};

const CatalogHistoryTab: React.FC<CatalogHistoryTabProps> = ({ catalogItemId }) => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLogs();
  }, [catalogItemId]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog_item_audit_logs')
        .select('*')
        .eq('catalog_item_id', catalogItemId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      // Fetch user emails for the logs
      const userIds = [...new Set(data?.map(log => log.changed_by_user_id).filter(Boolean))];
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds);

        const emailMap = new Map(profiles?.map(p => [p.user_id, p.email]));

        setLogs(data?.map(log => ({
          ...log,
          user_email: log.changed_by_user_id ? emailMap.get(log.changed_by_user_id) : undefined,
        })) || []);
      } else {
        setLogs(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const renderFieldChanges = (changes: Record<string, any> | null) => {
    if (!changes) return null;

    const entries = Object.entries(changes);
    if (entries.length === 0) return null;

    return (
      <div className="mt-3 space-y-2 pl-4 border-l-2 border-muted">
        {entries.map(([key, value]) => {
          if (key === 'new') {
            // Creation - show all new values
            return (
              <div key={key} className="text-sm">
                <span className="text-muted-foreground">Initial values set</span>
              </div>
            );
          }

          if (typeof value === 'object' && value !== null && 'old' in value && 'new' in value) {
            return (
              <div key={key} className="text-sm">
                <span className="font-medium">{key}:</span>{' '}
                <span className="text-destructive line-through">{String(value.old ?? '-')}</span>
                {' → '}
                <span className="text-green-600">{String(value.new ?? '-')}</span>
              </div>
            );
          }

          return (
            <div key={key} className="text-sm">
              <span className="font-medium">{key}:</span>{' '}
              <span>{String(value)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <History className="h-12 w-12 mb-4 opacity-50" />
          <p>{t('catalog.noHistory')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          {t('catalog.history')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {logs.map((log) => {
              const config = CHANGE_TYPE_CONFIG[log.change_type] || CHANGE_TYPE_CONFIG.update;
              const isExpanded = expandedLogs.has(log.id);
              const hasChanges = log.field_changes && Object.keys(log.field_changes).length > 0;

              return (
                <div key={log.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${config.color}`}>
                    {config.icon}
                  </div>

                  <div className="bg-card border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge className={config.color}>
                          {config.label}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          {log.user_email || t('catalog.systemAction')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {format(new Date(log.changed_at), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.changed_at), 'h:mm a')}
                        </p>
                      </div>
                    </div>

                    {hasChanges && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 -ml-2"
                          onClick={() => toggleExpand(log.id)}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              {t('catalog.hideDetails')}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              {t('catalog.showDetails')}
                            </>
                          )}
                        </Button>

                        {isExpanded && renderFieldChanges(log.field_changes)}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CatalogHistoryTab;
