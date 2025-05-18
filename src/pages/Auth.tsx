
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthProvider';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const { user } = useAuth();
  
  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: ""
    },
  });

  const handleAuth = async (data: z.infer<typeof formSchema>) => {
    setLoading(true);
    const { email, password } = data;
    
    try {
      console.log("Auth attempt with email:", email);
      setDebugInfo({ email, timestamp: new Date().toISOString() });
      
      if (isSignUp) {
        // Sign up logic
        console.log("Attempting sign up...");
        const { data: signupData, error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) {
          console.error("Signup error:", error);
          setDebugInfo(prev => ({...prev, error: { type: "signup", message: error.message, code: error.code }}));
          throw error;
        }
        
        if (signupData?.user) {
          console.log("Signup successful, user:", signupData.user.id);
          setDebugInfo(prev => ({...prev, success: { userId: signupData.user?.id }}));
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
          setDebugInfo(prev => ({...prev, error: { type: "login", message: error.message, code: error.code }}));
          throw error;
        }
        
        if (signinData?.user) {
          console.log("Login successful, user:", signinData.user.id);
          console.log("Session:", signinData.session);
          setDebugInfo(prev => ({...prev, success: { userId: signinData.user?.id, session: !!signinData.session }}));
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast({
        title: "Authentication failed",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
                </button>
              </div>
              <div className="text-center mt-2">
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:underline"
                  onClick={() => setShowDebugDialog(true)}
                >
                  Debug Info
                </button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authentication Debug Info</DialogTitle>
            <DialogDescription>
              Technical details to help diagnose auth issues.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 bg-gray-50 p-4 rounded overflow-auto max-h-[300px]">
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDebugDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
