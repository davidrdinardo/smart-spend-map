
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/providers/AuthProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  
  // Use effect to track when auth check is complete
  useEffect(() => {
    if (!loading) {
      setAuthChecked(true);
    }
  }, [loading]);
  
  // Only proceed once we've done the initial auth check
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  // If auth check is done and no user, redirect
  if (authChecked && !user) {
    console.log("No user found, redirecting to auth page");
    return <Navigate to="/auth" replace />;
  }
  
  // Show children if authenticated
  return <>{children}</>;
};

// Public route - redirects to dashboard if already logged in
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  
  // Use effect to track when auth check is complete
  useEffect(() => {
    if (!loading) {
      setAuthChecked(true);
    }
  }, [loading]);
  
  // Show loading indicator during initial load
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  // Redirect to dashboard if already logged in
  if (authChecked && user) {
    console.log("User found, redirecting to dashboard");
    return <Navigate to="/dashboard" replace />;
  }
  
  // Show login page if not logged in
  return <>{children}</>;
};

// The actual app with routing
const AppRoutes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route 
            path="/auth" 
            element={
              <PublicRoute>
                <Auth />
              </PublicRoute>
            } 
          />
          <Route path="/" element={<Index />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppRoutes />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
