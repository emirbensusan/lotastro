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
  const { t } = useLanguage();
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
        title: String(t('error')),
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
        title: String(t('mfa.enabled')),
        description: String(t('mfa.enabledDesc'))
      });

      onEnrollmentComplete();
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message || String(t('mfa.invalidCode')));
      toast({
        title: String(t('mfa.verificationError')),
        description: err.message || String(t('mfa.invalidCode')),
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
        title: String(t('mfa.copied')),
        description: String(t('mfa.copiedDesc'))
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">
            {String(t('mfa.preparing'))}
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
              {String(t('cancel'))}
            </Button>
            <Button onClick={enrollMFA}>
              {String(t('mfa.tryAgain'))}
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
          {String(t('mfa.setupTitle'))}
        </CardTitle>
        <CardDescription>
          {String(t('mfa.setupDescription'))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: QR Code */}
        <div className="space-y-4">
          <h3 className="font-medium">
            {String(t('mfa.step1Title'))}
          </h3>
          <p className="text-sm text-muted-foreground">
            {String(t('mfa.step1Description'))}
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
            {String(t('mfa.manualEntry'))}
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
            {String(t('mfa.step2Title'))}
          </h3>
          <p className="text-sm text-muted-foreground">
            {String(t('mfa.step2Description'))}
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
            {String(t('cancel'))}
          </Button>
          <Button 
            onClick={verifyAndComplete} 
            disabled={verificationCode.length !== 6 || verifying}
          >
            {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {String(t('mfa.enableButton'))}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MFAEnroll;
