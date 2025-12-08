import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Clock, ArrowRight, User } from 'lucide-react';

interface ManufacturingOrder {
  id: string;
  mo_number: string;
  quality: string;
  color: string;
  ordered_meters: number;
}

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
  notes: string | null;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ManufacturingOrder | null;
}

const MOStatusHistoryDialog: React.FC<Props> = ({ open, onOpenChange, order }) => {
  const { t } = useLanguage();
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && order) {
      fetchHistory();
    }
  }, [open, order]);

  const fetchHistory = async () => {
    if (!order) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mo_status_history')
        .select('*')
        .eq('manufacturing_order_id', order.id)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching status history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ORDERED': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CONFIRMED': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'IN_PRODUCTION': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'READY_TO_SHIP': return 'bg-green-50 text-green-700 border-green-200';
      case 'SHIPPED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELLED': return 'bg-red-50 text-red-700 border-red-200';
      default: return '';
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('mo.statusHistory')}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {order.mo_number} - {order.quality} {order.color} ({order.ordered_meters}m)
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('mo.noStatusChanges')}
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted"></div>

              {history.map((entry, index) => (
                <div key={entry.id} className="relative pl-10 pb-6">
                  {/* Timeline dot */}
                  <div className="absolute left-2.5 w-3 h-3 bg-primary rounded-full border-2 border-background"></div>

                  <div className="bg-card border rounded-lg p-4 space-y-3">
                    {/* Status change */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.old_status && (
                        <>
                          <Badge variant="outline" className={getStatusBadgeClass(entry.old_status)}>
                            {t(`mo.status.${entry.old_status.toLowerCase()}`)}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </>
                      )}
                      <Badge variant="outline" className={getStatusBadgeClass(entry.new_status)}>
                        {t(`mo.status.${entry.new_status.toLowerCase()}`)}
                      </Badge>
                    </div>

                    {/* Notes */}
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                        {entry.notes}
                      </p>
                    )}

                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(entry.changed_at).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {entry.profiles?.full_name || entry.profiles?.email || t('mo.systemUser')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MOStatusHistoryDialog;