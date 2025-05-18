
import { useState } from 'react';
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

interface CategoryBreakdownProps {
  categoryData: CategorySummary[];
}

export const CategoryBreakdownChart = ({ categoryData }: CategoryBreakdownProps) => {
  const [view, setView] = useState<'percentage' | 'amount'>('percentage');
  
  // Sort categories by amount spent (highest first)
  const sortedCategories = [...categoryData].sort((a, b) => b.amount - a.amount);
  
  // Calculate total expenses
  const totalExpenses = categoryData.reduce((sum, category) => sum + category.amount, 0);
  
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
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((category, index) => (
                  <tr key={index} className="border-b border-border/40">
                    <td className="py-2 text-left">{category.category}</td>
                    <td className="py-2 text-right font-medium">
                      {view === 'percentage' 
                        ? `${(category.amount / totalExpenses * 100).toFixed(1)}%`
                        : `$${category.amount.toFixed(2)}`
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-background">
                <tr className="border-t border-t-2">
                  <td className="py-2 font-bold">Total</td>
                  <td className="py-2 text-right font-bold">
                    {view === 'percentage' 
                      ? '100%'
                      : `$${totalExpenses.toFixed(2)}`
                    }
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
