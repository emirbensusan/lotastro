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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none print:border-none">
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

        <div className="print:p-0 space-y-6">
          {/* Header */}
          <div className="text-center border-b pb-4 print:border-black">
            <h1 className="text-2xl font-bold print:text-black">{t('warehouseOrderSummary')}</h1>
            <p className="text-muted-foreground print:text-black">{t('orderPreparationSheet')}</p>
          </div>

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-6 print:text-black">
            <Card className="print:shadow-none print:border-black">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t('orderInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">{t('orderNumber')}:</span>
                  <span>{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">{t('customer')}:</span>
                  <span>{order.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">{t('orderDate')}:</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">{t('status')}:</span>
                  <Badge variant={order.fulfilled_at ? "default" : "secondary"} className="print:border print:border-black print:bg-white print:text-black">
                    {order.fulfilled_at ? t('fulfilled') : t('pending')}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="print:shadow-none print:border-black">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t('summary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">{t('totalLots')}:</span>
                  <span>{order.order_lots.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">{t('totalRolls')}:</span>
                  <span>{totalRolls}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">{t('totalMeters')}:</span>
                  <span>{totalMeters.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">{t('preparedBy')}:</span>
                  <span>________________</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lots Table */}
          <Card className="print:shadow-none print:border-black">
            <CardHeader>
              <CardTitle>{t('lotDetails')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse print:border-black">
                  <thead>
                    <tr className="border-b print:border-black">
                      <th className="text-left p-2 print:border print:border-black">#</th>
                      <th className="text-left p-2 print:border print:border-black">{t('lotNumber')}</th>
                      <th className="text-left p-2 print:border print:border-black">{t('quality')}</th>
                      <th className="text-left p-2 print:border print:border-black">{t('color')}</th>
                      <th className="text-left p-2 print:border print:border-black">{t('metersPerRoll')}</th>
                      <th className="text-left p-2 print:border print:border-black">{t('rollCount')}</th>
                      <th className="text-left p-2 print:border print:border-black">{t('totalMeters')}</th>
                      <th className="text-left p-2 print:border print:border-black">{t('lineType')}</th>
                      <th className="text-left p-2 print:border print:border-black">{t('prepared')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_lots.map((lot, index) => (
                      <tr key={lot.id} className="border-b print:border-black">
                        <td className="p-2 print:border print:border-black">{index + 1}</td>
                        <td className="p-2 print:border print:border-black font-medium">{lot.lot.lot_number}</td>
                        <td className="p-2 print:border print:border-black">{lot.quality}</td>
                        <td className="p-2 print:border print:border-black">
                          <div className="flex items-center">
                            <div 
                              className="w-4 h-4 rounded mr-2 border print:border-black"
                              style={{ backgroundColor: lot.color.toLowerCase() }}
                            ></div>
                            {lot.color}
                          </div>
                        </td>
                        <td className="p-2 print:border print:border-black">{lot.lot.meters.toLocaleString()}</td>
                        <td className="p-2 print:border print:border-black">{lot.roll_count}</td>
                        <td className="p-2 print:border print:border-black">{(lot.lot.meters * lot.roll_count).toLocaleString()}</td>
                        <td className="p-2 print:border print:border-black">
                          <Badge 
                            variant={lot.line_type === 'sample' ? "outline" : "default"}
                            className="print:border print:border-black print:bg-white print:text-black"
                          >
                            {lot.line_type === 'sample' ? t('sample') : t('standard')}
                          </Badge>
                        </td>
                        <td className="p-2 print:border print:border-black text-center">☐</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="border-t pt-4 space-y-4 print:border-black">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2 print:text-black">{t('notes')}:</h3>
                <div className="border rounded p-3 h-20 print:border-black"></div>
              </div>
              <div>
                <h3 className="font-medium mb-2 print:text-black">{t('signatures')}:</h3>
                <div className="space-y-3">
                  <div>
                    <span className="print:text-black">{t('preparedBy')}: ______________________</span>
                  </div>
                  <div>
                    <span className="print:text-black">{t('checkedBy')}: ______________________</span>
                  </div>
                  <div>
                    <span className="print:text-black">{t('date')}: ______________________</span>
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