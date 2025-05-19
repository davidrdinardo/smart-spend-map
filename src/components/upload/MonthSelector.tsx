
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

interface MonthSelectorProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  year?: number; // Optional year parameter, defaults to current year
  showFullYear?: boolean; // Whether to show full year range or just one year
}

export const MonthSelector = ({ 
  selectedMonth, 
  setSelectedMonth, 
  year = new Date().getFullYear(), 
  showFullYear = false 
}: MonthSelectorProps) => {
  // Generate available months - either for full year range or specific year
  const getAvailableMonths = () => {
    const months = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // If showFullYear is true, show all months for the specified year
    if (showFullYear) {
      for (let month = 0; month < 12; month++) {
        const date = new Date(year, month, 1);
        const monthKey = format(date, 'yyyy-MM');
        const monthName = format(date, 'MMMM yyyy');
        months.push({ key: monthKey, label: monthName });
      }
    } else {
      // Original behavior - get months for current year and 2 previous years
      for (let yearOffset = currentYear; yearOffset >= currentYear - 2; yearOffset--) {
        for (let month = 11; month >= 0; month--) {
          const date = new Date(yearOffset, month, 1);
          // Only include months up to the current month or all months for past years
          if (yearOffset === currentYear && month > currentDate.getMonth()) continue;
          
          const monthKey = format(date, 'yyyy-MM');
          const monthName = format(date, 'MMMM yyyy');
          months.push({ key: monthKey, label: monthName });
        }
      }
    }
    
    return months;
  };
  
  const availableMonths = getAvailableMonths();
  
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">Statement Month</label>
      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select month" />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {availableMonths.map(month => (
            <SelectItem key={month.key} value={month.key}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-gray-500 mt-1">
        Select the month and year this statement covers
      </p>
    </div>
  );
};
