import React, { useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import InventoryPivotTable from '@/components/InventoryPivotTable';
import InquiryGateOverlay from '@/components/InquiryGateOverlay';
import { useInquiryGating } from '@/hooks/useInquiryGating';
import { Package, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const Inventory = () => {
  const { t } = useLanguage();
  const { 
    isLoading, 
    canAccessStock, 
    requiresInquiry, 
    activeInquiry, 
    hasActiveStockTakeSession,
    bypassReason,
    checkAccess,
    logStockView
  } = useInquiryGating();
  
  // Track if we've logged the view for this access session
  const hasLoggedView = useRef(false);
  
  // Log stock view when access is granted
  useEffect(() => {
    if (canAccessStock && !hasLoggedView.current) {
      hasLoggedView.current = true;
      logStockView({
        qualities_viewed: [], // Will be populated when user filters
        colors_viewed: [],
        filters_used: { page: 'inventory_pivot' },
      });
    }
  }, [canAccessStock, logStockView]);

  // Handle successful inquiry creation or stock take start
  const handleAccessGranted = () => {
    hasLoggedView.current = false; // Reset so we log the new access
    checkAccess();
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show gating overlay if inquiry is required
  if (requiresInquiry && !canAccessStock) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('inventory')}</h1>
          <Package className="h-8 w-8 text-primary" />
        </div>
        <InquiryGateOverlay 
          onInquiryCreated={handleAccessGranted}
          onStockTakeStarted={handleAccessGranted}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{t('inventory')}</h1>
          {/* Show context badge */}
          {activeInquiry && (
            <Badge variant="secondary" className="text-xs">
              {t('viewingWith')}: {activeInquiry.inquiry_number}
            </Badge>
          )}
          {hasActiveStockTakeSession && (
            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
              {t('stockTakeMode')}
            </Badge>
          )}
          {bypassReason === 'management_review' && (
            <Badge variant="outline" className="text-xs border-green-500 text-green-600">
              {t('managerAccess')}
            </Badge>
          )}
        </div>
        <Package className="h-8 w-8 text-primary" />
      </div>

      <InventoryPivotTable />
    </div>
  );
};

export default Inventory;
