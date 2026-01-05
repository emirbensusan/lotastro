import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MFAEnroll from './MFAEnroll';

interface MfaRequiredRoles {
  admin: boolean;
  senior_manager: boolean;
  accounting: boolean;
  warehouse_staff: boolean;
}

interface MFAGateProps {
  children: React.ReactNode;
}

/**
 * MFAGate - Blocks access to protected routes for users whose role requires MFA
 * but haven't enrolled yet. This is a BLOCKING gate, not a dismissible banner.
 */
const MFAGate: React.FC<MFAGateProps> = ({ children }) => {
  const { profile, signOut, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasMFA, setHasMFA] = useState<boolean | null>(null);
  const [roleRequiresMfa, setRoleRequiresMfa] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Main effect: check MFA requirements when profile is available
  useEffect(() => {
    if (profile?.role) {
      checkMfaRequirements();
    } else if (!authLoading && !profile?.role) {
      // Auth finished loading but no role - fail open to avoid blocking UI
      console.warn('[MFAGate] No profile role found after auth loaded, allowing access');
      setLoading(false);
      setHasMFA(true);
    }
  }, [profile?.role, authLoading]);

  // Safety timeout: prevent infinite loading state
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[MFAGate] Timeout reached (10s), failing open');
        setLoading(false);
        setHasMFA(true);
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  const checkMfaRequirements = async () => {
    try {
      // Fetch role-based MFA settings from system_settings
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
        setHasMFA(true); // Role doesn't require MFA, treat as enrolled
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking MFA requirements:', error);
      // On error, allow access (fail open for availability, but log the error)
      setHasMFA(true);
      setLoading(false);
    }
  };

  const checkMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) {
        console.error('Error checking MFA status:', error);
        // On error, allow access but log
        setHasMFA(true);
        return;
      }

      // Check if user has any verified TOTP factors
      const verifiedFactors = data?.totp?.filter(f => f.status === 'verified') || [];
      setHasMFA(verifiedFactors.length > 0);
    } catch (err) {
      console.error('MFA check failed:', err);
      setHasMFA(true); // Fail open
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentComplete = () => {
    setShowEnrollDialog(false);
    setHasMFA(true);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  // NON-BLOCKING loading state: render children immediately with corner indicator
  // This prevents the MFA check from blocking pointer events on the sidebar
  if (loading) {
    return (
      <>
        {children}
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-card border rounded-lg px-3 py-2 shadow-lg pointer-events-none">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Verifying security...</span>
        </div>
      </>
    );
  }

  // If role requires MFA but user hasn't enrolled, BLOCK access
  if (roleRequiresMfa && hasMFA === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-destructive/10">
                <Shield className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl">Two-Factor Authentication Required</CardTitle>
            <CardDescription className="text-base mt-2">
              Your role ({profile?.role?.replace('_', ' ')}) requires Two-Factor Authentication (MFA) to access the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You must set up MFA before you can access the application. This is a security requirement for your role.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => setShowEnrollDialog(true)}
              >
                <Shield className="h-5 w-5 mr-2" />
                Set Up MFA Now
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                Sign Out
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground text-center mt-4">
              MFA adds an extra layer of security by requiring a code from your authenticator app in addition to your password.
            </p>
          </CardContent>
        </Card>

        <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
          <DialogContent className="max-w-md" data-owner="mfa-enroll">
            <MFAEnroll 
              onEnrollmentComplete={handleEnrollmentComplete}
              onCancel={() => setShowEnrollDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // User has MFA enrolled or role doesn't require it - allow access
  return <>{children}</>;
};

export default MFAGate;
