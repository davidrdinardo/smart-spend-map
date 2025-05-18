
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Check for authentication status
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This would be replaced with Supabase auth check after integration
    // For now, we'll just simulate loading
    const checkAuth = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(checkAuth);
  }, []);

  const handleGetStarted = () => {
    // For now, navigate to auth page for signup/login
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="flex flex-col items-center justify-center text-center py-16">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="text-income-dark">Money</span>{" "}
            <span className="text-expense-dark">Map</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl">
            Track where your money goes each month. Upload your bank statements and get instant insights into your spending habits.
          </p>
          <Button 
            className="text-lg bg-income-dark hover:bg-income-dark/90 text-white px-8 py-6 rounded-lg shadow-lg transition-all duration-300"
            size="lg"
            onClick={handleGetStarted}
          >
            Get Started — It's Free
          </Button>
        </div>

        {/* Feature Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-16">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-income-light/20 text-income-dark mb-4 mx-auto">
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <path d="M14 2v6h6"></path>
                <path d="M16 13H8"></path>
                <path d="M16 17H8"></path>
                <path d="M10 9H8"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-center">Easy Upload</h3>
            <p className="text-gray-600 text-center">Simply drag and drop your bank statements and credit card bills.</p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-income-light/20 text-income-dark mb-4 mx-auto">
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12" y2="16"></line>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-center">Smart Categorization</h3>
            <p className="text-gray-600 text-center">AI automatically categorizes your transactions for better insights.</p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-income-light/20 text-income-dark mb-4 mx-auto">
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-center">Visual Dashboard</h3>
            <p className="text-gray-600 text-center">See beautiful charts and insights about your spending patterns.</p>
          </div>
        </div>

        {/* CTA section */}
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-3xl font-bold mb-4">Ready to take control of your finances?</h2>
          <Button 
            className="text-lg bg-income-dark hover:bg-income-dark/90 text-white px-8 py-6 rounded-lg shadow-lg transition-all duration-300"
            size="lg"
            onClick={handleGetStarted}
          >
            Start Tracking Now
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600">
            © {new Date().getFullYear()} Money Map. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
