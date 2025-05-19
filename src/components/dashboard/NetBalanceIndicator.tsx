
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface NetBalanceIndicatorProps {
  net: number;
  loading: boolean;
  transactionsExist: boolean;
}

export const NetBalanceIndicator: React.FC<NetBalanceIndicatorProps> = ({ 
  net, 
  loading, 
  transactionsExist 
}) => {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Net Balance</CardDescription>
        <CardTitle className={`text-2xl ${net >= 0 ? 'text-income-dark' : 'text-expense-dark'}`}>
          ${net.toFixed(2)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : !transactionsExist ? (
          <p className="text-sm text-gray-500">
            Upload statements to see your financial summary.
          </p>
        ) : (
          <div className="flex items-center space-x-2">
            {net >= 0 ? (
              <>
                <ArrowUpCircle className="h-5 w-5 text-income" />
                <p className="text-sm text-gray-700">
                  You saved {formatCurrency(net)} this month — great job!
                </p>
              </>
            ) : (
              <>
                <ArrowDownCircle className="h-5 w-5 text-expense" />
                <p className="text-sm text-gray-700">
                  You spent {formatCurrency(net)} more than you earned this month.
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
