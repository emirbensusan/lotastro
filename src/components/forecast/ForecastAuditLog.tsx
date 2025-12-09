import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditEntry {
  id: string;
  changed_at: string;
  changed_by: string;
  scope: string;
  quality_code: string | null;
  color_code: string | null;
  parameter_name: string;
  old_value: any;
  new_value: any;
  change_reason: string | null;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

const ForecastAuditLog: React.FC = () => {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchAuditLog();
  }, [page, scopeFilter]);

  const fetchAuditLog = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('forecast_settings_audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (scopeFilter !== 'all') {
        query = query.eq('scope', scopeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setEntries(data || []);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'global':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Global</Badge>;
      case 'per_quality':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Per-Quality</Badge>;
      default:
        return <Badge variant="outline">{scope}</Badge>;
    }
  };

  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.parameter_name.toLowerCase().includes(query) ||
      entry.quality_code?.toLowerCase().includes(query) ||
      entry.color_code?.toLowerCase().includes(query)
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{t('forecast.auditLog') || 'Settings Audit Log'}</CardTitle>
            <CardDescription>
              {t('forecast.auditLogDesc') || 'Track all changes made to forecast settings'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchAuditLog()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refresh') || 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchChanges') || 'Search changes...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('allScopes') || 'All scopes'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allScopes') || 'All Scopes'}</SelectItem>
              <SelectItem value="global">{t('global') || 'Global'}</SelectItem>
              <SelectItem value="per_quality">{t('perQuality') || 'Per-Quality'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('noAuditEntries') || 'No audit entries found'}
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">{t('timestamp') || 'Timestamp'}</TableHead>
                  <TableHead>{t('scope') || 'Scope'}</TableHead>
                  <TableHead>{t('parameter') || 'Parameter'}</TableHead>
                  <TableHead>{t('qualityColor') || 'Quality/Color'}</TableHead>
                  <TableHead>{t('oldValue') || 'Old Value'}</TableHead>
                  <TableHead>{t('newValue') || 'New Value'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      {new Date(entry.changed_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{getScopeBadge(entry.scope)}</TableCell>
                    <TableCell className="font-mono text-sm">{entry.parameter_name}</TableCell>
                    <TableCell>
                      {entry.quality_code && entry.color_code ? (
                        <span className="font-medium">{entry.quality_code} / {entry.color_code}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <pre className="text-xs bg-muted p-1 rounded overflow-x-auto">
                        {formatValue(entry.old_value)}
                      </pre>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <pre className="text-xs bg-muted p-1 rounded overflow-x-auto">
                        {formatValue(entry.new_value)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Pagination */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {t('showingPage') || 'Page'} {page + 1}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ForecastAuditLog;