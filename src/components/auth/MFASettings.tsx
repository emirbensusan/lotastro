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
  const { language } = useLanguage();
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
        title: language === 'tr' ? 'Hata' : 'Error',
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
        title: language === 'tr' ? 'MFA Kaldırıldı' : 'MFA Removed',
        description: language === 'tr' 
          ? 'İki faktörlü kimlik doğrulama devre dışı bırakıldı'
          : 'Two-factor authentication has been disabled'
      });

      loadFactors();
    } catch (err: any) {
      console.error('Error unenrolling MFA:', err);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
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
            {language === 'tr' ? 'İki Faktörlü Kimlik Doğrulama' : 'Two-Factor Authentication'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Hesabınıza ekstra bir güvenlik katmanı ekleyin'
              : 'Add an extra layer of security to your account'}
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
                      {language === 'tr' ? 'MFA Etkin' : 'MFA Enabled'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === 'tr' 
                        ? 'Hesabınız iki faktörlü kimlik doğrulama ile korunuyor'
                        : 'Your account is protected with two-factor authentication'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <ShieldOff className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {language === 'tr' ? 'MFA Devre Dışı' : 'MFA Disabled'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === 'tr' 
                        ? 'Hesabınızı korumak için MFA\'yı etkinleştirin'
                        : 'Enable MFA to protect your account'}
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
                    {language === 'tr' ? 'MFA Ekle' : 'Add MFA'}
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
              {language === 'tr' ? 'Kayıtlı Cihazlar' : 'Enrolled Devices'}
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
                        {factor.friendly_name || (language === 'tr' ? 'Kimlik Doğrulama Uygulaması' : 'Authenticator App')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === 'tr' ? 'Eklendi:' : 'Added:'}{' '}
                        {new Date(factor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={factor.status === 'verified' ? 'default' : 'secondary'}>
                      {factor.status === 'verified' 
                        ? (language === 'tr' ? 'Aktif' : 'Active')
                        : (language === 'tr' ? 'Beklemede' : 'Pending')}
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
                            {language === 'tr' ? 'MFA\'yı Kaldır?' : 'Remove MFA?'}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {language === 'tr' 
                              ? 'Bu işlem geri alınamaz. MFA\'yı kaldırmak hesabınızın güvenliğini azaltacaktır.'
                              : 'This action cannot be undone. Removing MFA will reduce the security of your account.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {language === 'tr' ? 'İptal' : 'Cancel'}
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => unenrollFactor(factor.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {language === 'tr' ? 'Kaldır' : 'Remove'}
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
                {language === 'tr' ? 'MFA Neden Önemli?' : 'Why is MFA Important?'}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {language === 'tr' 
                  ? 'İki faktörlü kimlik doğrulama, şifreniz ele geçirilse bile hesabınızı korur. Giriş yapmak için hem şifrenizi hem de telefonunuzdaki bir kodu kullanmanız gerekir.'
                  : 'Two-factor authentication protects your account even if your password is compromised. You\'ll need both your password and a code from your phone to sign in.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MFASettings;
