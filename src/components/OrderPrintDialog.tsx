import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Printer, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  created_at: string;
  fulfilled_at: string | null;
  created_by: string;
  fulfilled_by: string | null;
  order_lots: Array<{
    id: string;
    quality: string;
    color: string;
    roll_count: number;
    line_type: 'sample' | 'standard';
    selected_roll_meters?: string;
    selected_roll_ids?: string;
    lot: {
      lot_number: string;
      meters: number;
    };
  }>;
}

interface OrderPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

const OrderPrintDialog = ({ open, onOpenChange, order }: OrderPrintDialogProps) => {
  const { t } = useLanguage();

  // Generate masked order ID for security
  const generateMaskedOrderId = (originalId: string) => {
    const hash = originalId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const randomSuffix = Math.abs(hash % 10000).toString().padStart(4, '0');
    return `ORD-${randomSuffix}`;
  };

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const totalMeters = order.order_lots.reduce((sum, lot) => sum + lot.lot.meters * lot.roll_count, 0);
  const totalRolls = order.order_lots.reduce((sum, lot) => sum + lot.roll_count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none print:border-none print:max-h-none">
        <div className="print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {t('orderSummary')}
              <div className="flex gap-2">
                <Button onClick={handlePrint} size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  {t('print')}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="print:p-0 space-y-6 print:space-y-2">
          {/* Header */}
          <div className="text-center border-b pb-4 print:border-black print:pb-2">
            <h1 className="text-2xl font-bold print:text-black print:text-lg">{t('warehouseOrderSummary')}</h1>
            <p className="text-muted-foreground print:text-black print:text-sm">{t('orderPreparationSheet')}</p>
          </div>

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-6 print:text-black print:gap-3">
            <Card className="print:shadow-none print:border-black">
              <CardHeader className="pb-4 print:pb-2">
                <CardTitle className="text-2xl print:text-base">{t('orderInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 print:space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-xl print:text-sm">{t('orderNumber')}:</span>
                  <span className="text-xl print:text-sm">{order ? generateMaskedOrderId(order.order_number) : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-xl print:text-sm">{t('customer')}:</span>
                  <span className="text-xl print:text-sm">{order.customer_name}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="print:shadow-none print:border-black">
              <CardHeader className="pb-3 print:pb-2">
                <CardTitle className="text-xl print:text-base">Sipariş Durumu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 print:space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-lg print:text-sm">{t('orderDate')}:</span>
                  <span className="text-lg print:text-sm">{formatDate(order.created_at)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg print:text-sm">{t('status')}:</span>
                  <Badge variant={order.fulfilled_at ? "default" : "secondary"} className="print:border print:border-black print:bg-white print:text-black text-base px-3 py-1 print:text-xs print:px-2 print:py-0">
                    {order.fulfilled_at ? t('fulfilled') : t('pending')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lots Table - Large section for warehouse personnel */}
          <Card className="print:shadow-none print:border-black print:min-h-0">
            <CardContent className="print:p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse print:border-black text-lg print:text-xs">
                  <thead>
                     <tr className="border-b print:border-black bg-gray-100 print:bg-gray-100">
                       <th className="text-left p-2 print:border print:border-black font-bold text-xl print:text-xs print:p-1">#</th>
                       <th className="text-left p-2 print:border print:border-black font-bold text-xl print:text-xs print:p-1">Kalite</th>
                       <th className="text-left p-2 print:border print:border-black font-bold text-xl print:text-xs print:p-1">Renk</th>
                       <th className="text-left p-2 print:border print:border-black font-bold text-xl print:text-xs print:p-1">Lot Numarası</th>
                       <th className="text-left p-2 print:border print:border-black font-bold text-xl print:text-xs print:p-1">{t('rollCount')}</th>
                       <th className="text-left p-2 print:border print:border-black font-bold text-xl print:text-xs print:p-1">{t('lineType')}</th>
                       <th className="text-left p-2 print:border print:border-black font-bold text-xl print:text-xs print:p-1">{t('rollMeters')}</th>
                       <th className="text-left p-2 print:border print:border-black font-bold text-xl print:text-xs print:p-1">{t('prepared')}</th>
                     </tr>
                  </thead>
                  <tbody>
                    {order.order_lots.map((lot, index) => (
                      <tr key={lot.id} className="border-b print:border-black">
                         <td className="p-2 print:border print:border-black text-lg font-semibold print:text-xs print:p-1">{index + 1}</td>
                         <td className="p-2 print:border print:border-black text-lg font-semibold print:text-xs print:p-1">{lot.quality}</td>
                        <td className="p-2 print:border print:border-black text-lg whitespace-nowrap print:text-xs print:p-1">
                          <span className="font-semibold">{lot.color}</span>
                        </td>
                         <td className="p-2 print:border print:border-black font-semibold text-lg print:text-xs print:p-1">{lot.lot.lot_number}</td>
                         <td className="p-2 print:border print:border-black text-lg font-semibold print:text-xs print:p-1">{lot.roll_count}</td>
                         <td className="p-2 print:border print:border-black print:p-1">
                           <Badge 
                             variant={lot.line_type === 'sample' ? "outline" : "default"}
                             className="print:border print:border-black print:bg-white print:text-black text-base px-3 py-1 print:text-xs print:px-1 print:py-0"
                           >
                             {lot.line_type === 'sample' ? t('sample') : t('standard')}
                           </Badge>
                         </td>
                         <td className="p-2 print:border print:border-black text-lg font-semibold print:text-xs print:p-1">
                           {lot.line_type === 'sample' 
                             ? (lot.selected_roll_meters || '0') + 'm'
                             : (lot.lot.meters * lot.roll_count).toLocaleString() + 'm'
                           }
                         </td>
                         <td className="p-2 print:border print:border-black text-center text-2xl print:text-lg print:p-1">☐</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="border-t pt-4 space-y-4 print:border-black print:pt-2 print:space-y-2">
            <div className="grid grid-cols-2 gap-6 print:gap-3">
              <div>
                <h3 className="font-medium mb-2 print:text-black print:text-sm print:mb-1">{t('notes')}:</h3>
                <div className="border rounded p-3 h-20 print:border-black print:h-12 print:p-2"></div>
              </div>
              <div>
                <h3 className="font-medium mb-2 print:text-black print:text-sm print:mb-1">{t('signatures')}:</h3>
                <div className="space-y-3 print:space-y-1">
                  <div>
                    <span className="print:text-black print:text-sm">{t('preparedBy')}: ______________________</span>
                  </div>
                  <div>
                    <span className="print:text-black print:text-sm">{t('checkedBy')}: ______________________</span>
                  </div>
                  <div>
                    <span className="print:text-black print:text-sm">{t('date')}: ______________________</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderPrintDialog;