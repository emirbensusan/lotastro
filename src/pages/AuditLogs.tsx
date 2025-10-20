import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { History, Undo, Search, Filter, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';

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

// Helper component to show reversal reason
const ReversalReason: React.FC<{ reversalAuditId: string }> = ({ reversalAuditId }) => {
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
        console.error('Error fetching reversal reason:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReversalReason();
  }, [reversalAuditId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading reason...</div>;
  }

  if (!reason) {
    return null;
  }

  return (
    <div>
      <span className="text-muted-foreground">Reason:</span>{' '}
      <span className="font-medium">{reason}</span>
    </div>
  );
};

// Helper component to show changes
const ChangesSummary: React.FC<{ 
  oldData: any; 
  newData: any;
  entityType: string;
}> = ({ oldData, newData }) => {
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
    return <div className="text-sm text-muted-foreground">No fields changed</div>;
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

  useEffect(() => {
    fetchAuditLogs();
  }, [filterAction, filterEntity]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction as any);
      }

      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data || []) as AuditLog[]);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load audit logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReverseAction = async () => {
    if (!selectedLog) return;

    setReversing(true);
    try {
      const { data, error } = await supabase.functions.invoke('reverse-audit-action', {
        body: {
          audit_id: selectedLog.id,
          reason: reversalReason
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Action reversed successfully'
      });

      setShowReversalDialog(false);
      setReversalReason('');
      setSelectedLog(null);
      fetchAuditLogs();
    } catch (error: any) {
      toast({
        title: 'Reversal Failed',
        description: error.message,
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
    return <Badge variant={variants[action] as any || 'outline'}>{action}</Badge>;
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
          Audit Logs
        </h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by identifier or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="FULFILL">Fulfill</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="lot">Lots</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="roll">Rolls</SelectItem>
                <SelectItem value="supplier">Suppliers</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={fetchAuditLogs} variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Action History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Identifier</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
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
                        <Badge variant="secondary">Reversed</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedLog(log);
                            setShowDetailsDialog(true);
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
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
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Action Details</DialogTitle>
            <DialogDescription>
              {selectedLog?.action} {selectedLog?.entity_type} - {selectedLog?.entity_identifier}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <Label className="text-muted-foreground">Action</Label>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity Type</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedLog.entity_type}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Performed By</Label>
                  <div className="mt-1 text-sm">
                    <div className="font-medium">{selectedLog.user_email}</div>
                    <div className="text-muted-foreground">{selectedLog.user_role}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Timestamp</Label>
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
                        This action was reversed
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        {selectedLog.reversed_at && (
                          <div>
                            <span className="text-muted-foreground">Reversed at:</span>{' '}
                            <span className="font-medium">{format(new Date(selectedLog.reversed_at), 'PPpp')}</span>
                          </div>
                        )}
                        {selectedLog.reversal_audit_id && (
                          <ReversalReason reversalAuditId={selectedLog.reversal_audit_id} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Description */}
              {selectedLog.notes && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
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
                    Previous State
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
                    {selectedLog.action === 'CREATE' ? 'Created With' : 'New State'}
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
                  <Label className="text-muted-foreground">Changes Made</Label>
                  <div className="mt-2 space-y-2">
                    <ChangesSummary 
                      oldData={selectedLog.old_data} 
                      newData={selectedLog.new_data}
                      entityType={selectedLog.entity_type}
                    />
                  </div>
                </div>
              )}

              {/* Technical Details - Collapsible */}
              <details className="border rounded-lg p-4">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  View Technical Details (JSON)
                </summary>
                <div className="mt-4 space-y-4">
                  {selectedLog.old_data && (
                    <div>
                      <Label className="text-xs">Old Data (JSON)</Label>
                      <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40 mt-1">
                        {JSON.stringify(selectedLog.old_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.new_data && (
                    <div>
                      <Label className="text-xs">New Data (JSON)</Label>
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
            <DialogTitle>Reverse Action</DialogTitle>
            <DialogDescription>
              Are you sure you want to reverse this action? This will undo the changes made.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for Reversal</Label>
              <Textarea
                placeholder="Enter reason for reversal..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReversalDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReverseAction}
              disabled={reversing || !reversalReason.trim()}
            >
              {reversing ? 'Reversing...' : 'Reverse Action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogs;
