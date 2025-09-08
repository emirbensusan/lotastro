import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const { signIn, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      let errorMessage = error.message;
      
      // Handle specific errors with better messaging
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = t('invalidCredentials') as string;
      } else if (error.message.includes('Email address') && error.message.includes('invalid')) {
        errorMessage = (t('emailDomainNotAllowed') as string).replace('{domain}', email.split('@')[1]);
      }
      
      toast({
        title: t('signInFailed') as string,
        description: errorMessage,
        variant: "destructive",
      });
    } else {
      toast({
        title: t('welcomeBackAuth') as string,
        description: t('signInSuccess') as string,
      });
      navigate('/');
    }
    
    setLoading(false);
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
        redirectTo: 'https://depo.lotastro.com/reset-password',
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
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">{t('email')}</Label>
              <Input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">{t('password')}</Label>
              <Input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('signingIn')}
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