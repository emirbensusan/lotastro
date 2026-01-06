import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Shield, AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import MFAEnroll from './MFAEnroll';

interface MfaRequiredRoles {
  admin: boolean;
  senior_manager: boolean;
  accounting: boolean;
  warehouse_staff: boolean;
}

interface MFAEnrollmentBannerProps {
  /** If true, shows a dismissible banner. If false, shows a blocking dialog */
  dismissible?: boolean;
  /** Custom message to display */
  message?: string;
}

/**
 * Banner/Dialog that prompts users to set up MFA if their role requires it.
 * Checks system settings to determine which roles need MFA.
 */
const MFAEnrollmentBanner: React.FC<MFAEnrollmentBannerProps> = ({
  dismissible = true,
  message,
}) => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [hasMFA, setHasMFA] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [roleRequiresMfa, setRoleRequiresMfa] = useState(false);

  useEffect(() => {
    if (profile?.role) {
      checkMfaRequirements();
    }
  }, [profile?.role]);

  const checkMfaRequirements = async () => {
    try {
      // Fetch role-based MFA settings
      const { data: settingsData } = await (supabase
        .from('system_settings' as any)
        .select('setting_value')
        .eq('setting_key', 'session_config')
        .maybeSingle() as unknown as Promise<{ data: { setting_value: { mfa_required_roles?: MfaRequiredRoles } } | null; error: any }>);
      
      const mfaRoles = settingsData?.setting_value?.mfa_required_roles || {
        admin: true,
        senior_manager: true,
        accounting: true,
        warehouse_staff: false,
      };
      
      const userRole = profile?.role as keyof MfaRequiredRoles;
      const requiresMfa = userRole ? mfaRoles[userRole] ?? false : false;
      setRoleRequiresMfa(requiresMfa);
      
      // Only check MFA status if role requires it
      if (requiresMfa) {
        await checkMFAStatus();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking MFA requirements:', error);
      setLoading(false);
    }
  };

  const checkMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) {
        console.error('Error checking MFA status:', error);
        setHasMFA(false);
        return;
      }

      // Check if user has any verified TOTP factors
      const verifiedFactors = data?.totp?.filter(f => f.status === 'verified') || [];
      setHasMFA(verifiedFactors.length > 0);
    } catch (err) {
      console.error('MFA check failed:', err);
      setHasMFA(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentComplete = () => {
    setShowEnrollDialog(false);
    setHasMFA(true);
  };

  // Only show for users whose role requires MFA and don't have it set up
  if (loading || hasMFA !== false || !roleRequiresMfa) {
    return null;
  }

  // If dismissed, don't show
  if (dismissed && dismissible) {
    return null;
  }

  const defaultMessage = String(t('mfa.adminMfaMessage'));

  return (
    <>
      <Alert variant="destructive" className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-700 dark:text-orange-400 flex items-center justify-between">
          <span>{String(t('mfa.securityRecommendation'))}</span>
          {dismissible && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </AlertTitle>
        <AlertDescription className="text-orange-700 dark:text-orange-400">
          <p className="mb-2">{message || defaultMessage}</p>
          <Button 
            variant="outline" 
            size="sm"
            className="border-orange-500 text-orange-700 hover:bg-orange-100"
            onClick={() => setShowEnrollDialog(true)}
          >
            <Shield className="h-4 w-4 mr-2" />
            {String(t('mfa.setUpMfaNow'))}
          </Button>
        </AlertDescription>
      </Alert>

      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="max-w-md">
          <MFAEnroll 
            onEnrollmentComplete={handleEnrollmentComplete}
            onCancel={() => setShowEnrollDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MFAEnrollmentBanner;
