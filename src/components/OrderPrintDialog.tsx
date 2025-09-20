import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
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
    selected_roll_meters: string | null;
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

  const generateMaskedOrderId = (originalId: string) => {
    const hash = originalId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const randomSuffix = Math.abs(hash % 10000).toString().padStart(4, '0');
    return `ORD-${randomSuffix}`;
  };

  const formatRollMeters = (lot: any) => {
    if (!lot.selected_roll_meters) return '0m';
    
    const rollMeters = lot.selected_roll_meters.split(',').map((m: string) => m.trim());
    
    if (rollMeters.length === 1) {
      return `${rollMeters[0]}m`;
    } else {
      const total = rollMeters.reduce((sum: number, meters: string) => sum + parseFloat(meters), 0);
      return `${rollMeters.join('m + ')}m (${total.toFixed(1)}m)`;
    }
  };

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-none print:p-6">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center justify-between">
            {t('orderSummary')}
            <Button onClick={handlePrint} size="sm">
              <Printer className="h-4 w-4 mr-2" />
              {t('print')}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 print:space-y-4">
          {/* Print Header */}
          <div className="hidden print:block">
            <h1 className="text-center text-lg font-bold border-b border-black pb-2 mb-4">
              {t('warehouseOrderSummary')}
            </h1>
          </div>

          {/* Header for screen */}
          <div className="text-center border-b pb-4 print:hidden">
            <h1 className="text-2xl font-bold">{t('warehouseOrderSummary')}</h1>
          </div>

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-6 print:gap-4 print:mb-4 print:text-sm">
            <div className="print:text-black">
              <p><strong>{t('orderNumber')}:</strong> {generateMaskedOrderId(order.order_number)}</p>
              <p><strong>{t('customer')}:</strong> {order.customer_name}</p>
            </div>
            <div className="print:text-black">
              <p><strong>{t('orderDate')}:</strong> {formatDate(order.created_at)}</p>
              <p><strong>{t('status')}:</strong> {order.fulfilled_at ? t('fulfilled') : t('pending')}</p>
            </div>
          </div>

          {/* Quality Table */}
          <div className="overflow-x-auto print:min-h-[60vh]">
            <table className="w-full border-collapse border border-gray-300 print:border-black">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 print:border-0 p-2 text-left print:text-xs">#</th>
                  <th className="border border-gray-300 print:border-0 p-2 text-left print:text-xs">{t('quality')}</th>
                  <th className="border border-gray-300 print:border-0 p-2 text-left print:text-xs">{t('color')}</th>
                  <th className="border border-gray-300 print:border-0 p-2 text-left print:text-xs">{t('lotNumber')}</th>
                  <th className="border border-gray-300 print:border-0 p-2 text-left print:text-xs">{t('rollCount')}</th>
                  <th className="border border-gray-300 print:border-0 p-2 text-left print:text-xs">{t('lineType')}</th>
                  <th className="border border-gray-300 print:border-0 p-2 text-left print:text-xs">{t('rollMeters')}</th>
                  <th className="border border-gray-300 print:border-0 p-2 text-left print:text-xs">{t('prepared')}</th>
                </tr>
              </thead>
              <tbody>
                {order.order_lots.map((lot, index) => (
                  <tr key={lot.id} className="print:h-8">
                    <td className="border border-gray-300 print:border-0 p-2 print:text-xs print:text-black">{index + 1}</td>
                    <td className="border border-gray-300 print:border-0 p-2 print:text-xs print:text-black">{lot.quality}</td>
                    <td className="border border-gray-300 print:border-0 p-2 print:text-xs print:text-black">{lot.color}</td>
                    <td className="border border-gray-300 print:border-0 p-2 print:text-xs print:text-black">{lot.lot.lot_number}</td>
                    <td className="border border-gray-300 print:border-0 p-2 print:text-xs print:text-black">{lot.roll_count}</td>
                    <td className="border border-gray-300 print:border-0 p-2 print:text-xs print:text-black">
                      {lot.line_type === 'sample' ? t('sample') : t('standard')}
                    </td>
                    <td className="border border-gray-300 print:border-0 p-2 print:text-xs print:text-black">
                      {formatRollMeters(lot)}
                    </td>
                    <td className="border border-gray-300 print:border-0 p-2 text-center text-lg">☐</td>
                  </tr>
                ))}
                {/* Empty rows for print spacing */}
                {Array.from({ length: Math.max(0, 15 - order.order_lots.length) }).map((_, index) => (
                  <tr key={`empty-${index}`} className="hidden print:table-row print:h-8">
                    <td className="print:border-0 p-1"></td>
                    <td className="print:border-0 p-1"></td>
                    <td className="print:border-0 p-1"></td>
                    <td className="print:border-0 p-1"></td>
                    <td className="print:border-0 p-1"></td>
                    <td className="print:border-0 p-1"></td>
                    <td className="print:border-0 p-1"></td>
                    <td className="print:border-0 p-1"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="grid grid-cols-2 gap-6 print:gap-4">
            <div>
              <h3 className="font-medium mb-2 print:text-sm print:text-black">{t('notes')}:</h3>
              <div className="border border-gray-300 print:border-black h-20 print:h-12 p-2 print:bg-white"></div>
            </div>
            <div>
              <h3 className="font-medium mb-2 print:text-sm print:text-black">{t('signatures')}:</h3>
              <div className="space-y-2 print:text-sm print:text-black">
                <div>{t('preparedBy')}: ______________________</div>
                <div>{t('checkedBy')}: ______________________</div>
                <div>{t('date')}: ______________________</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderPrintDialog;