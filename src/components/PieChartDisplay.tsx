
import { useState, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { CategorySummary } from '@/types';

interface PieChartDisplayProps {
  data: CategorySummary[];
}

export const PieChartDisplay = ({ data }: PieChartDisplayProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const colors = [
    '#ef4444', // red (expense-default)
    '#f87171', // red-400
    '#fca5a5', // red-300
    '#fb7185', // rose-400
    '#f43f5e', // rose-500
    '#e11d48', // rose-600
    '#9f1239', // rose-800
    '#881337', // rose-900
    '#7f1d1d', // red-900
    '#991b1b', // red-800
    '#b91c1c', // red-700
    '#dc2626', // red-600
    '#f97316', // orange-500
    '#ea580c', // orange-600
    '#d97706', // amber-600
    '#b45309', // amber-700
  ];

  const onPieEnter = useCallback(
    (_: unknown, index: number) => {
      setActiveIndex(index);
    },
    [setActiveIndex]
  );

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;

    return (
      <g>
        <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill={fill} className="text-lg font-semibold">
          {payload.category}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fill="#999" className="text-sm">
          ${payload.amount.toFixed(2)} ({(percent * 100).toFixed(1)}%)
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

  return (
    <div className="w-full h-full">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              fill="#8884d8"
              paddingAngle={2}
              dataKey="amount"
              onMouseEnter={onPieEnter}
              animationDuration={300}
              animationBegin={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500">No expense data for this month</p>
        </div>
      )}
    </div>
  );
};
