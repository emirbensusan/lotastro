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
}

const AuditLogs: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Action</Label>
                  <div>{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <Label>Entity Type</Label>
                  <div>{selectedLog.entity_type}</div>
                </div>
                <div>
                  <Label>User</Label>
                  <div>{selectedLog.user_email}</div>
                </div>
                <div>
                  <Label>Timestamp</Label>
                  <div>{format(new Date(selectedLog.created_at), 'PPpp')}</div>
                </div>
              </div>

              {selectedLog.old_data && (
                <div>
                  <Label>Previous Data</Label>
                  <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div>
                  <Label>New Data</Label>
                  <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.notes && (
                <div>
                  <Label>Notes</Label>
                  <div className="bg-muted p-3 rounded">{selectedLog.notes}</div>
                </div>
              )}
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
              <Input
                placeholder="Enter reason..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
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
              disabled={reversing}
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
