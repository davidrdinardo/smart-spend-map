
import { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  const mountedRef = useRef(false);
  
  useEffect(() => {
    // Set mount state
    mountedRef.current = true;
    
    console.log("AuthProvider: Setting up auth state listener");
    
    // Function to handle session update - synchronous to avoid loops
    const handleSessionUpdate = (newSession: Session | null) => {
      if (!mountedRef.current) return;
      
      console.log("Updating auth state:", { 
        hasUser: !!newSession?.user,
        userEmail: newSession?.user?.email
      });
      
      setSession(newSession);
      setUser(newSession?.user ?? null);
    };
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log("Auth state changed:", event, newSession?.user?.id);
        
        if (!mountedRef.current) return;
        
        if (event === 'SIGNED_IN') {
          handleSessionUpdate(newSession);
          // Don't show toast during initial loading
          if (initialized) {
            toast({
              title: "Signed in successfully",
              description: `Welcome ${newSession?.user?.email}`,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          handleSessionUpdate(null);
          // Only show toast if we were previously initialized
          if (initialized) {
            toast({
              title: "Signed out",
              description: "You have been signed out",
            });
          }
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
        if (!mountedRef.current) return;
        
        console.log("Checking for initial session...");
        
        // Check for session and refresh if needed
        const { data, error } = await refreshSessionIfNeeded();
        
        if (error) {
          console.error("Error getting/refreshing session:", error);
        }
        
        if (data.session) {
          console.log("Initial session found:", data.session.user?.id);
          handleSessionUpdate(data.session);
        } else {
          console.log("No session found during initial check");
        }
        
        // Always mark as not loading once we've checked
        if (mountedRef.current) {
          setLoading(false);
          setInitialized(true);
        }
      } catch (error) {
        console.error("Exception during initial session check:", error);
        if (mountedRef.current) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };
    
    // Run the initial session check
    getInitialSession();
    
    return () => {
      mountedRef.current = false;
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
        return { data, error };
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
        return { data, error: null };
      }
    } catch (error: any) {
      console.error("Error during manual session refresh:", error);
      toast({
        title: "Session refresh failed",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return { data: null, error };
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
