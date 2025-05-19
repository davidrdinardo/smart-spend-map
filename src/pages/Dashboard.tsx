import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { TransactionTable } from '@/components/TransactionTable';
import { BarChartDisplay } from '@/components/BarChartDisplay';
import { CategoryBreakdownChart } from '@/components/CategoryBreakdownChart';
import { UploadWidget } from '@/components/UploadWidget';
import { BatchUploader } from '@/components/BatchUploader';
import { UploadDropdown } from '@/components/upload/UploadDropdown';
import { useToast } from '@/hooks/use-toast';
import { Transaction, MonthSummary, CategorySummary, MonthData } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
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
  const [availableMonths, setAvailableMonths] = useState<{key: string, label: string}[]>([]);
  
  // Check for authentication
  useEffect(() => {
    console.log("Dashboard checking auth:", { user, isLoading: loading });
    
    if (!loading && !user) {
      console.log("No user found in Dashboard, redirecting to auth page");
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);
  
  // Fetch available months
  useEffect(() => {
    if (user) {
      fetchAvailableMonths();
    }
  }, [user]);
  
  // Fetch data for selected month
  useEffect(() => {
    if (selectedMonth && user) {
      fetchMonthData(selectedMonth);
    }
  }, [selectedMonth, user]);
  
  const fetchAvailableMonths = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('month_key')
        .eq('user_id', user.id)
        .order('month_key', { ascending: false });
        
      if (error) throw error;
      
      // Get distinct month keys
      const uniqueMonthKeys = Array.from(new Set(data.map(item => item.month_key)));
      
      console.log("Available month keys:", uniqueMonthKeys);
      
      if (uniqueMonthKeys.length === 0) {
        // No data yet, just use current month
        setAvailableMonths([{
          key: format(new Date(), 'yyyy-MM'),
          label: format(new Date(), 'MMMM yyyy')
        }]);
        return;
      }
      
      // Format the month keys for display
      const months = uniqueMonthKeys.map(month_key => {
        const [year, month] = month_key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          key: month_key,
          label: format(date, 'MMMM yyyy')
        };
      });
      
      setAvailableMonths(months);
      
      // If we have months, select the most recent one
      if (months.length > 0) {
        setSelectedMonth(months[0].key);
      }
    } catch (error: any) {
      toast({
        title: "Error loading months",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  const fetchMonthData = async (monthKey: string) => {
    if (!user) return;
    
    setIsLoading(true);
    console.log("Fetching data for month:", monthKey);
    
    try {
      // Fetch transactions for the selected month
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_key', monthKey)
        .order('date', { ascending: false });
        
      if (transactionError) throw transactionError;
      
      console.log("Fetched transactions:", transactionData?.length || 0, transactionData);
      setTransactions(transactionData || []);
      
      // Calculate summary for the month
      let totalIncome = 0;
      let totalExpenses = 0;
      
      const categoryAmounts: Record<string, number> = {};
      
      transactionData?.forEach(tx => {
        if (tx.type === 'income') {
          totalIncome += Number(tx.amount);
        } else {
          totalExpenses += Number(tx.amount);
          
          // Aggregate expenses by category
          if (!categoryAmounts[tx.category]) {
            categoryAmounts[tx.category] = 0;
          }
          categoryAmounts[tx.category] += Number(tx.amount);
        }
      });
      
      console.log("Summary calculation:", {totalIncome, totalExpenses});
      
      // Set month summary
      setMonthSummary({
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses
      });
      
      // Calculate categories for pie chart
      const totalExpenseAmount = Object.values(categoryAmounts).reduce((sum, amount) => sum + amount, 0);
      
      const categoryItems: CategorySummary[] = Object.entries(categoryAmounts).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenseAmount > 0 ? (amount / totalExpenseAmount) * 100 : 0
      }));
      
      console.log("Category data:", categoryItems);
      setCategoryData(categoryItems);
      
      // Fetch monthly aggregated data for the bar chart
      const { data: monthlyRaw, error: monthlyError } = await supabase
        .from('transactions')
        .select('month_key, amount, type')
        .eq('user_id', user.id)
        .order('month_key', { ascending: true });
        
      if (monthlyError) throw monthlyError;
      
      // Aggregate monthly data
      const monthlyAgg: Record<string, { income: number, expenses: number }> = {};
      
      monthlyRaw?.forEach(item => {
        if (!monthlyAgg[item.month_key]) {
          monthlyAgg[item.month_key] = { income: 0, expenses: 0 };
        }
        
        if (item.type === 'income') {
          monthlyAgg[item.month_key].income += Number(item.amount);
        } else {
          monthlyAgg[item.month_key].expenses += Number(item.amount);
        }
      });
      
      // Convert to array for the chart
      const monthlyItems: MonthData[] = Object.entries(monthlyAgg).map(([month, values]) => ({
        month_key: month,
        net: values.income - values.expenses
      }));
      
      console.log("Monthly data:", monthlyItems);
      setMonthlyData(monthlyItems);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUploadComplete = () => {
    setShowUpload(false);
    setShowBatchUpload(false);
    toast({
      title: "Upload successful!",
      description: "Your files have been processed successfully.",
    });
    // Refresh data
    fetchAvailableMonths();
    fetchMonthData(selectedMonth);
  };
  
  const handleUpdateCategory = async (transactionId: string, newCategory: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category: newCategory })
        .eq('id', transactionId)
        .eq('user_id', user!.id);
        
      if (error) throw error;
      
      toast({
        title: "Category updated",
        description: `Transaction category changed to ${newCategory}.`,
      });
      
      // Refresh data
      fetchMonthData(selectedMonth);
    } catch (error: any) {
      toast({
        title: "Error updating category",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleClearData = async () => {
    if (!user) return;
    
    try {
      setIsDeleting(true);
      
      // Delete all transactions for the current user
      const { error: transactionError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);
        
      if (transactionError) throw transactionError;
      
      // Delete all uploads for the current user
      const { error: uploadsError } = await supabase
        .from('uploads')
        .delete()
        .eq('user_id', user.id);
      
      if (uploadsError) throw uploadsError;
      
      toast({
        title: "Data cleared",
        description: "All your transaction data has been removed. You can now upload new statements.",
      });
      
      // Reset the states
      setTransactions([]);
      setCategoryData([]);
      setMonthlyData([]);
      setMonthSummary({
        income: 0,
        expenses: 0,
        net: 0
      });
      
      // Refresh available months
      fetchAvailableMonths();
    } catch (error: any) {
      toast({
        title: "Error clearing data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-gray-600">Please wait while we load your financial dashboard.</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">You need to be logged in to view this page.</p>
          <Button onClick={() => navigate('/auth')} className="bg-income hover:bg-income-dark">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showBatchUpload ? (
        <BatchUploader 
          onComplete={handleUploadComplete} 
          onCancel={() => setShowBatchUpload(false)} 
          startDate={new Date(2025, 0, 1)} // January 1, 2025
          endDate={new Date()} // Current date
        />
      ) : showUpload ? (
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
              
              <UploadDropdown
                onSingleUpload={() => setShowUpload(true)}
                onBatchUpload={() => setShowBatchUpload(true)}
              />
              
              <Button 
                variant="destructive" 
                onClick={handleClearData}
                disabled={isDeleting}
              >
                {isDeleting ? "Clearing..." : "Clear Data"}
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
                  ${monthSummary.income.toFixed(2)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Expenses</CardDescription>
                <CardTitle className="text-2xl text-expense-dark">
                  ${monthSummary.expenses.toFixed(2)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Net Balance</CardDescription>
                <CardTitle className={`text-2xl ${monthSummary.net >= 0 ? 'text-income-dark' : 'text-expense-dark'}`}>
                  ${monthSummary.net.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Upload statements to see your financial summary.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
          
          {/* Expense Breakdown Section */}
          <div className="mb-8">
            <CategoryBreakdownChart categoryData={categoryData} />
          </div>
          
          {/* Charts Section - REMOVED the Expenses by Category chart */}
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Net Balance</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <BarChartDisplay data={monthlyData} />
              </CardContent>
            </Card>
          </div>
          
          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                {isLoading ? "Loading transactions..." : 
                  transactions.length === 0 ? "Upload statements to see your transactions" : 
                  `${transactions.length} transactions found`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionTable 
                transactions={transactions} 
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
