
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChartDisplay } from '@/components/PieChartDisplay';
import { CategorySummary } from '@/types';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHeader,
  TableHead,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CategoryBreakdownProps {
  categoryData: CategorySummary[];
}

// Helper function to standardize category names
const standardizeCategory = (category: string): string => {
  // This ensures consistent category display regardless of how it's stored in the database
  return category
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim(); // Remove any leading/trailing spaces
};

export const CategoryBreakdownChart = ({ categoryData }: CategoryBreakdownProps) => {
  const [view, setView] = useState<'percentage' | 'amount'>('percentage');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Process and deduplicate categories with case-insensitive grouping
  const normalizedCategoryData = categoryData.reduce((acc, category) => {
    // Normalize category name for case-insensitive comparison
    const standardName = standardizeCategory(category.category).toLowerCase();
    
    // Check if this standardized category name already exists in our accumulator
    const existingCategoryIndex = acc.findIndex(c => 
      standardizeCategory(c.category).toLowerCase() === standardName
    );
    
    if (existingCategoryIndex >= 0) {
      // If it exists, add the amount to the existing category
      acc[existingCategoryIndex].amount += category.amount;
      // Don't add percentages directly, we'll recalculate later
    } else {
      // Otherwise add it as a new category with the standardized name
      acc.push({
        ...category,
        category: standardizeCategory(category.category)
      });
    }
    
    return acc;
  }, [] as CategorySummary[]);
  
  // Recalculate percentages based on the total amount
  const totalAmount = normalizedCategoryData.reduce((sum, cat) => sum + cat.amount, 0);
  const finalCategoryData = normalizedCategoryData.map(cat => ({
    ...cat,
    percentage: totalAmount > 0 ? (cat.amount / totalAmount) * 100 : 0
  }));
  
  // Sort categories by amount spent (highest first)
  const sortedCategories = [...finalCategoryData].sort((a, b) => b.amount - a.amount);
  
  // Calculate total expenses
  const totalExpenses = finalCategoryData.reduce((sum, category) => sum + category.amount, 0);

  // Toggle expanded category
  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Expense Breakdown</CardTitle>
        <Select value={view} onValueChange={(value: 'percentage' | 'amount') => setView(value)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Select view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">Percentage</SelectItem>
            <SelectItem value="amount">Amount ($)</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-[300px]">
            <PieChartDisplay data={sortedCategories} />
          </div>
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-2">Category</th>
                  <th className="text-right py-2">
                    {view === 'percentage' ? 'Percentage' : 'Amount'}
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((category, index) => (
                  <Collapsible 
                    key={index} 
                    open={expandedCategory === category.category}
                    asChild
                  >
                    <>
                      <tr className="border-b border-border/40">
                        <td className="py-2 text-left">{category.category}</td>
                        <td className="py-2 text-right font-medium">
                          {view === 'percentage' 
                            ? `${(category.amount / totalExpenses * 100).toFixed(1)}%`
                            : formatCurrency(category.amount)
                          }
                        </td>
                        <td className="w-10 py-2 text-right">
                          <CollapsibleTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => toggleCategory(category.category)}
                              className="h-6 w-6 p-0"
                            >
                              {expandedCategory === category.category ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="sr-only">Toggle {category.category} details</span>
                            </Button>
                          </CollapsibleTrigger>
                        </td>
                      </tr>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={3} className="bg-muted/30">
                            <div className="p-2">
                              <CategoryDetail 
                                category={category.category} 
                                totalAmount={category.amount}
                              />
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-background">
                <tr className="border-t border-t-2">
                  <td className="py-2 font-bold">Total</td>
                  <td className="py-2 text-right font-bold">
                    {view === 'percentage' 
                      ? '100%'
                      : formatCurrency(totalExpenses)
                    }
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface CategoryDetailProps {
  category: string;
  totalAmount: number;
}

// Component to show detailed breakdown of a category
const CategoryDetail = ({ category, totalAmount }: CategoryDetailProps) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCategoryTransactions = async () => {
      setIsLoading(true);
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        // Get the current month key in yyyy-MM format
        const currentMonth = new Date();
        const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

        // Fetch all transactions for this category in the current month
        const { data, error } = await supabase
          .from('transactions')
          .select('id, date, description, amount')
          .eq('category', category)
          .eq('user_id', user.user.id)
          .eq('month_key', monthKey)
          .order('date', { ascending: false });

        if (error) throw error;
        setTransactions(data || []);
      } catch (error: any) {
        console.error('Error fetching category transactions:', error);
        toast({
          title: 'Error',
          description: 'Failed to load transaction details',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategoryTransactions();
  }, [category, toast]);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{category} Breakdown</h4>
      <div className="text-xs text-muted-foreground">
        <p>Total spent: {formatCurrency(totalAmount)}</p>
        <p className="mt-1">All transactions this month ({transactions.length}):</p>
        
        {isLoading ? (
          <div className="py-2 text-center">
            <p className="text-xs">Loading...</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto">
            <Table className="mt-2 w-full">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs py-1 px-2">Date</TableHead>
                  <TableHead className="text-xs py-1 px-2">Description</TableHead>
                  <TableHead className="text-xs py-1 px-2 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id} className="text-xs border-b border-border/20">
                    <TableCell className="py-1 px-2">{formatDate(tx.date)}</TableCell>
                    <TableCell className="py-1 px-2">{tx.description}</TableCell>
                    <TableCell className="py-1 px-2 text-right font-medium">
                      {formatCurrency(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-xs italic mt-2">
            No transactions found for this category in the current month.
          </p>
        )}
      </div>
    </div>
  );
};
