import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PasswordStrengthIndicator, { isPasswordValid } from '@/components/PasswordStrengthIndicator';

const InviteAccept = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { signUp, user } = useAuth();
  const { t } = useLanguage();

  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'token' | 'supabase' | 'none'>('none');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If we have a token parameter, use legacy mode
      if (token) {
        setMode('token');
        fetchInvitation();
        return;
      }
      
      // If we have a session but no token, use Supabase invite mode
      if (session?.user) {
        setMode('supabase');
        setLoading(false);
        return;
      }
      
      // No token and no session
      setError(t('openInvitationFromEmail') as string);
      setLoading(false);
    };

    checkSession();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        setError(t('invalidOrExpiredInvitation') as string);
        return;
      }

      setInvitation(data);
    } catch (error: any) {
      console.error('Error fetching invitation:', error);
      setError(t('invalidOrExpiredInvitation') as string);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: t('validationError') as string,
        description: t('passwordsDoNotMatch') as string,
        variant: 'destructive',
      });
      return;
    }

    if (!isPasswordValid(password)) {
      toast({
        title: t('validationError') as string,
        description: t('passwordNotMeetRequirements') as string,
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);

    try {
      if (mode === 'token') {
        // Legacy token-based invitation
        const { error: signUpError } = await signUp(invitation.email, password, fullName, invitation.role);

        if (signUpError) {
          throw signUpError;
        }

        // Update invitation status
        const { error: updateError } = await supabase
          .from('user_invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('token', token);

        if (updateError) {
          console.error('Error updating invitation status:', updateError);
        }

        toast({
          title: t('accountCreated') as string,
          description: t('accountCreatedSuccess') as string,
        });

        navigate('/auth');
      } else if (mode === 'supabase') {
        // Supabase native invitation - user already exists, just needs to set password and name
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          throw new Error('No active session found');
        }

        // Update user password
        const { error: passwordError } = await supabase.auth.updateUser({
          password: password
        });

        if (passwordError) {
          throw passwordError;
        }

        // Update user profile with full name
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('user_id', session.user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }

        // Try to update invitation status (best effort)
        await supabase
          .from('user_invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('email', session.user.email)
          .eq('status', 'pending');

        toast({
          title: t('accountSetupComplete') as string,
          description: t('accountSetupSuccess') as string,
        });

        navigate('/');
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: t('error') as string,
        description: error.message || (t('failedToCompleteSetup') as string),
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-xl font-bold text-destructive">{t('invalidInvitation')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/auth')} variant="outline">
              {t('goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">{t('welcomeToLotAstro')}</CardTitle>
          <CardDescription>
            {mode === 'token' && invitation?.role 
              ? `${t('invitedAsRole')} ${invitation.role.replace('_', ' ')}`
              : t('completeAccountSetup')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'token' && invitation && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{t('invitationDetails')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('email')}: {invitation.email}</p>
              <p className="text-sm text-muted-foreground">{t('role')}: {invitation.role?.replace('_', ' ')}</p>
            </div>
          )}

          <form onSubmit={handleAcceptInvitation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('fullName')}</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder={t('enterFullName') as string}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t('createPassword') as string}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <PasswordStrengthIndicator password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder={t('confirmYourPassword') as string}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === 'supabase' ? t('settingUpAccount') : t('creatingAccount')}
                </>
              ) : (
                mode === 'supabase' ? t('completeAccountSetupButton') : t('acceptInvitationCreateAccount')
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => navigate('/auth')}>
              {t('alreadyHaveAccount')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteAccept;