
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { TransactionTable } from '@/components/TransactionTable';
import { BarChartDisplay } from '@/components/BarChartDisplay';
import { UploadWidget } from '@/components/UploadWidget';
import { UploadDropdown } from '@/components/upload/UploadDropdown';
import { NetBalanceIndicator } from '@/components/dashboard/NetBalanceIndicator';
import { useToast } from '@/hooks/use-toast';
import { Transaction, MonthSummary, CategorySummary, MonthData } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Download } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
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
  const [availableMonths, setAvailableMonths] = useState<Array<{key: string, label: string}>>([]);
  
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
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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
      
      // Apply type casting to ensure transactionData conforms to Transaction[]
      const typedTransactions: Transaction[] = transactionData?.map(tx => ({
        ...tx,
        type: tx.type === 'income' ? 'income' : 'expense' // Ensure type is either 'income' or 'expense'
      })) || [];
      
      setTransactions(typedTransactions);
      
      // Calculate summary for the month
      let totalIncome = 0;
      let totalExpenses = 0;
      
      // Create separate maps for expenses and income
      const expenseCategoryAmounts: Record<string, number> = {};
      
      typedTransactions.forEach(tx => {
        const amount = Number(tx.amount);
        
        if (tx.type === 'income') {
          totalIncome += amount;
        } else {
          totalExpenses += amount;
          
          // Aggregate expenses by category
          const category = tx.category || 'Other';
          if (!expenseCategoryAmounts[category]) {
            expenseCategoryAmounts[category] = 0;
          }
          expenseCategoryAmounts[category] += amount;
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
      const totalExpenseAmount = Object.values(expenseCategoryAmounts).reduce((sum, amount) => sum + amount, 0);
      
      // Map expense category data for the chart (ensuring we exclude any "Income" categories)
      const categoryItems: CategorySummary[] = Object.entries(expenseCategoryAmounts)
        .filter(([category]) => category.toLowerCase() !== 'income')
        .map(([category, amount]) => ({
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
    toast({
      title: "Statement uploaded successfully!",
      description: "Your transactions have been processed and categorized.",
    });
    
    // Force refresh data with some delay to ensure processing is complete
    setTimeout(() => {
      // First refresh available months to capture any new months
      fetchAvailableMonths().then(() => {
        // Then refresh the current month data or the most recent if available
        if (availableMonths.length > 0) {
          fetchMonthData(availableMonths[0].key);
        } else {
          fetchMonthData(selectedMonth);
        }
      });
    }, 1000);
  };
  
  const handleUpdateCategory = async (transactionId: string, newCategory: string, newType?: string) => {
    try {
      const updateData: {category: string, type?: string} = { category: newCategory };
      
      // If newType is provided, include it in the update
      if (newType) {
        updateData.type = newType;
      }
      
      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId)
        .eq('user_id', user!.id);
        
      if (error) throw error;
      
      let toastMessage = `Transaction category changed to ${newCategory}.`;
      if (newType) {
        toastMessage += ` Transaction type updated to ${newType}.`;
      }
      
      toast({
        title: "Category updated",
        description: toastMessage,
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
  
  // New function to handle CSV download
  const handleDownloadCSV = async () => {
    if (!user || !selectedMonth) return;
    
    setIsDownloading(true);
    
    try {
      // Fetch all transactions for the selected month
      const { data, error } = await supabase
        .from('transactions')
        .select('date, description, amount, type, category')
        .eq('user_id', user.id)
        .eq('month_key', selectedMonth)
        .order('date', { ascending: true });
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast({
          title: "No data to download",
          description: "There are no transactions for the selected month.",
          variant: "destructive",
        });
        return;
      }
      
      // Convert data to CSV format
      const headers = ['date', 'description', 'amount', 'type', 'category'];
      
      // Create CSV content with headers
      let csvContent = headers.join(',') + '\n';
      
      // Add data rows
      data.forEach(row => {
        const rowData = headers.map(header => {
          const value = row[header as keyof typeof row];
          // Handle strings that might contain commas by wrapping in quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += rowData.join(',') + '\n';
      });
      
      // Create a blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `smart-spend-${selectedMonth}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "CSV downloaded ✅",
        description: `Exported ${data.length} transactions for ${selectedMonth}.`,
      });
    } catch (error: any) {
      toast({
        title: "Couldn't generate CSV—please try again.",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
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

  const hasTransactions = transactions.length > 0;
  const hasExpenseData = categoryData.length > 0;

  console.log("Rendering dashboard with:", { 
    hasTransactions, 
    hasExpenseData, 
    categoryDataLength: categoryData.length,
    categoryData: categoryData
  });

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
              <div className="flex items-center gap-2">
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
                
                {/* Download CSV Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handleDownloadCSV}
                        isLoading={isDownloading}
                        disabled={isDownloading || !hasTransactions}
                      >
                        {isDownloading ? (
                          <span className="animate-spin">◌</span>
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download CSV for this month</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <UploadDropdown
                onSingleUpload={() => setShowUpload(true)}
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
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : !hasTransactions ? (
                  <p className="text-sm text-gray-500">No income data available</p>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Expenses</CardDescription>
                <CardTitle className="text-2xl text-expense-dark">
                  ${monthSummary.expenses.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : !hasTransactions ? (
                  <p className="text-sm text-gray-500">No expense data available</p>
                ) : null}
              </CardContent>
            </Card>
            
            {/* Use the new NetBalanceIndicator component */}
            <NetBalanceIndicator 
              net={monthSummary.net}
              loading={isLoading}
              transactionsExist={hasTransactions}
            />
          </div>
          
          {/* Removed CategoryBreakdownChart Section */}
          
          {/* Charts Section */}
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
            <CardContent className="overflow-x-auto">
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
