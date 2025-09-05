import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/Futuristic%20%27lotastro%27%20Logo%20with%20Warehouse%20and%20Star%282%29.svg" 
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;