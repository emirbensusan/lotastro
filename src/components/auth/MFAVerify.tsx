import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface MFAVerifyProps {
  onVerificationComplete: () => void;
  onCancel: () => void;
}

const MFAVerify: React.FC<MFAVerifyProps> = ({ onVerificationComplete, onCancel }) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    loadFactors();
  }, []);

  useEffect(() => {
    // Auto-verify when 6 digits entered
    if (verificationCode.length === 6) {
      verifyCode();
    }
  }, [verificationCode]);

  const loadFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) throw error;

      // Find the first verified TOTP factor
      const totpFactor = data?.totp?.find(f => f.status === 'verified');
      
      if (totpFactor) {
        setFactorId(totpFactor.id);
      } else {
        setError(language === 'tr' 
          ? 'MFA faktörü bulunamadı' 
          : 'No MFA factor found');
      }
    } catch (err: any) {
      console.error('Error loading MFA factors:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!factorId || verificationCode.length !== 6 || verifying) return;
    
    setVerifying(true);
    setError(null);

    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) throw challengeError;

      // Verify the challenge with the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode
      });

      if (verifyError) throw verifyError;

      toast({
        title: language === 'tr' ? 'Doğrulandı' : 'Verified',
        description: language === 'tr' 
          ? 'Başarıyla giriş yaptınız'
          : 'You have successfully signed in'
      });

      onVerificationComplete();
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setAttempts(prev => prev + 1);
      setError(language === 'tr' 
        ? 'Geçersiz kod. Lütfen tekrar deneyin.'
        : 'Invalid code. Please try again.');
      setVerificationCode('');
      
      if (attempts >= 4) {
        toast({
          title: language === 'tr' ? 'Çok Fazla Deneme' : 'Too Many Attempts',
          description: language === 'tr' 
            ? 'Lütfen birkaç dakika bekleyin ve tekrar deneyin'
            : 'Please wait a few minutes and try again',
          variant: 'destructive'
        });
      }
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">
              {language === 'tr' ? 'Yükleniyor...' : 'Loading...'}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>
            {language === 'tr' ? 'İki Faktörlü Doğrulama' : 'Two-Factor Authentication'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin'
              : 'Enter the 6-digit code from your authenticator app'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={verificationCode}
              onChange={setVerificationCode}
              disabled={verifying}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {verifying && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{language === 'tr' ? 'Doğrulanıyor...' : 'Verifying...'}</span>
            </div>
          )}

          <div className="text-center">
            <Button variant="ghost" onClick={onCancel} disabled={verifying}>
              {language === 'tr' ? 'Farklı bir hesapla giriş yap' : 'Sign in with a different account'}
            </Button>
          </div>

          {attempts > 0 && (
            <p className="text-xs text-center text-muted-foreground">
              {language === 'tr' 
                ? `${5 - attempts} deneme hakkınız kaldı`
                : `${5 - attempts} attempts remaining`}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MFAVerify;
