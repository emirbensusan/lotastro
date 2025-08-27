import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import InventoryExcel from './InventoryExcel';
import { Package } from 'lucide-react';

const Inventory = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('inventory')}</h1>
        <Package className="h-8 w-8 text-primary" />
      </div>

      <InventoryExcel mode="view" />
    </div>
  );
};

export default Inventory;