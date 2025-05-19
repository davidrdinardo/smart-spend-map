import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChartDisplay } from '@/components/PieChartDisplay';
import { standardizeCategory } from '@/utils/categories';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
}

interface CategoryBreakdownChartProps {
  categoryData: CategorySummary[];
}

export const CategoryBreakdownChart = ({ categoryData }: CategoryBreakdownChartProps) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Process and deduplicate categories
  const normalizedCategoryData = categoryData.reduce((acc, category) => {
    // Normalize category name for consistent format
    const standardName = standardizeCategory(category.category);
    
    // Check if this standardized category name already exists in our accumulator (case-insensitive)
    const existingCategoryIndex = acc.findIndex(c => 
      standardizeCategory(c.category).toLowerCase() === standardName.toLowerCase()
    );
    
    if (existingCategoryIndex >= 0) {
      // If it exists, add the amount to the existing category
      acc[existingCategoryIndex].amount += category.amount;
      // Don't add percentages directly, we'll recalculate later
    } else {
      // Otherwise add it as a new category with the standardized name
      acc.push({
        ...category,
        category: standardName
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
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Return fallback UI if no data
  if (sortedCategories.length === 0) {
    return (
      <Card className="col-span-full bg-gray-50/30 h-64 flex items-center justify-center">
        <CardContent className="text-center text-gray-500">
          <p>No expense data available</p>
          <p className="text-sm mt-2">Upload bank statements to see your expense breakdown</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <PieChartDisplay data={sortedCategories} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Top Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sortedCategories.map((category, index) => {
              const isExpanded = expandedCategory === category.category;
              
              return (
                <div
                  key={index}
                  className={`border rounded-md ${
                    isExpanded ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div
                    onClick={() => toggleCategory(category.category)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="font-medium">{category.category}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold">
                        {formatCurrency(category.amount)}
                      </span>
                      <span className="text-xs text-gray-500 w-14 text-right">
                        {category.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-3 pt-0 border-t border-gray-200 bg-gray-50">
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>
                          <span className="font-medium">Amount:</span> {formatCurrency(category.amount)}
                        </p>
                        <p>
                          <span className="font-medium">Percentage:</span>{' '}
                          {category.percentage.toFixed(1)}% of total expenses
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-expense h-2.5 rounded-full"
                            style={{ width: `${Math.min(100, category.percentage)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Expenses</span>
              <span className="font-bold">{formatCurrency(totalExpenses)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
