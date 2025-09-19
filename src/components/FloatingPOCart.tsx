import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { usePOCart } from '@/contexts/POCartProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  X, 
  Minus, 
  Plus, 
  ArrowRight, 
  Calendar,
  Building2,
  Package
} from 'lucide-react';

const FloatingPOCart = () => {
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

  const handleCreatePO = () => {
    // Navigate to orders page with cart data
    const lotsForOrder = cartItems.map(item => ({
      id: item.id,
      lot_number: item.lot_number,
      quality: item.quality,
      color: item.color,
      meters: item.meters,
      roll_count: item.roll_count,
      selectedRollIds: item.selectedRollIds,
    }));

    navigate('/orders', { 
      state: { 
        selectedLots: lotsForOrder,
        fromCart: true 
      } 
    });
    setIsCartOpen(false);
  };

  const handleContinueShopping = () => {
    setIsCartOpen(false);
    navigate('/inventory');
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
                </div>
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  <X className="h-4 w-4" />
                  {t('clearAll')}
                </Button>
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              {/* Cart Summary */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{getItemCount()}</div>
                      <div className="text-sm text-muted-foreground">{t('lots')}</div>
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

              {/* Cart Items */}
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center space-x-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{item.lot_number}</span>
                              <Badge variant="outline">
                                {item.quality} - {item.color}
                              </Badge>
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
                                <span>{new Date(item.entry_date).toLocaleDateString()}</span>
                                {item.age_days && (
                                  <Badge variant={item.age_days > 30 ? "destructive" : "secondary"} className="text-xs">
                                    {item.age_days}d
                                  </Badge>
                                )}
                              </div>
                              <div>
                                {((item.meters / item.roll_count) * item.selectedRollIds.length).toLocaleString()} {t('meters')} 
                                ({item.selectedRollIds.length} {t('rolls')})
                              </div>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center justify-between">
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
                                  className="w-16 text-center"
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
                  {t('createPO')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  onClick={handleContinueShopping}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  {t('continueShopping')}
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