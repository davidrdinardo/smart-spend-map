
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase, checkAuthState, debugSupabaseSession } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthProvider';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const { user, refreshSession, authDebugInfo } = useAuth();
  
  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Check auth state when component mounts
  useEffect(() => {
    const runAuthCheck = async () => {
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
            emailRedirectTo: window.location.origin + '/dashboard'
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
          
          // Add a small delay to let supabase finish processing
          setTimeout(() => {
            toast({
              title: "Sign up successful!",
              description: "Please check your email for the confirmation link.",
            });
          }, 500);
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
          
          // Add a small delay to ensure session is fully processed
          setTimeout(() => {
            navigate('/dashboard');
          }, 500);
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
    setDebugInfo(prev => ({
      ...prev,
      currentState: {
        timestamp: new Date().toISOString(),
        localStorage: debugSupabaseSession(),
        authContext: authDebugInfo()
      }
    }));
    setShowDebugDialog(true);
  };

  const handleTestRefresh = async () => {
    try {
      await refreshSession();
      // Update debug info after refresh
      setDebugInfo(prev => ({
        ...prev,
        refreshAttempt: {
          timestamp: new Date().toISOString(),
          authContext: authDebugInfo()
        }
      }));
    } catch (error) {
      console.error("Test refresh failed:", error);
    }
  };

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
                  <AlertCircle size={12} />
                  Test Refresh
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
                const authState = await checkAuthState();
                setDebugInfo(prev => ({
                  ...prev,
                  manualCheck: {
                    timestamp: new Date().toISOString(),
                    authState
                  }
                }));
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
