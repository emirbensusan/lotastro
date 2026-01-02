import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useLoginRateLimit } from '@/hooks/useLoginRateLimit';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Globe, Eye, EyeOff, AlertTriangle, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MFAVerify from '@/components/auth/MFAVerify';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showMfaVerify, setShowMfaVerify] = useState(false);
  
  const { signIn, signOut, user, mfaRequired, mfaVerified, completeMfaVerification } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const { 
    rateLimitState, 
    checkRateLimit, 
    recordAttempt, 
    formatTimeRemaining,
    maxAttempts 
  } = useLoginRateLimit();

  // Redirect to home only if user is authenticated AND MFA is verified (or not required)
  useEffect(() => {
    if (user && mfaVerified) {
      navigate('/');
    }
  }, [user, mfaVerified, navigate]);

  // Show MFA screen if required
  useEffect(() => {
    if (user && mfaRequired && !mfaVerified) {
      setShowMfaVerify(true);
    }
  }, [user, mfaRequired, mfaVerified]);

  // Countdown timer for lockout
  useEffect(() => {
    if (rateLimitState.secondsRemaining > 0) {
      setCountdown(rateLimitState.secondsRemaining);
    }
  }, [rateLimitState.secondsRemaining]);

  useEffect(() => {
    if (countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Re-check rate limit when countdown expires
          if (email) {
            checkRateLimit(email);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, email, checkRateLimit]);

  // Check rate limit when email changes (debounced)
  useEffect(() => {
    if (!email || !email.includes('@')) return;
    
    const debounceTimer = setTimeout(() => {
      checkRateLimit(email);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [email, checkRateLimit]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check rate limit before attempting login
    const currentState = await checkRateLimit(email);
    if (currentState.isLocked) {
      setCountdown(currentState.secondsRemaining);
      toast({
        title: t('accountLocked') as string,
        description: (t('accountLockedDescription') as string).replace('{time}', formatTimeRemaining(currentState.secondsRemaining)),
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    const { error, mfaRequired: needsMfa } = await signIn(email, password);
    
    if (error) {
      // Record failed attempt
      await recordAttempt(email, false);
      
      let errorMessage = error.message;
      
      // Handle specific errors with better messaging
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = t('invalidCredentials') as string;
        
        // Show remaining attempts warning
        const updatedState = await checkRateLimit(email);
        const remaining = maxAttempts - updatedState.failedAttempts;
        if (remaining > 0 && remaining <= 3) {
          errorMessage += ` ${(t('attemptsRemaining') as string).replace('{count}', String(remaining))}`;
        }
      } else if (error.message.includes('Email address') && error.message.includes('invalid')) {
        errorMessage = (t('emailDomainNotAllowed') as string).replace('{domain}', email.split('@')[1]);
      }
      
      toast({
        title: t('signInFailed') as string,
        description: errorMessage,
        variant: "destructive",
      });
    } else if (needsMfa) {
      // MFA is required - show MFA verification screen
      setShowMfaVerify(true);
      toast({
        title: t('mfaRequired') as string || 'MFA Required',
        description: t('mfaRequiredDescription') as string || 'Please enter your verification code',
      });
    } else {
      // Record successful attempt
      await recordAttempt(email, true);
      
      toast({
        title: t('welcomeBackAuth') as string,
        description: t('signInSuccess') as string,
      });
      navigate('/');
    }
    
    setLoading(false);
  };

  const handleMfaVerificationComplete = () => {
    completeMfaVerification();
    setShowMfaVerify(false);
    toast({
      title: t('welcomeBackAuth') as string,
      description: t('signInSuccess') as string,
    });
    navigate('/');
  };

  const handleMfaCancel = async () => {
    setShowMfaVerify(false);
    await signOut();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({
        title: t('validationError') as string,
        description: t('email') as string + ' ' + (language === 'en' ? 'is required' : 'gerekli'),
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: t('resetEmailSent') as string,
        description: t('resetEmailSentDescription') as string,
      });

      setResetDialogOpen(false);
      setResetEmail('');
    } catch (error: any) {
      toast({
        title: t('resetEmailFailed') as string,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const isLocked = rateLimitState.isLocked || countdown > 0;

  // Show MFA verification screen
  if (showMfaVerify) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <MFAVerify 
          onVerificationComplete={handleMfaVerificationComplete}
          onCancel={handleMfaCancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/lotastro-logo.svg" 
              alt="LotAstro Logo" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <CardTitle className="text-2xl font-bold text-primary">LotAstro</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'en' ? 'tr' : 'en')}
              className="ml-2"
            >
              <Globe className="h-4 w-4 mr-1" />
              {language === 'en' ? 'TR' : 'EN'}
            </Button>
          </div>
          <CardDescription>
            {t('authDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Lockout Warning */}
          {isLocked && (
            <Alert variant="destructive" className="mb-4">
              <Lock className="h-4 w-4" />
              <AlertDescription className="ml-2">
                {(t('accountLockedDescription') as string).replace('{time}', formatTimeRemaining(countdown))}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Attempts Warning */}
          {!isLocked && rateLimitState.failedAttempts > 0 && rateLimitState.failedAttempts < maxAttempts && (
            <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="ml-2 text-yellow-700 dark:text-yellow-400">
                {(t('attemptsRemaining') as string).replace('{count}', String(maxAttempts - rateLimitState.failedAttempts))}
              </AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">{t('email')}</Label>
              <Input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">{t('password')}</Label>
              <div className="relative">
                <Input
                  id="signin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                  disabled={isLocked}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLocked}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading || isLocked}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('signingIn')}
                </>
              ) : isLocked ? (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {(t('tryAgainIn') as string).replace('{time}', formatTimeRemaining(countdown))}
                </>
              ) : (
                t('signIn')
              )}
            </Button>
            
            <div className="text-center">
              <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="link" className="text-sm text-muted-foreground">
                    {t('forgotPassword')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('resetPassword')}</DialogTitle>
                    <DialogDescription>
                      {t('resetPasswordDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">{t('email')}</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder={t('email') as string}
                        required
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setResetDialogOpen(false);
                          setResetEmail('');
                        }}
                      >
                        {t('cancel')}
                      </Button>
                      <Button type="submit" disabled={resetLoading}>
                        {resetLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('sending')}
                          </>
                        ) : (
                          t('sendResetLink')
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
