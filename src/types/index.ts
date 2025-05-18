
export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  month_key: string;
}

export interface Upload {
  id: string;
  user_id: string;
  filename: string;
  uploaded_at: string;
}

export interface User {
  id: string;
  email: string;
}

export interface MonthSummary {
  income: number;
  expenses: number;
  net: number;
}

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthData {
  month_key: string;
  net: number;
}
