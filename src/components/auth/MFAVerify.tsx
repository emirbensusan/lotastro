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
  const { t } = useLanguage();
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
        setError(String(t('mfa.noFactor')));
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
        title: String(t('mfa.verified')),
        description: String(t('mfa.signedIn'))
      });

      onVerificationComplete();
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setAttempts(prev => prev + 1);
      setError(String(t('mfa.invalidCode')));
      setVerificationCode('');
      
      if (attempts >= 4) {
        toast({
          title: String(t('mfa.tooManyAttempts')),
          description: String(t('mfa.waitAndRetry')),
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
              {String(t('loading'))}
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
            {String(t('mfa.title'))}
          </CardTitle>
          <CardDescription>
            {String(t('mfa.enterCode'))}
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
              <span>{String(t('mfa.verifying'))}</span>
            </div>
          )}

          <div className="text-center">
            <Button variant="ghost" onClick={onCancel} disabled={verifying}>
              {String(t('mfa.signInDifferent'))}
            </Button>
          </div>

          {attempts > 0 && (
            <p className="text-xs text-center text-muted-foreground">
              {String(t('mfa.attemptsRemaining', { count: 5 - attempts }))}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MFAVerify;
