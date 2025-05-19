
import { useState, useMemo } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Transaction } from '@/types';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { categories } from '@/utils/categories';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface TransactionTableProps {
  transactions: Transaction[];
  onUpdateCategory: (id: string, category: string, type?: string) => void;
}

export const TransactionTable = ({ transactions, onUpdateCategory }: TransactionTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 50;
  
  // Get all expense categories from categories.ts plus Income
  const categoryGroups = ['Income', ...Object.keys(categories).filter(cat => cat !== 'income')];
  
  // Filter transactions based on search term
  const filteredTransactions = useMemo(() => 
    transactions.filter(tx => 
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.category.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [transactions, searchTerm]
  );
  
  // Sort transactions
  const sortedTransactions = useMemo(() => 
    [...filteredTransactions].sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        return sortDirection === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
    }),
    [filteredTransactions, sortField, sortDirection]
  );
  
  // Calculate pagination
  const totalPages = Math.ceil(sortedTransactions.length / ROWS_PER_PAGE);
  const pageStartIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const pageEndIndex = Math.min(pageStartIndex + ROWS_PER_PAGE, sortedTransactions.length);
  const currentPageData = sortedTransactions.slice(pageStartIndex, pageEndIndex);
  
  const toggleSort = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    // Reset to first page on sort change
    setCurrentPage(1);
  };

  // Handle category update and update type if needed
  const handleCategoryUpdate = (transactionId: string, newCategory: string) => {
    // If the category is Income, we need to update the type as well
    const updatedType = newCategory === 'Income' ? 'income' : 'expense';
    
    // Call the onUpdateCategory prop with both category and type
    onUpdateCategory(transactionId, newCategory, updatedType);
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    
    // Always show first page
    pages.push(1);
    
    // Calculate range around current page
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);
    
    // Add ellipsis after first page if needed
    if (startPage > 2) {
      pages.push('ellipsis1');
    }
    
    // Add pages around current page
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      pages.push('ellipsis2');
    }
    
    // Add last page if there is more than one page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Input
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1); // Reset to first page on search
          }}
          className="max-w-sm"
        />
        <div className="text-sm text-muted-foreground">
          {sortedTransactions.length} transaction{sortedTransactions.length !== 1 ? 's' : ''} found
          {totalPages > 1 && ` • Showing ${pageStartIndex + 1}-${pageEndIndex} of ${sortedTransactions.length}`}
        </div>
      </div>
      
      {transactions.length === 0 ? (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No transactions found</AlertTitle>
          <AlertDescription>
            Try uploading a bank statement or credit card statement to see your transactions here.
            Make sure your file contains transaction data in a structured format.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent/50" 
                    onClick={() => toggleSort('date')}
                  >
                    Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => toggleSort('amount')}
                  >
                    Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPageData.length > 0 ? (
                  currentPageData.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{transaction.date}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell 
                        className={`font-medium ${transaction.type === 'income' ? 'text-income-dark' : 'text-expense-dark'}`}
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="w-[140px] justify-between">
                              {transaction.category}
                              <span>▼</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-56 bg-white">
                            <DropdownMenuLabel>Select Category</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <div className="max-h-[300px] overflow-y-auto">
                              {/* Add the dedicated Income option */}
                              <DropdownMenuItem 
                                key="Income"
                                onClick={() => handleCategoryUpdate(transaction.id, "Income")}
                              >
                                Income
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              {/* Add Uncategorized Expense at the top of expense categories */}
                              <DropdownMenuItem 
                                key="UncategorizedExpense"
                                onClick={() => handleCategoryUpdate(transaction.id, "Uncategorized Expense")}
                              >
                                Uncategorized Expense
                              </DropdownMenuItem>
                              
                              {/* Add Bank Fees category */}
                              <DropdownMenuItem 
                                key="BankFees"
                                onClick={() => handleCategoryUpdate(transaction.id, "Bank Fees")}
                              >
                                Bank Fees
                              </DropdownMenuItem>
                              
                              {/* Add all other expense categories */}
                              {Object.keys(categories)
                                .filter(cat => cat !== 'income' && cat !== 'uncategorizedExpense' && cat !== 'bankFees')
                                .map(categoryGroup => {
                                  // Format category group name for display (e.g., "diningOut" -> "Dining Out")
                                  const formattedCategoryName = categoryGroup
                                    .replace(/([A-Z])/g, ' $1')
                                    .replace(/^./, (str) => str.toUpperCase());
                                  
                                  return (
                                    <DropdownMenuItem 
                                      key={categoryGroup}
                                      onClick={() => handleCategoryUpdate(transaction.id, formattedCategoryName)}
                                    >
                                      {formattedCategoryName}
                                    </DropdownMenuItem>
                                  );
                                })
                              }
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
          
          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {getPageNumbers().map((page, i) => (
                  page === 'ellipsis1' || page === 'ellipsis2' ? (
                    <PaginationItem key={`ellipsis-${i}`}>
                      <span className="px-4 py-2">...</span>
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={`page-${page}`}>
                      <PaginationLink
                        isActive={currentPage === page}
                        onClick={() => typeof page === 'number' && handlePageChange(page)}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
};
