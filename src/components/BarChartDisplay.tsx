
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';
import { MonthData } from '@/types';

interface BarChartDisplayProps {
  data: MonthData[];
}

export const BarChartDisplay = ({ data }: BarChartDisplayProps) => {
  // Create formatted data for the chart
  const formattedData = data.map(item => {
    // Get month name from month key (YYYY-MM)
    const [year, month] = item.month_key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleString('default', { month: 'short' });
    
    return {
      ...item,
      month: `${monthName} ${year}`,
    };
  });
  
  return (
    <div className="w-full h-full">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="month" 
              angle={-45} 
              textAnchor="end" 
              height={60} 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip 
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Net Amount']}
              labelFormatter={(label) => `Month: ${label}`}
            />
            <ReferenceLine y={0} stroke="#666" />
            <Bar 
              dataKey="net" 
              name="Net Amount"
              radius={[4, 4, 0, 0]}
            >
              {formattedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.net >= 0 ? '#22c55e' : '#ef4444'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500">No monthly data available</p>
        </div>
      )}
    </div>
  );
};
