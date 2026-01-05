import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePOCart } from '@/contexts/POCartProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  ShoppingCart, 
  X, 
  Minus, 
  Plus, 
  ArrowRight, 
  Calendar,
  Building2,
  Package,
  FileText,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { getMinQualitiesForMultiOrder } from '@/components/OrderFlowSettingsTab';

const FloatingPOCart = () => {
  const { user } = useAuth();
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    clearCart,
    isCartOpen,
    setIsCartOpen,
    getTotalMeters,
    getTotalRolls,
    getItemCount,
  } = usePOCart();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Don't render cart on public pages (when user is not logged in)
  if (!user) {
    return null;
  }

  // Get unique quality+color combinations in cart
  const getUniqueQualityColors = () => {
    return new Set(cartItems.map(item => `${item.quality}|${item.color}`));
  };

  // Check current mode from URL
  const getCurrentMode = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode');
  };

  // Get order mode label and color for badge
  const getOrderModeInfo = () => {
    const mode = getCurrentMode();
    switch (mode) {
      case 'single': return { label: t('standardOrder'), color: 'bg-blue-500' };
      case 'multi': return { label: t('multiQualityOrder'), color: 'bg-purple-500' };
      case 'sample': return { label: t('sampleOrder'), color: 'bg-green-500' };
      case 'multi-sample': return { label: t('multipleSamples'), color: 'bg-orange-500' };
      default: return null;
    }
  };

  const mode = getCurrentMode();
  const isMultiMode = mode === 'multi' || mode === 'multi-sample';
  const uniqueCombos = getUniqueQualityColors();
  const orderModeInfo = getOrderModeInfo();

  // Group cart items by quality-color for display
  const groupedItems = cartItems.reduce((acc, item) => {
    const key = `${item.quality}-${item.color}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof cartItems>);

  const handleCreatePO = () => {
    const mode = getCurrentMode();
    const isMultiMode = mode === 'multi' || mode === 'multi-sample';
    const uniqueCombos = getUniqueQualityColors();

    // Validate multi-mode requires minimum quality+color combinations
    const minRequired = getMinQualitiesForMultiOrder();
    if (isMultiMode && uniqueCombos.size < minRequired) {
      toast({
        title: t('error') as string,
        description: t('multiOrderMinimum') as string,
        variant: 'destructive',
      });
      return;
    }

    // Navigate to orders page with cart data - pass complete cart items
    navigate('/orders', { 
      state: { 
        selectedLots: cartItems,
        fromCart: true 
      } 
    });
    setIsCartOpen(false);
  };

  const handleContinueShopping = () => {
    setIsCartOpen(false);
    // Preserve mode when continuing shopping
    const mode = getCurrentMode();
    const modeParam = mode ? `?mode=${mode}` : '';
    navigate(`/inventory${modeParam}`);
  };

  const adjustQuantity = (lotId: string, change: number) => {
    const item = cartItems.find(i => i.id === lotId);
    if (item) {
      const newQuantity = item.selectedRollIds.length + change;
      updateQuantity(lotId, newQuantity);
    }
  };

  if (getItemCount() === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Cart Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg relative">
              <ShoppingCart className="h-5 w-5 mr-2" />
              {t('cart')}
              <Badge variant="secondary" className="ml-2 min-w-[20px] h-5">
                {getItemCount()}
              </Badge>
            </Button>
          </SheetTrigger>
          
          {isCartOpen && (
            <SheetContent className="w-full sm:max-w-lg" data-owner="po-cart">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShoppingCart className="h-5 w-5" />
                    <span>{t('poCart')}</span>
                    {orderModeInfo && (
                      <Badge className={`${orderModeInfo.color} text-white text-xs`}>
                        {orderModeInfo.label}
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearCart}>
                    <X className="h-4 w-4" />
                    {t('clearAll')}
                  </Button>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Multi-mode warning if insufficient quality/color combinations */}
                {isMultiMode && uniqueCombos.size < getMinQualitiesForMultiOrder() && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 text-sm">
                      {t('multiOrderMinimumWarning')}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Cart Summary */}
                <Card>
                  <CardContent className="pt-4">
                     <div className="grid grid-cols-3 gap-4 text-center">
                       <div>
                         <div className="text-2xl font-bold">{Object.keys(cartItems.reduce((acc, item) => ({ ...acc, [`${item.quality}-${item.color}`]: true }), {})).length}</div>
                         <div className="text-sm text-muted-foreground">{t('qualityColors')}</div>
                       </div>
                       <div>
                         <div className="text-2xl font-bold">{getTotalRolls()}</div>
                         <div className="text-sm text-muted-foreground">{t('rolls')}</div>
                       </div>
                       <div>
                         <div className="text-2xl font-bold">{getTotalMeters().toLocaleString()}</div>
                         <div className="text-sm text-muted-foreground">{t('meters')}</div>
                       </div>
                     </div>
                  </CardContent>
                </Card>

                {/* Grouped Items by Quality-Color */}
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {Object.entries(groupedItems).map(([key, items]) => {
                      const [quality, color] = key.split('-');
                      const totalMeters = items.reduce((sum, item) => sum + item.meters, 0);
                      const totalRolls = items.length;
                      
                      return (
                        <Card key={key}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-medium">{quality}</div>
                                <div className="text-sm text-muted-foreground">{color}</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => items.forEach(item => removeFromCart(item.id))}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="flex justify-between text-sm">
                              <span>{totalRolls} {t('rolls')}</span>
                              <span>{totalMeters.toLocaleString()} {t('meters')}</span>
                            </div>
                            
                            {/* Individual roll details (collapsed by default) */}
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer">
                                {t('viewRollDetails')}
                              </summary>
                              <div className="mt-2 space-y-1">
                                {items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                                    <span>{t('lot')}: {item.lot_number}</span>
                                    <span>{item.meters}m</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Actions */}
                <div className="space-y-2 pt-4 border-t">
                  <Button 
                    onClick={handleCreatePO} 
                    className="w-full" 
                    disabled={cartItems.length === 0 || (isMultiMode && uniqueCombos.size < getMinQualitiesForMultiOrder())}
                  >
                    {isMultiMode ? t('createMultiOrder') : t('createOrder')}
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setIsCartOpen(false);
                        // Navigate to bulk selection with current quality filter
                        const firstItem = cartItems[0];
                        if (firstItem) {
                          navigate(`/bulk-selection?quality=${firstItem.quality}`);
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-sm"
                    >
                      {t('addMoreColors')}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsCartOpen(false);
                        navigate('/inventory');
                      }}
                      variant="outline"
                      size="sm"
                      className="text-sm"
                    >
                      {t('addDifferentQuality')}
                    </Button>
                  </div>
                  <Button
                    onClick={clearCart}
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive"
                  >
                    {t('clearAll')}
                  </Button>
                </div>
              </div>
            </SheetContent>
          )}
        </Sheet>
      </div>
    </>
  );
};

export default FloatingPOCart;