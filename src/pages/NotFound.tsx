
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex items-center justify-center">
          <h1 className="text-6xl font-bold">
            <span className="text-income-dark">4</span>
            <span className="text-expense-dark">0</span>
            <span className="text-income-dark">4</span>
          </h1>
        </div>
        
        <h2 className="text-2xl font-bold">Page Not Found</h2>
        
        <p className="text-gray-600">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        
        <div className="pt-4">
          <Button onClick={() => navigate('/')} className="bg-income-dark hover:bg-income-dark/90">
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
