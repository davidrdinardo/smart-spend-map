
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, checkAuthState } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  authDebugInfo: () => any;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    console.log("AuthProvider: Setting up auth state listener");
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log("Auth state changed:", event, newSession?.user?.id);
        
        if (event === 'SIGNED_IN') {
          toast({
            title: "Signed in successfully",
            description: `Welcome ${newSession?.user?.email}`,
          });
        } else if (event === 'SIGNED_OUT') {
          toast({
            title: "Signed out",
            description: "You have been signed out",
          });
        } else if (event === 'TOKEN_REFRESHED') {
          console.log("Token refreshed successfully");
        } else if (event === 'USER_UPDATED') {
          console.log("User data updated");
        }
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );
    
    // Then check for existing session
    const getInitialSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        console.log("Initial session check:", currentSession?.user?.id);
        if (error) {
          console.error("Error getting session:", error);
        }
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      } catch (error) {
        console.error("Exception during initial session check:", error);
        setLoading(false);
      }
      
      // Run a diagnostic check
      checkAuthState();
    };
    
    getInitialSession();
    
    return () => subscription.unsubscribe();
  }, []);
  
  const signOut = async () => {
    try {
      console.log("Signing out...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Exception during sign out:", error);
      toast({
        title: "Sign out failed",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const refreshSession = async () => {
    try {
      console.log("Manually refreshing session...");
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("Session refresh error:", error);
        toast({
          title: "Session refresh failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log("Session refreshed:", data.session?.user?.id);
        setSession(data.session);
        setUser(data.session?.user ?? null);
        
        if (data.session) {
          toast({
            title: "Session refreshed",
            description: "Your session has been refreshed",
          });
        }
      }
    } catch (error: any) {
      console.error("Error during manual session refresh:", error);
      toast({
        title: "Session refresh failed",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  const authDebugInfo = () => {
    return {
      sessionExists: !!session,
      userExists: !!user,
      userId: user?.id,
      userEmail: user?.email,
      loading,
    };
  };
  
  // For debugging
  useEffect(() => {
    console.log("AuthProvider state:", { 
      user: user?.id, 
      email: user?.email,
      session: !!session, 
      loading 
    });
  }, [user, session, loading]);
  
  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      loading, 
      signOut, 
      refreshSession,
      authDebugInfo 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
