
import { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Transaction } from '@/types';

interface TransactionTableProps {
  transactions: Transaction[];
  onUpdateCategory: (id: string, category: string) => void;
}

export const TransactionTable = ({ transactions, onUpdateCategory }: TransactionTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Define available categories for the dropdown
  const categories = [
    "Housing", "Transportation", "Groceries", "Dining Out", "Utilities", 
    "Subscriptions", "Healthcare", "Insurance", "Entertainment", 
    "Travel", "Personal Care", "Gifts/Donations", "Savings/Investments", "Other"
  ];
  
  // Filter transactions based on search term
  const filteredTransactions = transactions.filter(tx => 
    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.category.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      <div className="mb-4">
        <Input
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.date}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell 
                    className={`font-medium ${transaction.amount >= 0 ? 'text-income-dark' : 'text-expense-dark'}`}
                  >
                    ${Math.abs(transaction.amount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <span 
                      className={`inline-block px-2 py-1 rounded-full text-xs ${
                        transaction.type === 'income' 
                          ? 'bg-income-light/20 text-income-dark' 
                          : 'bg-expense-light/20 text-expense-dark'
                      }`}
                    >
                      {transaction.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {transaction.type === 'income' ? (
                      'Income'
                    ) : (
                      <Select 
                        value={transaction.category} 
                        onValueChange={(value) => onUpdateCategory(transaction.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
