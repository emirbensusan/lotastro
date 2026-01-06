import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, FileSearch, ClipboardCheck, ArrowRight, Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import InquiryDialog from '@/components/InquiryDialog';
import StockTakeSessionDialog from '@/components/StockTakeSessionDialog';
import { useAuth } from '@/hooks/useAuth';
import { Inquiry } from '@/hooks/useInquiries';

interface InquiryGateOverlayProps {
  onInquiryCreated: () => void;
  onStockTakeStarted?: () => void;
}

export default function InquiryGateOverlay({ onInquiryCreated, onStockTakeStarted }: InquiryGateOverlayProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [inquiryDialogOpen, setInquiryDialogOpen] = useState(false);
  const [stockTakeDialogOpen, setStockTakeDialogOpen] = useState(false);

  // Show stock take option only for warehouse staff and accounting
  const canStartStockTake = profile?.role === 'warehouse_staff' || profile?.role === 'accounting';

  const handleInquirySuccess = () => {
    setInquiryDialogOpen(false);
    onInquiryCreated();
  };

  const handleStockTakeSuccess = () => {
    setStockTakeDialogOpen(false);
    onStockTakeStarted?.();
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full mx-4 border-primary/20 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl">{t('inquiryRequired')}</CardTitle>
          <CardDescription className="text-base mt-2">
            {t('inquiryRequiredDescription')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              {t('inquiryGatingExplanation')}
            </p>
          </div>

          {/* Primary action - Create Inquiry */}
          <Button 
            className="w-full h-12 text-base gap-2" 
            onClick={() => setInquiryDialogOpen(true)}
          >
            <FileSearch className="h-5 w-5" />
            {t('createInquiry')}
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>

          {/* Secondary action - Stock Take (for eligible roles) */}
          {canStartStockTake && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('or')}
                  </span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-11 gap-2"
                onClick={() => setStockTakeDialogOpen(true)}
              >
                <ClipboardCheck className="h-5 w-5" />
                {t('startStockTakeSession')}
              </Button>
            </>
          )}

          {/* Role badge */}
          <div className="flex justify-center pt-2">
            <Badge variant="secondary" className="text-xs">
              {t('loggedInAs')}: {profile?.full_name || profile?.email}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <InquiryDialog
        open={inquiryDialogOpen}
        onOpenChange={setInquiryDialogOpen}
        onSuccess={handleInquirySuccess}
      />

      <StockTakeSessionDialog
        open={stockTakeDialogOpen}
        onOpenChange={setStockTakeDialogOpen}
        onSuccess={handleStockTakeSuccess}
      />
    </div>
  );
}
