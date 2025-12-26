import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthenticatorAssuranceLevels } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'warehouse_staff' | 'accounting' | 'admin' | 'senior_manager';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; mfaRequired?: boolean }>;
  signUp: (email: string, password: string, fullName: string, role?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  completeMfaVerification: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Inner component that uses the session timeout hook
const AuthProviderInner: React.FC<{ 
  children: React.ReactNode;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}> = ({ children, signOut, isAuthenticated }) => {
  // Session timeout handling
  useSessionTimeout({
    onTimeout: signOut,
    isAuthenticated,
  });

  return <>{children}</>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetch to avoid deadlock
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error && data.session) {
      // Check MFA assurance level
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2') {
        setMfaRequired(true);
        setMfaVerified(false);
        return { error: null, mfaRequired: true };
      }
      setMfaVerified(true);
    }
    
    return { error };
  };

  const completeMfaVerification = () => {
    setMfaRequired(false);
    setMfaVerified(true);
  };

  const signUp = async (email: string, password: string, fullName: string, role: string = 'warehouse_staff') => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role
        }
      }
    });
    return { error };
  };

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    // If session not found, it means session was already invalidated
    // (e.g., after admin password change) - treat as successful logout
    if (error && !error.message?.includes('session_not_found') && !error.message?.includes('Session not found')) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
    // Always clear local state
    setSession(null);
    setUser(null);
    setProfile(null);
    setMfaRequired(false);
    setMfaVerified(false);
  }, []);

  const hasRole = (role: string) => {
    return profile?.role === role;
  };

  const value = {
    user,
    session,
    profile,
    loading,
    mfaRequired,
    mfaVerified,
    signIn,
    signUp,
    signOut,
    hasRole,
    completeMfaVerification,
  };

  return (
    <AuthContext.Provider value={value}>
      <AuthProviderInner 
        signOut={signOut} 
        isAuthenticated={!!session}
      >
        {children}
      </AuthProviderInner>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};