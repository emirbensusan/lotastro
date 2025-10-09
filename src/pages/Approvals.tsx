import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { ApprovalQueue } from '@/components/ApprovalQueue';
import { CheckCircle } from 'lucide-react';

const Approvals: React.FC = () => {
  const { loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { t } = useLanguage();

  if (authLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPermission('approvals', 'viewapprovals')) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">
          {t('accessDenied')}
        </h2>
        <p className="text-muted-foreground">
          {t('requiresApprovalPermissions')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CheckCircle className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">{t('approvals')}</h1>
      </div>
      
      <ApprovalQueue />
    </div>
  );
};

export default Approvals;