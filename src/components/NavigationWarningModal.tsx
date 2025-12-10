import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface NavigationWarningModalProps {
  isOpen: boolean;
  onKeepInCart: () => void;
  onDiscard: () => void;
  itemCount: number;
  totalMeters: number;
}

const NavigationWarningModal: React.FC<NavigationWarningModalProps> = ({
  isOpen,
  onKeepInCart,
  onDiscard,
  itemCount,
  totalMeters,
}) => {
  const { t } = useLanguage();

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {t('incompleteOrderWarning')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{t('incompleteOrderDesc')}</p>
            <p className="font-medium text-foreground">
              {itemCount} {t('items')} • {totalMeters.toLocaleString()} {t('meters')}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard} className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            {t('discardOrder')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onKeepInCart} className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t('keepInCart')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default NavigationWarningModal;
