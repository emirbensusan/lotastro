import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface MFAEnrollProps {
  onEnrollmentComplete: () => void;
  onCancel: () => void;
}

const MFAEnroll: React.FC<MFAEnrollProps> = ({ onEnrollmentComplete, onCancel }) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    enrollMFA();
  }, []);

  const enrollMFA = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App'
      });

      if (error) throw error;

      if (data) {
        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      }
    } catch (err: any) {
      console.error('MFA enrollment error:', err);
      setError(err.message || 'Failed to start MFA enrollment');
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: err.message || 'Failed to start MFA enrollment',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndComplete = async () => {
    if (!factorId || verificationCode.length !== 6) return;
    
    setVerifying(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode
      });

      if (verifyError) throw verifyError;

      toast({
        title: language === 'tr' ? 'MFA Etkinleştirildi' : 'MFA Enabled',
        description: language === 'tr' 
          ? 'İki faktörlü kimlik doğrulama başarıyla etkinleştirildi'
          : 'Two-factor authentication has been successfully enabled'
      });

      onEnrollmentComplete();
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message || 'Invalid verification code');
      toast({
        title: language === 'tr' ? 'Doğrulama Hatası' : 'Verification Error',
        description: err.message || 'Invalid verification code. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: language === 'tr' ? 'Kopyalandı' : 'Copied',
        description: language === 'tr' ? 'Gizli anahtar panoya kopyalandı' : 'Secret key copied to clipboard'
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">
            {language === 'tr' ? 'MFA kurulumu hazırlanıyor...' : 'Preparing MFA setup...'}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (error && !qrCode) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              {language === 'tr' ? 'İptal' : 'Cancel'}
            </Button>
            <Button onClick={enrollMFA}>
              {language === 'tr' ? 'Tekrar Dene' : 'Try Again'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          {language === 'tr' ? 'İki Faktörlü Kimlik Doğrulama Kurulumu' : 'Set Up Two-Factor Authentication'}
        </CardTitle>
        <CardDescription>
          {language === 'tr' 
            ? 'Hesabınızı korumak için bir kimlik doğrulama uygulaması kullanın'
            : 'Use an authenticator app to protect your account'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: QR Code */}
        <div className="space-y-4">
          <h3 className="font-medium">
            {language === 'tr' ? 'Adım 1: QR Kodunu Tarayın' : 'Step 1: Scan the QR Code'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === 'tr' 
              ? 'Google Authenticator, Authy veya benzer bir uygulama ile tarayın'
              : 'Scan with Google Authenticator, Authy, or a similar app'}
          </p>
          {qrCode && (
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img src={qrCode} alt="QR Code" className="w-48 h-48" />
            </div>
          )}
        </div>

        {/* Manual Entry Option */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {language === 'tr' 
              ? 'Veya bu kodu manuel olarak girin:'
              : 'Or enter this code manually:'}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
              {secret}
            </code>
            <Button variant="outline" size="icon" onClick={copySecret}>
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Step 2: Verify */}
        <div className="space-y-4">
          <h3 className="font-medium">
            {language === 'tr' ? 'Adım 2: Doğrulama Kodunu Girin' : 'Step 2: Enter Verification Code'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === 'tr' 
              ? 'Uygulamanızdaki 6 haneli kodu girin'
              : 'Enter the 6-digit code from your authenticator app'}
          </p>
          
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={verificationCode}
              onChange={setVerificationCode}
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
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onCancel} disabled={verifying}>
            {language === 'tr' ? 'İptal' : 'Cancel'}
          </Button>
          <Button 
            onClick={verifyAndComplete} 
            disabled={verificationCode.length !== 6 || verifying}
          >
            {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {language === 'tr' ? 'MFA\'yı Etkinleştir' : 'Enable MFA'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MFAEnroll;
