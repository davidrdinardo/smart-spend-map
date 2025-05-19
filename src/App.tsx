
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/providers/AuthProvider";
import { ReactNode, useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import { useAuth } from "@/hooks/useAuth"; // Import from the correct location

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected route wrapper component
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only redirect if we've finished loading and there's no user
    if (!loading && !user) {
      console.log("Protected route: No user found, redirecting to /auth");
      navigate('/auth', { replace: true, state: { from: location.pathname } });
    }
  }, [user, loading, navigate, location.pathname]);

  // Show simple loading if we're still determining auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Only render children if we have a user
  return user ? <>{children}</> : null;
};

// Public route - redirects to dashboard if already logged in
const PublicRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Check if we have state from a previous redirect
    const state = location.state as { from?: string } | undefined;
    const destination = state?.from || '/dashboard';
    
    // Only redirect if we've finished loading and there's a user
    if (!loading && user && location.pathname === '/auth') {
      console.log("Public route: User found, redirecting to dashboard");
      navigate(destination, { replace: true });
    }
  }, [user, loading, navigate, location]);
  
  // Show simple loading if we're still determining auth state
  if (loading && location.pathname === '/auth') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// The AppRoutes component which uses the auth context
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={
        <PublicRoute>
          <Auth />
        </PublicRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// The main App component that sets up providers
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
