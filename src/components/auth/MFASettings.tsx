import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, ShieldCheck, ShieldOff, Trash2, Plus, Smartphone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import MFAEnroll from './MFAEnroll';

interface Factor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const MFASettings: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) throw error;

      // Combine all factor types
      const allFactors: Factor[] = [
        ...(data?.totp || []),
        ...(data?.phone || [])
      ];
      
      setFactors(allFactors);
    } catch (err: any) {
      console.error('Error loading MFA factors:', err);
      toast({
        title: String(t('error')),
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const unenrollFactor = async (factorId: string) => {
    setUnenrolling(factorId);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      
      if (error) throw error;

      toast({
        title: String(t('mfa.removed')),
        description: String(t('mfa.removedDesc'))
      });

      loadFactors();
    } catch (err: any) {
      console.error('Error unenrolling MFA:', err);
      toast({
        title: String(t('error')),
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setUnenrolling(null);
    }
  };

  const handleEnrollmentComplete = () => {
    setEnrollDialogOpen(false);
    loadFactors();
  };

  const verifiedFactors = factors.filter(f => f.status === 'verified');
  const hasMFA = verifiedFactors.length > 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {String(t('mfa.settingsTitle'))}
          </CardTitle>
          <CardDescription>
            {String(t('mfa.settingsDesc'))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasMFA ? (
                <>
                  <ShieldCheck className="h-10 w-10 text-green-500" />
                  <div>
                    <p className="font-medium">
                      {String(t('mfa.mfaEnabled'))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {String(t('mfa.mfaEnabledDesc'))}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <ShieldOff className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {String(t('mfa.mfaDisabled'))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {String(t('mfa.mfaDisabledDesc'))}
                    </p>
                  </div>
                </>
              )}
            </div>
            
            {!hasMFA && (
              <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {String(t('mfa.addMfa'))}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <MFAEnroll 
                    onEnrollmentComplete={handleEnrollmentComplete}
                    onCancel={() => setEnrollDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enrolled Factors */}
      {factors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {String(t('mfa.enrolledDevices'))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {factors.map((factor) => (
                <div 
                  key={factor.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {factor.friendly_name || String(t('mfa.authenticatorApp'))}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {String(t('mfa.added'))}{' '}
                        {new Date(factor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={factor.status === 'verified' ? 'default' : 'secondary'}>
                      {factor.status === 'verified' 
                        ? String(t('active'))
                        : String(t('mfa.pending'))}
                    </Badge>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          disabled={unenrolling === factor.id}
                        >
                          {unenrolling === factor.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {String(t('mfa.removeMfa'))}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {String(t('mfa.removeConfirm'))}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {String(t('cancel'))}
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => unenrollFactor(factor.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {String(t('delete'))}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Info */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {String(t('mfa.whyImportant'))}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {String(t('mfa.whyImportantDesc'))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MFASettings;
