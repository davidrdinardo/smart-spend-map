
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, checkAuthState, refreshSessionIfNeeded } from '@/integrations/supabase/client';
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
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    console.log("AuthProvider: Setting up auth state listener");
    let isMounted = true;
    
    // Function to handle session update
    const handleSessionUpdate = (newSession: Session | null) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    };
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log("Auth state changed:", event, newSession?.user?.id);
        
        if (!isMounted) return;
        
        if (event === 'SIGNED_IN') {
          handleSessionUpdate(newSession);
          toast({
            title: "Signed in successfully",
            description: `Welcome ${newSession?.user?.email}`,
          });
        } else if (event === 'SIGNED_OUT') {
          handleSessionUpdate(null);
          toast({
            title: "Signed out",
            description: "You have been signed out",
          });
        } else if (event === 'TOKEN_REFRESHED') {
          console.log("Token refreshed successfully");
          handleSessionUpdate(newSession);
        } else if (event === 'USER_UPDATED') {
          console.log("User data updated");
          handleSessionUpdate(newSession);
        }
      }
    );
    
    // Then check for existing session
    const getInitialSession = async () => {
      try {
        if (!isMounted) return;
        
        // Check for session and refresh if needed
        const { data, error } = await refreshSessionIfNeeded();
        
        if (error) {
          console.error("Error getting/refreshing session:", error);
        }
        
        console.log("Initial session check:", data.session?.user?.id);
        
        if (isMounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setLoading(false);
          setInitialized(true);
        }
      } catch (error) {
        console.error("Exception during initial session check:", error);
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };
    
    getInitialSession();
    
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);
  
  const signOut = async () => {
    try {
      console.log("Signing out...");
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Explicitly clear state on successful signout
        setSession(null);
        setUser(null);
      }
    } catch (error: any) {
      console.error("Exception during sign out:", error);
      toast({
        title: "Sign out failed",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
      initialized
    };
  };
  
  // For debugging
  useEffect(() => {
    console.log("AuthProvider state:", { 
      user: user?.id, 
      email: user?.email,
      session: !!session, 
      loading,
      initialized
    });
  }, [user, session, loading, initialized]);
  
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
