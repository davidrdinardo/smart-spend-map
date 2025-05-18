
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { TransactionTable } from '@/components/TransactionTable';
import { PieChartDisplay } from '@/components/PieChartDisplay';
import { BarChartDisplay } from '@/components/BarChartDisplay';
import { UploadWidget } from '@/components/UploadWidget';
import { useToast } from '@/components/ui/use-toast';
import { Transaction, MonthSummary, CategorySummary, MonthData } from '@/types';

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  
  // Data states
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [monthSummary, setMonthSummary] = useState<MonthSummary>({
    income: 0,
    expenses: 0,
    net: 0
  });
  const [categoryData, setCategoryData] = useState<CategorySummary[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Mock months for the selector
  const availableMonths = [
    { key: format(new Date(), 'yyyy-MM'), label: format(new Date(), 'MMMM yyyy') }
  ];
  
  useEffect(() => {
    // This would be replaced with actual Supabase auth check
    const timeoutId = setTimeout(() => {
      setIsAuthenticated(true);
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  useEffect(() => {
    // This would be replaced with real data fetching from Supabase
    if (selectedMonth) {
      fetchMonthData(selectedMonth);
    }
  }, [selectedMonth]);
  
  const fetchMonthData = async (monthKey: string) => {
    setIsLoading(true);
    
    try {
      // Simulate an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Empty data for blank state
      setTransactions([]);
      
      setMonthSummary({
        income: 0,
        expenses: 0,
        net: 0
      });
      
      setCategoryData([]);
      setMonthlyData([]);
      
    } catch (error) {
      toast({
        title: "Error loading data",
        description: "There was a problem loading your financial data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUploadComplete = () => {
    setShowUpload(false);
    toast({
      title: "Upload successful!",
      description: "Your files have been processed successfully.",
    });
    // Refresh data
    fetchMonthData(selectedMonth);
  };
  
  const handleUpdateCategory = async (transactionId: string, newCategory: string) => {
    // This would update the category in Supabase
    toast({
      title: "Category updated",
      description: `Transaction category changed to ${newCategory}.`,
    });
  };
  
  const handleSignOut = () => {
    // This would be replaced with actual Supabase sign out
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate('/');
  };
  
  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-gray-600">Please wait while we load your financial dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showUpload ? (
        <UploadWidget onComplete={handleUploadComplete} onCancel={() => setShowUpload(false)} />
      ) : (
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">
                <span className="text-income-dark">Money</span>{" "}
                <span className="text-expense-dark">Map</span>
              </h1>
              <p className="text-gray-600">Your financial dashboard</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mt-4 md:mt-0">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(month => (
                    <SelectItem key={month.key} value={month.key}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => setShowUpload(true)}
                className="bg-income hover:bg-income-dark"
              >
                Upload Statements
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Income</CardDescription>
                <CardTitle className="text-2xl text-income-dark">
                  $0.00
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Expenses</CardDescription>
                <CardTitle className="text-2xl text-expense-dark">
                  $0.00
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Net Balance</CardDescription>
                <CardTitle className="text-2xl text-income-dark">
                  $0.00
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  Upload statements to see your financial summary.
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <PieChartDisplay data={[]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Net Balance</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <BarChartDisplay data={[]} />
              </CardContent>
            </Card>
          </div>
          
          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                Upload statements to see your transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionTable 
                transactions={[]} 
                onUpdateCategory={handleUpdateCategory} 
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
