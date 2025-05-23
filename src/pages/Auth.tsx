import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase, checkAuthState, debugSupabaseSession, clearSupabaseSession } from '@/integrations/supabase/client';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Info, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading, refreshSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Debug logging
  useEffect(() => {
    console.log("Auth page state:", {
      user: !!user,
      authLoading,
      path: location.pathname
    });
  }, [user, authLoading, location]);

  // Check auth state when component mounts for debugging
  useEffect(() => {
    const runAuthCheck = async () => {
      try {
        const stateInfo = await checkAuthState();
        console.log("Auth page initial state check:", stateInfo);
        setDebugInfo(prev => ({
          ...prev, 
          initialCheck: {
            timestamp: new Date().toISOString(),
            hasSession: !!stateInfo.session,
            sessionExpiresAt: stateInfo.session?.expires_at
          }
        }));
      } catch (error) {
        console.error("Error during initial auth check:", error);
      }
    };
    
    runAuthCheck();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: ""
    },
  });

  const handleAuth = async (data: z.infer<typeof formSchema>) => {
    if (loading) return; // Prevent multiple submissions
    
    setLoading(true);
    setAuthError(null);
    const { email, password } = data;
    
    try {
      console.log("Auth attempt with email:", email);
      setDebugInfo({ 
        email, 
        timestamp: new Date().toISOString(),
        localStorage: debugSupabaseSession()
      });
      
      if (isSignUp) {
        // Sign up logic
        console.log("Attempting sign up...");
        const { data: signupData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        });
        
        if (error) {
          console.error("Signup error:", error);
          setAuthError(error.message);
          setDebugInfo(prev => ({
            ...prev, 
            error: { 
              type: "signup", 
              message: error.message, 
              code: error.code 
            }
          }));
          throw error;
        }
        
        if (signupData?.user) {
          console.log("Signup successful, user:", signupData.user.id);
          setDebugInfo(prev => ({
            ...prev, 
            success: { 
              userId: signupData.user?.id,
              sessionExists: !!signupData.session
            }
          }));
          
          toast({
            title: "Sign up successful!",
            description: "Please check your email for the confirmation link.",
          });
        }
      } else {
        // Sign in logic
        console.log("Attempting sign in...");
        const { data: signinData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.error("Login error:", error);
          setAuthError(error.message);
          setDebugInfo(prev => ({
            ...prev, 
            error: { 
              type: "login", 
              message: error.message, 
              code: error.code 
            }
          }));
          throw error;
        }
        
        if (signinData?.user) {
          console.log("Login successful, user:", signinData.user.id);
          console.log("Session:", signinData.session);
          setDebugInfo(prev => ({
            ...prev, 
            success: { 
              userId: signinData.user?.id, 
              session: !!signinData.session,
              sessionExpires: signinData.session?.expires_at
            }
          }));
          
          toast({
            title: "Sign in successful",
            description: "Welcome back!",
          });
          
          // Let the auth state change handle navigation
          // We'll explicitly navigate after a brief delay to ensure state is updated
          if (signinData.session) {
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1000);
          }
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError(error?.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDebugClick = () => {
    // Update debug info with current state
    const getDebugInfo = async () => {
      try {
        const authState = await checkAuthState();
        setDebugInfo(prev => ({
          ...prev,
          currentState: {
            timestamp: new Date().toISOString(),
            localStorage: debugSupabaseSession(),
            authState,
            userId: user?.id,
            isUserLoading: authLoading,
            currentPath: location.pathname
          }
        }));
        setShowDebugDialog(true);
      } catch (error) {
        console.error("Error getting debug info:", error);
      }
    };
    
    getDebugInfo();
  };

  const handleTestRefresh = async () => {
    try {
      // Use AuthProvider's refreshSession
      await refreshSession();
      
      // Update debug info
      const authState = await checkAuthState();
      setDebugInfo(prev => ({
        ...prev,
        refreshAttempt: {
          timestamp: new Date().toISOString(),
          authState
        }
      }));
      
      toast({
        title: "Session refresh attempt",
        description: "Session refresh attempted via AuthProvider",
      });
    } catch (error: any) {
      console.error("Test refresh failed:", error);
      setAuthError(error?.message || "An unexpected error occurred");
    }
  };

  const handleClearSession = async () => {
    try {
      // Clear session from storage
      const cleared = clearSupabaseSession();
      
      if (cleared) {
        toast({
          title: "Session cleared",
          description: "Local session data has been removed",
        });
        
        // Force page reload to reset state
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error: any) {
      console.error("Failed to clear session:", error);
      setAuthError(error?.message || "An unexpected error occurred");
    }
  };

  // Show a minimal loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2">Authenticating...</h2>
          <p className="text-gray-600">Please wait a moment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            <span className="text-income-dark">Money</span>{" "}
            <span className="text-expense-dark">Map</span>
          </CardTitle>
          <CardDescription>
            {isSignUp ? 'Create an account to get started' : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentication Error</AlertTitle>
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAuth)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="your@email.com"
                        type="email"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete={isSignUp ? "new-password" : "current-password"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-income hover:bg-income-dark"
                disabled={loading}
              >
                {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </Button>
              
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:underline"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError(null);
                  }}
                >
                  {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
                </button>
              </div>
              
              <div className="flex justify-center gap-4 mt-2">
                <button
                  type="button"
                  className="text-xs text-gray-400 flex items-center gap-1 hover:underline"
                  onClick={handleDebugClick}
                >
                  <Info size={12} />
                  Debug Info
                </button>
                <button
                  type="button"
                  className="text-xs text-gray-400 flex items-center gap-1 hover:underline"
                  onClick={handleTestRefresh}
                >
                  <RefreshCw size={12} />
                  Test Refresh
                </button>
                <button
                  type="button"
                  className="text-xs text-gray-400 flex items-center gap-1 hover:underline"
                  onClick={handleClearSession}
                >
                  <AlertCircle size={12} />
                  Clear Session
                </button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Authentication Debug Info</DialogTitle>
            <DialogDescription>
              Technical details to help diagnose auth issues.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 bg-gray-50 p-4 rounded overflow-auto max-h-[500px]">
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
          <DialogFooter className="flex justify-between">
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  const authState = await checkAuthState();
                  setDebugInfo(prev => ({
                    ...prev,
                    manualCheck: {
                      timestamp: new Date().toISOString(),
                      authState
                    }
                  }));
                } catch (error) {
                  console.error("Error refreshing debug info:", error);
                }
              }}
            >
              Refresh Info
            </Button>
            <Button onClick={() => setShowDebugDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
