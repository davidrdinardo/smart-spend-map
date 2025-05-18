
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
    { key: '2023-09', label: 'September 2023' },
    { key: '2023-10', label: 'October 2023' },
    { key: '2023-11', label: 'November 2023' },
    { key: '2023-12', label: 'December 2023' },
    { key: '2024-01', label: 'January 2024' },
    { key: '2024-02', label: 'February 2024' },
    { key: '2024-03', label: 'March 2024' },
    { key: '2024-04', label: 'April 2024' },
    { key: '2024-05', label: 'May 2024' },
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
    // For now, we'll generate mock data based on the selected month
    if (selectedMonth) {
      fetchMonthData(selectedMonth);
    }
  }, [selectedMonth]);
  
  const fetchMonthData = async (monthKey: string) => {
    setIsLoading(true);
    
    try {
      // Simulate an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate mock data
      const mockTransactions = generateMockTransactionsForMonth(monthKey, 20);
      setTransactions(mockTransactions);
      
      // Calculate summary
      let totalIncome = 0;
      let totalExpense = 0;
      
      mockTransactions.forEach(tx => {
        if (tx.type === 'income') {
          totalIncome += tx.amount;
        } else {
          totalExpense += Math.abs(tx.amount);
        }
      });
      
      setMonthSummary({
        income: totalIncome,
        expenses: totalExpense,
        net: totalIncome - totalExpense
      });
      
      // Generate category data
      const categories: Record<string, number> = {};
      mockTransactions.filter(tx => tx.type === 'expense').forEach(tx => {
        if (!categories[tx.category]) {
          categories[tx.category] = 0;
        }
        categories[tx.category] += Math.abs(tx.amount);
      });
      
      const totalExpenseAmount = Object.values(categories).reduce((sum, amount) => sum + amount, 0);
      
      const categoryData: CategorySummary[] = Object.entries(categories).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenseAmount ? (amount / totalExpenseAmount) * 100 : 0
      }));
      
      setCategoryData(categoryData);
      
      // Generate monthly data (for last 12 months)
      const monthlyDataArray: MonthData[] = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = format(date, 'yyyy-MM');
        
        // Generate a random net amount between -2000 and 3000
        const net = Math.floor(Math.random() * 5000) - 2000;
        
        monthlyDataArray.push({
          month_key: monthKey,
          net
        });
      }
      
      setMonthlyData(monthlyDataArray);
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
  
  const generateMockTransactionsForMonth = (monthKey: string, count: number): Transaction[] => {
    const transactions: Transaction[] = [];
    const [year, month] = monthKey.split('-').map(Number);
    
    const categories = [
      "Housing", "Transportation", "Groceries", "Dining Out", "Utilities", 
      "Subscriptions", "Healthcare", "Insurance", "Entertainment", 
      "Travel", "Personal Care", "Gifts/Donations", "Savings/Investments", "Other"
    ];
    
    for (let i = 0; i < count; i++) {
      const isIncome = Math.random() > 0.7;
      const day = Math.floor(Math.random() * 28) + 1;
      const date = new Date(year, month - 1, day);
      
      transactions.push({
        id: `mock-${i}-${monthKey}`,
        user_id: 'mock-user',
        date: format(date, 'yyyy-MM-dd'),
        description: isIncome 
          ? ['Salary', 'Freelance Payment', 'Gift Received', 'Refund', 'Investment Return'][Math.floor(Math.random() * 5)]
          : ['Grocery Store', 'Coffee Shop', 'Gas Station', 'Online Shopping', 'Restaurant', 'Utility Payment'][Math.floor(Math.random() * 6)],
        amount: isIncome 
          ? Math.floor(Math.random() * 3000) + 500 
          : -(Math.floor(Math.random() * 200) + 10),
        type: isIncome ? 'income' : 'expense',
        category: isIncome ? 'Income' : categories[Math.floor(Math.random() * categories.length)],
        month_key: monthKey
      });
    }
    
    return transactions;
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
    // For now, we'll just update it locally
    setTransactions(prevTransactions => 
      prevTransactions.map(tx => 
        tx.id === transactionId ? { ...tx, category: newCategory } : tx
      )
    );
    
    // Also update the category summary
    const updatedTransaction = transactions.find(tx => tx.id === transactionId);
    if (updatedTransaction && updatedTransaction.type === 'expense') {
      // Recalculate category data
      const txAmount = Math.abs(updatedTransaction.amount);
      
      setCategoryData(prevData => {
        // Remove amount from old category
        const oldCategory = prevData.find(c => c.category === updatedTransaction.category);
        const updatedData = prevData.map(c => {
          if (c.category === updatedTransaction.category) {
            return {
              ...c,
              amount: c.amount - txAmount,
              percentage: ((c.amount - txAmount) / (monthSummary.expenses - txAmount)) * 100
            };
          }
          return {
            ...c,
            percentage: (c.amount / (monthSummary.expenses - txAmount)) * 100
          };
        }).filter(c => c.amount > 0);
        
        // Add amount to new category
        const newCategoryItem = updatedData.find(c => c.category === newCategory);
        if (newCategoryItem) {
          return updatedData.map(c => {
            if (c.category === newCategory) {
              return {
                ...c,
                amount: c.amount + txAmount,
                percentage: ((c.amount + txAmount) / monthSummary.expenses) * 100
              };
            }
            return {
              ...c,
              percentage: (c.amount / monthSummary.expenses) * 100
            };
          });
        } else {
          // Add new category
          return [
            ...updatedData,
            {
              category: newCategory,
              amount: txAmount,
              percentage: (txAmount / monthSummary.expenses) * 100
            }
          ];
        }
      });
    }
    
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
                  ${monthSummary.income.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Expenses</CardDescription>
                <CardTitle className="text-2xl text-expense-dark">
                  ${monthSummary.expenses.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Net Balance</CardDescription>
                <CardTitle className={`text-2xl ${monthSummary.net >= 0 ? 'text-income-dark' : 'text-expense-dark'}`}>
                  ${monthSummary.net.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthSummary.net < 0 ? (
                  <p className="text-sm text-expense-dark">
                    You spent ${Math.abs(monthSummary.net).toLocaleString()} more than you earned 🎯. Try trimming the top 3 categories.
                  </p>
                ) : (
                  <p className="text-sm text-income-dark">
                    Great job! You saved ${monthSummary.net.toLocaleString()} this month 🚀.
                  </p>
                )}
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
                <PieChartDisplay data={categoryData} />
              </CardContent>
            </Card>
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
                All transactions for {availableMonths.find(m => m.key === selectedMonth)?.label || selectedMonth}
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
