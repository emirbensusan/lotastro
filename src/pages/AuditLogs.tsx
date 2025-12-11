import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { History, Undo, Search, Filter, FileText, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';
import { TableExportButton, exportToCSV } from '@/components/ui/table-export-button';
import { ViewDetailsButton } from '@/components/ui/view-details-button';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_identifier: string;
  user_email: string;
  user_role: string;
  old_data: any;
  new_data: any;
  changed_fields: any;
  is_reversed: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  notes: string | null;
  created_at: string;
  reversal_audit_id?: string | null;
}

// Formatter functions for user-friendly display
const formatOrderDetails = (data: any, t: (key: string) => string | string[]): string[] => {
  if (!data) return [];
  
  const details: string[] = [];
  
  if (data.order_number) details.push(`${String(t('auditOrderNumber'))} ${data.order_number}`);
  if (data.customer_name) details.push(`${String(t('auditCustomer'))} ${data.customer_name}`);
  
  if (data.order_lots && Array.isArray(data.order_lots)) {
    const totalRolls = data.order_lots.reduce((sum: number, lot: any) => sum + (lot.rollCount || lot.roll_count || 0), 0);
    const lotDescriptions = data.order_lots.map((lot: any) => {
      const lotNumber = lot.lot?.lot_number || lot.lotNumber || '';
      const quality = lot.quality || '';
      const color = lot.color || '';
      const rolls = lot.rollCount || lot.roll_count || 0;
      
      return lotNumber 
        ? `${t('auditLot')} ${lotNumber}: ${quality} ${color} - ${rolls} ${t('auditRollsCount')}`
        : `${quality} ${color} - ${rolls} ${t('auditRollsCount')}`;
    });
    
    details.push(`${t('auditTotalRolls')} ${totalRolls}`);
    if (lotDescriptions.length > 0) {
      details.push(`${t('auditLots')}`);
      lotDescriptions.forEach(desc => details.push(`  • ${desc}`));
    }
  }
  
  if (data.fulfilled_at) {
    details.push(`${t('auditFulfilled')} ${format(new Date(data.fulfilled_at), 'PPpp')}`);
  }
  
  return details;
};

const formatLotDetails = (data: any, t: (key: string) => string | string[]): string[] => {
  if (!data) return [];
  
  const details: string[] = [];
  
  if (data.lot_number) details.push(`${t('auditLotNumber')} ${data.lot_number}`);
  if (data.quality) details.push(`${t('auditQuality')} ${data.quality}`);
  if (data.color) details.push(`${t('auditColor')} ${data.color}`);
  if (data.meters) details.push(`${t('auditMeters')} ${data.meters}m`);
  if (data.roll_count) details.push(`${t('auditRollCount')} ${data.roll_count}`);
  if (data.warehouse_location) details.push(`${t('auditLocation')} ${data.warehouse_location}`);
  if (data.suppliers?.name || data.supplier_name) {
    details.push(`${t('auditSupplier')} ${data.suppliers?.name || data.supplier_name}`);
  }
  if (data.entry_date) details.push(`${t('auditEntryDate')} ${format(new Date(data.entry_date), 'PP')}`);
  if (data.invoice_number) details.push(`${t('auditInvoice')} ${data.invoice_number}`);
  
  return details;
};

const formatRollDetails = (data: any, t: (key: string) => string | string[]): string[] => {
  if (!data) return [];
  
  const details: string[] = [];
  
  if (data.position) details.push(`${t('auditRollPosition')} #${data.position}`);
  if (data.meters) details.push(`${t('auditMeters')} ${data.meters}m`);
  if (data.status) details.push(`${t('auditStatus')} ${data.status}`);
  
  return details;
};

const formatSupplierDetails = (data: any, t: (key: string) => string | string[]): string[] => {
  if (!data) return [];
  
  const details: string[] = [];
  
  if (data.name) details.push(`${t('auditSupplierName')} ${data.name}`);
  
  return details;
};

const formatProfileDetails = (data: any, t: (key: string) => string | string[]): string[] => {
  if (!data) return [];
  
  const details: string[] = [];
  
  if (data.email) details.push(`${t('auditEmail')} ${data.email}`);
  if (data.full_name) details.push(`${t('auditName')} ${data.full_name}`);
  if (data.role) details.push(`${t('auditRole')} ${data.role}`);
  if (data.active !== undefined) details.push(`${t('auditStatus')} ${data.active ? t('auditActive') : t('auditInactive')}`);
  
  return details;
};

const formatForecastSettingsDetails = (data: any, t: (key: string) => string | string[]): string[] => {
  if (!data) return [];
  
  const details: string[] = [];
  
  if (data.scope) details.push(`${t('scope') || 'Scope'}: ${data.scope}`);
  if (data.quality_code) details.push(`${t('quality') || 'Quality'}: ${data.quality_code}`);
  if (data.color_code) details.push(`${t('color') || 'Color'}: ${data.color_code}`);
  if (data.parameter_name) details.push(`${t('parameter') || 'Parameter'}: ${data.parameter_name}`);
  
  return details;
};

const formatEntityDetails = (entityType: string, data: any, t: (key: string) => string | string[]): string[] => {
  switch (entityType) {
    case 'order':
      return formatOrderDetails(data, t);
    case 'lot':
    case 'lot_queue':
      return formatLotDetails(data, t);
    case 'roll':
      return formatRollDetails(data, t);
    case 'supplier':
      return formatSupplierDetails(data, t);
    case 'profile':
      return formatProfileDetails(data, t);
    case 'forecast_settings':
      return formatForecastSettingsDetails(data, t);
    default:
      return [String(t('detailsNotAvailable'))];
  }
};

const formatValue = (val: any, t: (key: string) => string | string[]): string => {
  if (val === null || val === undefined) return String(t('empty'));
  if (typeof val === 'boolean') return val ? String(t('yes')) : String(t('no'));
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

// Explicit action-to-key mapping (no more dynamic key generation)
const ACTION_KEYS: Record<string, string> = {
  'CREATE': 'actionCreate',
  'UPDATE': 'actionUpdate',
  'DELETE': 'actionDelete',
  'STATUS_CHANGE': 'actionStatusChange',
  'FULFILL': 'actionFulfill',
  'APPROVE': 'actionApprove',
  'REJECT': 'actionReject',
};

const ENTITY_KEYS: Record<string, string> = {
  'order': 'ordersEntity',
  'lot': 'lotsEntity',
  'lot_queue': 'lotQueue',
  'roll': 'rollsEntity',
  'supplier': 'suppliersEntity',
  'profile': 'profilesEntity',
  'order_lot': 'ordersEntity',
  'order_queue': 'orderQueue',
  'field_edit_queue': 'fieldEditQueue',
  'role_permission': 'rolePermission',
  'forecast_settings': 'forecastSettingsEntity',
};

// Helper component to show reversal reason
const ReversalReason: React.FC<{ reversalAuditId: string; t: (key: string) => string | string[] }> = ({ reversalAuditId, t }) => {
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReversalReason = async () => {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('notes')
          .eq('id', reversalAuditId)
          .single();

        if (error) throw error;
        
        if (data?.notes) {
          const match = data.notes.match(/Reason: (.+)$/);
          setReason(match ? match[1] : data.notes);
        }
      } catch (error) {
        console.error(String(t('errorFetchingReversalReason')), error);
      } finally {
        setLoading(false);
      }
    };

    fetchReversalReason();
  }, [reversalAuditId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">{String(t('loadingReason'))}</div>;
  }

  if (!reason) {
    return null;
  }

  return (
    <div>
      <span className="text-muted-foreground">{String(t('reason'))}</span>{' '}
      <span className="font-medium">{reason}</span>
    </div>
  );
};

// Helper component to show changes
const ChangesSummary: React.FC<{ 
  oldData: any; 
  newData: any;
  entityType: string;
  t: (key: string) => string | string[];
}> = ({ oldData, newData, t }) => {
  const changes: Array<{ field: string; from: any; to: any }> = [];

  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  
  allKeys.forEach(key => {
    if (['id', 'created_at', 'updated_at'].includes(key)) return;
    
    const oldVal = oldData?.[key];
    const newVal = newData?.[key];
    
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        from: oldVal,
        to: newVal
      });
    }
  });

  if (changes.length === 0) {
    return <div className="text-sm text-muted-foreground">{String(t('noFieldsChanged'))}</div>;
  }

  return (
    <div className="space-y-2">
      {changes.map((change, idx) => (
        <div key={idx} className="bg-muted p-3 rounded-lg text-sm">
          <div className="font-medium mb-1">{change.field}</div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-1 rounded">
              {formatValue(change.from, t)}
            </span>
            <span>→</span>
            <span className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-1 rounded">
              {formatValue(change.to, t)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const AuditLogs: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showReversalDialog, setShowReversalDialog] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  
  // Sorting state
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>({
    key: 'created_at',
    direction: 'desc'
  });

  useEffect(() => {
    fetchAuditLogs();
  }, [filterAction, filterEntity, page, pageSize, currentSort]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      // Get total count
      let countQuery = supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });
      
      if (filterAction !== 'all') {
        countQuery = countQuery.eq('action', filterAction as any);
      }
      if (filterEntity !== 'all') {
        countQuery = countQuery.eq('entity_type', filterEntity as any);
      }
      
      const { count } = await countQuery;
      setTotalCount(count || 0);
      
      // Get paginated data
      let query = supabase
        .from('audit_logs')
        .select('*');

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction as any);
      }

      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity as any);
      }

      // Apply sorting
      if (currentSort) {
        query = query.order(currentSort.key, { ascending: currentSort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      
      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data || []) as AuditLog[]);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: String(t('error')),
        description: String(t('failedToLoadAuditLogs')),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleSort = (key: string, direction: SortDirection) => {
    setCurrentSort(direction ? { key, direction } : null);
    setPage(1);
  };
  
  const handleExport = () => {
    const exportData = logs.map(log => ({
      timestamp: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      action: log.action,
      entity_type: log.entity_type,
      entity_identifier: log.entity_identifier || '',
      user_email: log.user_email,
      user_role: log.user_role,
      status: log.is_reversed ? 'Reversed' : 'Active',
      notes: log.notes || ''
    }));
    
    exportToCSV(exportData, [
      { key: 'timestamp', label: String(t('timestamp')) },
      { key: 'action', label: String(t('action')) },
      { key: 'entity_type', label: String(t('entity')) },
      { key: 'entity_identifier', label: String(t('identifier')) },
      { key: 'user_email', label: String(t('user')) },
      { key: 'user_role', label: String(t('role')) },
      { key: 'status', label: String(t('status')) },
      { key: 'notes', label: String(t('notes')) }
    ], `audit-logs-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleReverseAction = async () => {
    if (!selectedLog || !canReverse) return;

    setReversing(true);
    try {
      const { data, error } = await supabase.functions.invoke('reverse-audit-action', {
        body: {
          audit_id: selectedLog.id,
          reason: reversalReason
        }
      });

      if (error) {
        console.error('Reversal failed:', error);
        
        // Try to parse structured error
        let errorMessage = error.message || "Failed to reverse the action";
        let errorDetails = "";
        
        try {
          if (typeof error.message === 'string') {
            const parsed = JSON.parse(error.message);
            if (parsed.reason) {
              errorMessage = parsed.reason;
              errorDetails = parsed.details ? `\n\nDetails: ${parsed.details}` : "";
              if (parsed.step) {
                errorDetails += `\n\nFailed at: ${parsed.step}`;
              }
              if (parsed.correlation_id) {
                errorDetails += `\n\nCorrelation ID: ${parsed.correlation_id}`;
              }
            }
          }
        } catch {
          // Use default error message
        }
        
        toast({
          title: "Reversal Failed",
          description: errorMessage + errorDetails,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: 'Success',
        description: data?.message || 'Action reversed successfully'
      });

      setShowReversalDialog(false);
      setReversalReason('');
      setSelectedLog(null);
      fetchAuditLogs();
    } catch (error: any) {
      console.error('Reversal error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setReversing(false);
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, string> = {
      'CREATE': 'default',
      'UPDATE': 'secondary',
      'DELETE': 'destructive',
      'FULFILL': 'default',
      'APPROVE': 'default',
      'REJECT': 'destructive'
    };
    const actionKey = ACTION_KEYS[action] || 'actionCreate';
    return <Badge variant={variants[action] as any || 'outline'}>{String(t(actionKey))}</Badge>;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    return (
      log.entity_identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const canReverse = profile?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" />
          {String(t('auditLogs'))}
        </h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={String(t('searchByIdentifierOrUser'))}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder={String(t('filterByAction'))} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{String(t('allActions'))}</SelectItem>
                <SelectItem value="CREATE">{String(t('actionCreate'))}</SelectItem>
                <SelectItem value="UPDATE">{String(t('actionUpdate'))}</SelectItem>
                <SelectItem value="DELETE">{String(t('actionDelete'))}</SelectItem>
                <SelectItem value="FULFILL">{String(t('actionFulfill'))}</SelectItem>
                <SelectItem value="APPROVE">{String(t('actionApprove'))}</SelectItem>
                <SelectItem value="REJECT">{String(t('actionReject'))}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger>
                <SelectValue placeholder={String(t('filterByEntity'))} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{String(t('allEntities'))}</SelectItem>
                <SelectItem value="lot">{String(t('lotsEntity'))}</SelectItem>
                <SelectItem value="order">{String(t('ordersEntity'))}</SelectItem>
                <SelectItem value="roll">{String(t('rollsEntity'))}</SelectItem>
                <SelectItem value="supplier">{String(t('suppliersEntity'))}</SelectItem>
                <SelectItem value="forecast_settings">{String(t('forecastSettingsEntity'))}</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={fetchAuditLogs} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              {String(t('refresh'))}
            </Button>
            
            <TableExportButton onExport={handleExport} disabled={logs.length === 0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{String(t('actionHistory'))}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <DataTablePagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              />
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      label={String(t('timestamp'))}
                      sortKey="created_at"
                      currentSort={currentSort}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label={String(t('action'))}
                      sortKey="action"
                      currentSort={currentSort}
                      onSort={handleSort}
                      filterable
                      filterType="select"
                      filterOptions={[
                        { value: 'CREATE', label: String(t('actionCreate')) },
                        { value: 'UPDATE', label: String(t('actionUpdate')) },
                        { value: 'DELETE', label: String(t('actionDelete')) },
                        { value: 'FULFILL', label: String(t('actionFulfill')) },
                        { value: 'APPROVE', label: String(t('actionApprove')) },
                        { value: 'REJECT', label: String(t('actionReject')) }
                      ]}
                      filterValue={filterAction !== 'all' ? filterAction : ''}
                      onFilterChange={(value) => { setFilterAction(value || 'all'); setPage(1); }}
                    />
                    <SortableTableHead
                      label={String(t('entity'))}
                      sortKey="entity_type"
                      currentSort={currentSort}
                      onSort={handleSort}
                      filterable
                      filterType="select"
                      filterOptions={[
                        { value: 'lot', label: String(t('lotsEntity')) },
                        { value: 'order', label: String(t('ordersEntity')) },
                        { value: 'roll', label: String(t('rollsEntity')) },
                        { value: 'supplier', label: String(t('suppliersEntity')) },
                        { value: 'forecast_settings', label: String(t('forecastSettingsEntity')) }
                      ]}
                      filterValue={filterEntity !== 'all' ? filterEntity : ''}
                      onFilterChange={(value) => { setFilterEntity(value || 'all'); setPage(1); }}
                    />
                    <SortableTableHead
                      label={String(t('identifier'))}
                      sortKey="entity_identifier"
                      currentSort={currentSort}
                      onSort={handleSort}
                      filterable
                      filterType="text"
                      filterValue={searchTerm}
                      onFilterChange={(value) => setSearchTerm(value || '')}
                    />
                    <SortableTableHead
                      label={String(t('user'))}
                      sortKey="user_email"
                      currentSort={currentSort}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label={String(t('status'))}
                      sortKey="is_reversed"
                      currentSort={currentSort}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label={String(t('auditActions'))}
                      sortKey=""
                      currentSort={currentSort}
                      onSort={() => {}}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className={log.is_reversed ? 'opacity-50' : ''}>
                      <TableCell>{format(new Date(log.created_at), 'PPpp')}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.entity_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.entity_identifier}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{log.user_email}</div>
                          <div className="text-muted-foreground text-xs">{log.user_role}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.is_reversed ? (
                          <Badge variant="secondary">{String(t('reversed'))}</Badge>
                        ) : (
                          <Badge variant="default">{String(t('active'))}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <ViewDetailsButton
                            onClick={() => {
                              setSelectedLog(log);
                              setShowDetailsDialog(true);
                            }}
                            showLabel={false}
                          />
                          {canReverse && !log.is_reversed && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedLog(log);
                                setShowReversalDialog(true);
                              }}
                            >
                              <Undo className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <DataTablePagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{String(t('actionDetails'))}</DialogTitle>
            <DialogDescription>
              {selectedLog?.action} {selectedLog?.entity_type} - {selectedLog?.entity_identifier}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <Label className="text-muted-foreground">{String(t('action'))}</Label>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{String(t('entityType'))}</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedLog.entity_type}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{String(t('performedBy'))}</Label>
                  <div className="mt-1 text-sm">
                    <div className="font-medium">{selectedLog.user_email}</div>
                    <div className="text-muted-foreground">{selectedLog.user_role}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{String(t('timestamp'))}</Label>
                  <div className="mt-1 text-sm">{format(new Date(selectedLog.created_at), 'PPpp')}</div>
                </div>
              </div>

              {/* Reversal Information */}
              {selectedLog.is_reversed && (
                <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Undo className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                        {String(t('thisActionWasReversed'))}
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        {selectedLog.reversed_at && (
                          <div>
                            <span className="text-muted-foreground">{String(t('reversedAt'))}</span>{' '}
                            <span className="font-medium">{format(new Date(selectedLog.reversed_at), 'PPpp')}</span>
                          </div>
                        )}
                        {selectedLog.reversal_audit_id && (
                          <ReversalReason reversalAuditId={selectedLog.reversal_audit_id} t={t} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Description */}
              {selectedLog.notes && (
                <div>
                  <Label className="text-muted-foreground">{String(t('description'))}</Label>
                  <div className="mt-2 bg-muted p-3 rounded-lg text-sm">
                    {selectedLog.notes}
                  </div>
                </div>
              )}

              {/* Previous State */}
              {selectedLog.old_data && ['UPDATE', 'DELETE'].includes(selectedLog.action) && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <span className="text-red-600 dark:text-red-400">●</span>
                    {String(t('previousState'))}
                  </Label>
                  <div className="mt-2 bg-muted p-4 rounded-lg space-y-1 text-sm">
                    {formatEntityDetails(selectedLog.entity_type, selectedLog.old_data, t).map((line, idx) => (
                      <div key={idx} className={line.startsWith('  •') ? 'ml-4 text-muted-foreground' : ''}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New State */}
              {selectedLog.new_data && ['CREATE', 'UPDATE'].includes(selectedLog.action) && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <span className="text-green-600 dark:text-green-400">●</span>
                    {selectedLog.action === 'CREATE' ? String(t('createdWith')) : String(t('newState'))}
                  </Label>
                  <div className="mt-2 bg-muted p-4 rounded-lg space-y-1 text-sm">
                    {formatEntityDetails(selectedLog.entity_type, selectedLog.new_data, t).map((line, idx) => (
                      <div key={idx} className={line.startsWith('  •') ? 'ml-4 text-muted-foreground' : ''}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Changes Summary for UPDATE */}
              {selectedLog.action === 'UPDATE' && selectedLog.old_data && selectedLog.new_data && (
                <div>
                  <Label className="text-muted-foreground">{String(t('changesMade'))}</Label>
                  <div className="mt-2 space-y-2">
                    <ChangesSummary 
                      oldData={selectedLog.old_data} 
                      newData={selectedLog.new_data}
                      entityType={selectedLog.entity_type}
                      t={t}
                    />
                  </div>
                </div>
              )}

              {/* Technical Details - Collapsible */}
              <details className="border rounded-lg p-4">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  {String(t('viewTechnicalDetails'))}
                </summary>
                <div className="mt-4 space-y-4">
                  {selectedLog.old_data && (
                    <div>
                      <Label className="text-xs">{String(t('oldDataJson'))}</Label>
                      <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40 mt-1">
                        {JSON.stringify(selectedLog.old_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.new_data && (
                    <div>
                      <Label className="text-xs">{String(t('newDataJson'))}</Label>
                      <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40 mt-1">
                        {JSON.stringify(selectedLog.new_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showReversalDialog} onOpenChange={setShowReversalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{String(t('reverseAction'))}</DialogTitle>
            <DialogDescription>
              {String(t('reverseActionConfirm'))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{String(t('reasonForReversal'))}</Label>
              <Textarea
                placeholder={String(t('enterReasonForReversal'))}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReversalDialog(false)}>
              {String(t('cancel'))}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReverseAction}
              disabled={reversing || !reversalReason.trim()}
            >
              {reversing ? String(t('reversing')) : String(t('reverseActionButton'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogs;
