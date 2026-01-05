import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { dispatchReservationCreated } from '@/lib/webhookTrigger';

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preSelectedIncomingStock?: {
    id: string;
    quality: string;
    color: string;
    available_meters: number;
    invoice_number: string | null;
    supplier_name: string;
  };
}

interface ReservationLine {
  scope: 'INVENTORY' | 'INCOMING';
  lot_id?: string;
  incoming_stock_id?: string;
  quality: string;
  color: string;
  reserved_meters: number;
  roll_ids?: string;
  lot_number?: string;
  invoice_number?: string;
  warehouse_location?: string;
  supplier_name?: string;
}

interface InventoryItem {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  reserved_meters: number;
  roll_count: number;
  warehouse_location: string | null;
  rolls: Array<{
    id: string;
    meters: number;
    position: number;
    status: string;
  }>;
}

interface IncomingItem {
  id: string;
  quality: string;
  color: string;
  expected_meters: number;
  received_meters: number;
  reserved_meters: number;
  invoice_number: string | null;
  expected_arrival_date: string | null;
  suppliers: { name: string };
}

export default function ReservationDialog({ open, onOpenChange, onSuccess, preSelectedIncomingStock }: ReservationDialogProps) {
  const { logAction } = useAuditLog();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<'INVENTORY' | 'INCOMING'>('INVENTORY');
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [holdUntil, setHoldUntil] = useState<string>('');
  
  // Available items
  const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
  const [availableIncoming, setAvailableIncoming] = useState<IncomingItem[]>([]);
  const [selectedLines, setSelectedLines] = useState<ReservationLine[]>([]);

  useEffect(() => {
    if (open) {
      fetchAvailableInventory();
      fetchAvailableIncoming();
      
      // If pre-selected incoming stock, switch to INCOMING tab and add it
      if (preSelectedIncomingStock) {
        setScope('INCOMING');
        setSelectedLines([{
          scope: 'INCOMING',
          incoming_stock_id: preSelectedIncomingStock.id,
          quality: preSelectedIncomingStock.quality,
          color: preSelectedIncomingStock.color,
          reserved_meters: 0, // User will need to update this
          invoice_number: preSelectedIncomingStock.invoice_number || undefined,
          supplier_name: preSelectedIncomingStock.supplier_name
        }]);
      }
    } else {
      // Reset form when dialog closes
      setCustomerName('');
      setCustomerId('');
      setNotes('');
      setHoldUntil('');
      setSelectedLines([]);
      setScope('INVENTORY');
    }
  }, [open, preSelectedIncomingStock]);

  const fetchAvailableInventory = async () => {
    try {
      const { data: lots, error } = await supabase
        .from('lots')
        .select(`
          id,
          lot_number,
          quality,
          color,
          meters,
          reserved_meters,
          roll_count,
          warehouse_location,
          rolls (
            id,
            meters,
            position,
            status
          )
        `)
        .eq('status', 'in_stock')
        .gt('meters', 0)
        .order('quality')
        .order('color');

      if (error) throw error;

      // Filter to only show items with available meters
      const available = (lots || [])
        .filter(lot => (lot.meters - lot.reserved_meters) > 0)
        .map(lot => ({
          ...lot,
          rolls: (lot.rolls || []).filter((r: any) => r.status === 'available')
        }));
      
      setAvailableInventory(available as any);
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load available inventory');
    }
  };

  const fetchAvailableIncoming = async () => {
    try {
      const { data, error } = await supabase
        .from('incoming_stock')
        .select(`
          id,
          quality,
          color,
          expected_meters,
          received_meters,
          reserved_meters,
          invoice_number,
          expected_arrival_date,
          suppliers (name)
        `)
        .in('status', ['pending_inbound', 'partially_received'])
        .order('expected_arrival_date');

      if (error) throw error;

      // Calculate open meters and filter
      const available = (data || [])
        .map(item => ({
          ...item,
          open_meters: item.expected_meters - item.received_meters - item.reserved_meters
        }))
        .filter(item => item.open_meters > 0);

      setAvailableIncoming(available as any);
    } catch (error: any) {
      console.error('Error fetching incoming stock:', error);
      toast.error('Failed to load incoming stock');
    }
  };

  const handleAddInventoryLine = (lot: InventoryItem, meters: number, rollIds?: string[]) => {
    const availableMeters = lot.meters - lot.reserved_meters;
    if (meters > availableMeters) {
      toast.error(`Only ${availableMeters.toFixed(2)}m available for this lot`);
      return;
    }

    setSelectedLines([...selectedLines, {
      scope: 'INVENTORY',
      lot_id: lot.id,
      quality: lot.quality,
      color: lot.color,
      reserved_meters: meters,
      roll_ids: rollIds?.join(',') || '',
      lot_number: lot.lot_number,
      warehouse_location: lot.warehouse_location || undefined
    }]);
  };

  const handleAddIncomingLine = (item: IncomingItem, meters: number) => {
    const openMeters = item.expected_meters - item.received_meters - item.reserved_meters;
    if (meters > openMeters) {
      toast.error(`Only ${openMeters.toFixed(2)}m available for this incoming stock`);
      return;
    }

    setSelectedLines([...selectedLines, {
      scope: 'INCOMING',
      incoming_stock_id: item.id,
      quality: item.quality,
      color: item.color,
      reserved_meters: meters,
      invoice_number: item.invoice_number || undefined,
      supplier_name: item.suppliers?.name
    }]);
  };

  const handleRemoveLine = (index: number) => {
    setSelectedLines(selectedLines.filter((_, i) => i !== index));
  };

  const handleCreateReservation = async () => {
    if (!customerName || selectedLines.length === 0) {
      toast.error(String(t('pleaseAddAtLeastOneLine')));
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create reservation
      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .insert({
          customer_name: customerName,
          customer_id: customerId || null,
          notes: notes || null,
          hold_until: holdUntil || null,
          created_by: user.id,
          status: 'active'
        })
        .select()
        .single();

      if (resError) throw resError;

      // Create reservation lines
      const lines = selectedLines.map(line => ({
        reservation_id: reservation.id,
        scope: line.scope,
        lot_id: line.scope === 'INVENTORY' ? line.lot_id : null,
        incoming_stock_id: line.scope === 'INCOMING' ? line.incoming_stock_id : null,
        quality: line.quality,
        color: line.color,
        reserved_meters: line.reserved_meters,
        roll_ids: line.roll_ids || null
      }));

      const { error: linesError } = await supabase
        .from('reservation_lines')
        .insert(lines);

      if (linesError) throw linesError;

      // Log audit action
      await logAction(
        'CREATE',
        'lot',
        reservation.id,
        reservation.reservation_number,
        null,
        { ...reservation, lines: selectedLines },
        `Created reservation ${reservation.reservation_number} for ${customerName}`
      );

      // Dispatch webhook event for reservation creation
      dispatchReservationCreated({
        id: reservation.id,
        reservation_number: reservation.reservation_number,
        customer_name: customerName,
        total_reserved_meters: totalReservedMeters,
        lines_count: selectedLines.length,
        hold_until: holdUntil || null,
      });

      toast.success(String(t('reservationCreated')));
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Reservation creation error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const totalReservedMeters = selectedLines.reduce((sum, line) => sum + line.reserved_meters, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{String(t('newReservation'))}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[75vh]">
          <div className="space-y-6 pr-4">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{String(t('customerInformation'))}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">{String(t('customerName'))} *</Label>
                    <Input
                      id="customer-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={String(t('customerName'))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer-id">{String(t('optionalCustomerId'))}</Label>
                    <Input
                      id="customer-id"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      placeholder={String(t('customerId'))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hold-until">{String(t('optionalHoldUntil'))}</Label>
                  <Input
                    id="hold-until"
                    type="date"
                    value={holdUntil}
                    onChange={(e) => setHoldUntil(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{String(t('additionalNotes'))}</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={String(t('additionalNotes'))}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Inventory Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{String(t('selectItemsToReserve'))}</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="INVENTORY">
                      {String(t('physicalInventory'))} ({availableInventory.length})
                    </TabsTrigger>
                    <TabsTrigger value="INCOMING">
                      {String(t('incomingStock'))} ({availableIncoming.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="INVENTORY">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {availableInventory.map((lot) => {
                        const availableMeters = lot.meters - lot.reserved_meters;
                        return (
                          <div key={lot.id} className="border rounded p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-mono text-sm font-semibold">{lot.lot_number}</div>
                                <div className="text-sm text-muted-foreground">
                                  {lot.quality} - {lot.color}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {String(t('available'))}: {availableMeters.toFixed(2)}m ({lot.rolls.length} {String(t('rolls'))})
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const meters = prompt(`Enter meters to reserve (max ${availableMeters.toFixed(2)}m):`);
                                  if (meters) {
                                    const amount = parseFloat(meters);
                                    if (amount > 0 && amount <= availableMeters) {
                                      handleAddInventoryLine(lot, amount);
                                    }
                                  }
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="INCOMING">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {availableIncoming.map((item) => {
                        const openMeters = item.expected_meters - item.received_meters - item.reserved_meters;
                        return (
                          <div key={item.id} className="border rounded p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-sm font-semibold">
                                  {item.quality} - {item.color}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {String(t('invoiceNumber'))}: {item.invoice_number || 'N/A'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {String(t('supplier'))}: {item.suppliers?.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {String(t('available'))}: {openMeters.toFixed(2)}m
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const meters = prompt(`Enter meters to reserve (max ${openMeters.toFixed(2)}m):`);
                                  if (meters) {
                                    const amount = parseFloat(meters);
                                    if (amount > 0 && amount <= openMeters) {
                                      handleAddIncomingLine(item, amount);
                                    }
                                  }
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Selected Lines Summary */}
            {selectedLines.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {String(t('selectedItems'))} ({selectedLines.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{String(t('type'))}</TableHead>
                        <TableHead>{String(t('quality'))}</TableHead>
                        <TableHead>{String(t('color'))}</TableHead>
                        <TableHead>{String(t('meters'))}</TableHead>
                        <TableHead>{String(t('reference'))}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="outline">{line.scope}</Badge>
                          </TableCell>
                          <TableCell>{line.quality}</TableCell>
                          <TableCell>{line.color}</TableCell>
                          <TableCell>{line.reserved_meters.toFixed(2)}m</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {line.scope === 'INVENTORY' ? line.lot_number : line.invoice_number}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLine(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 flex justify-between items-center border-t pt-4">
                    <span className="font-semibold">{String(t('totalReservedLabel'))}:</span>
                    <span className="text-2xl font-bold text-primary">
                      {totalReservedMeters.toFixed(2)}m
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {String(t('cancelDialog'))}
          </Button>
          <Button
            onClick={handleCreateReservation}
            disabled={loading || !customerName || selectedLines.length === 0}
          >
            {loading ? String(t('creating')) : String(t('createReservationButton')).replace('{count}', selectedLines.length.toString())}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
