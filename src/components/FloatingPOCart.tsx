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
  AlertTriangle
} from 'lucide-react';

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

  const handleCreatePO = () => {
    const mode = getCurrentMode();
    const isMultiMode = mode === 'multi' || mode === 'multi-sample';
    const uniqueCombos = getUniqueQualityColors();

    // Validate multi-mode requires at least 2 quality+color combinations
    if (isMultiMode && uniqueCombos.size < 2) {
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
          
          <SheetContent className="w-full sm:max-w-lg">
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
              {isMultiMode && uniqueCombos.size < 2 && (
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
                       <div className="text-2xl font-bold">{getTotalMeters().toFixed(1)}m</div>
                       <div className="text-sm text-muted-foreground">{t('meters')}</div>
                     </div>
                   </div>
                </CardContent>
              </Card>

              {/* Cart Items - Grouped by Quality-Color */}
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {Object.entries(
                    cartItems.reduce((groups, item) => {
                      const key = `${item.quality}-${item.color}`;
                      if (!groups[key]) {
                        groups[key] = [];
                      }
                      groups[key].push(item);
                      return groups;
                    }, {} as Record<string, typeof cartItems>)
                  ).map(([qualityColor, items]) => {
                    const [quality, color] = qualityColor.split('-');
                    const totalRolls = items.reduce((sum, item) => sum + item.selectedRollIds.length, 0);
                    const totalMeters = items.reduce((sum, item) => sum + item.selectedRollsData.reduce((rollSum, roll) => rollSum + roll.meters, 0), 0);
                    
                    return (
                      <Card key={qualityColor}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-lg">{quality} - {color}</div>
                                <div className="text-sm text-muted-foreground">
                                  {items.length} {items.length === 1 ? t('lot') : t('lots')} • {totalRolls} {t('rolls')} • {totalMeters.toFixed(1)}m
                                </div>
                              </div>
                            </div>
                            
                            {/* Individual lots in this quality-color group */}
                            <div className="space-y-2 border-l-2 border-muted pl-3">
                              {items.map((item) => (
                                <div key={item.id} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-mono font-medium">{item.lot_number}</span>
                                      {item.lineType === 'sample' && (
                                        <Badge variant="outline" className="text-xs">{t('sample')}</Badge>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeFromCart(item.id)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    {item.supplier_name && (
                                      <div className="flex items-center space-x-1">
                                        <Building2 className="h-3 w-3" />
                                        <span>{item.supplier_name}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="h-3 w-3" />
                                      <span>{format(new Date(item.entry_date), 'MMM dd, yyyy')}</span>
                                      {item.age_days && (
                                        <Badge variant={item.age_days > 30 ? "destructive" : "secondary"} className="text-xs">
                                          {item.age_days} {t('daysOld')}
                                        </Badge>
                                      )}
                                    </div>
                                    <div>
                                      {item.selectedRollsData.reduce((total, roll) => total + roll.meters, 0).toFixed(1)}m • {item.selectedRollIds.length} {t('rolls')}
                                    </div>
                                  </div>

                                  {/* Quantity Controls - Disabled for samples */}
                                  {item.lineType !== 'sample' && (
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => adjustQuantity(item.id, -1)}
                                        disabled={item.selectedRollIds.length <= 1}
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={item.roll_count}
                                        value={item.selectedRollIds.length}
                                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                        className="w-16 text-center h-8"
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => adjustQuantity(item.id, 1)}
                                        disabled={item.selectedRollIds.length >= item.roll_count}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>

              <Separator />

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={handleCreatePO}
                  size="lg"
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {t('createOrder')}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleContinueShopping}
                    variant="outline"
                    size="sm"
                    className="text-sm"
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
        </Sheet>
      </div>
    </>
  );
};

export default FloatingPOCart;