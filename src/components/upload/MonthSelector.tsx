
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

interface MonthSelectorProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

export const MonthSelector = ({ selectedMonth, setSelectedMonth }: MonthSelectorProps) => {
  // Generate available months for the last 2 years
  const getAvailableMonths = () => {
    const months = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Add months for current year and 2 previous years
    for (let year = currentYear; year >= currentYear - 2; year--) {
      for (let month = 12; month >= 1; month--) {
        // Format month to ensure two digits (01, 02, etc.)
        const formattedMonth = month.toString().padStart(2, '0');
        const monthKey = `${year}-${formattedMonth}`;
        
        // Skip future months
        const monthDate = new Date(year, month - 1);
        if (monthDate > currentDate) continue;
        
        const monthName = format(monthDate, 'MMMM yyyy');
        months.push({ key: monthKey, label: monthName });
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
        <SelectContent>
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
