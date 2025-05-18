
import { Database } from './types';

// Extending Database type definition to include our tables
export type DatabaseWithTables = Database & {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          description: string;
          amount: number;
          type: 'income' | 'expense';
          category: string;
          month_key: string;
          created_at: string;
          source_upload_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          description: string;
          amount: number;
          type: 'income' | 'expense';
          category: string;
          month_key: string;
          created_at?: string;
          source_upload_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          description?: string;
          amount?: number;
          type?: 'income' | 'expense';
          category?: string;
          month_key?: string;
          created_at?: string;
          source_upload_id?: string | null;
        };
      };
      uploads: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          uploaded_at: string;
          file_path: string;
          processed: boolean;
          statement_month: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          filename: string;
          file_path: string;
          uploaded_at?: string;
          processed?: boolean;
          statement_month?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          filename?: string;
          file_path?: string;
          uploaded_at?: string;
          processed?: boolean;
          statement_month?: string | null;
        };
      };
    };
  };
};

// Create a typed Supabase client
export type TablesInsert<T extends keyof DatabaseWithTables['public']['Tables']> = 
  DatabaseWithTables['public']['Tables'][T]['Insert'];

export type TablesRow<T extends keyof DatabaseWithTables['public']['Tables']> = 
  DatabaseWithTables['public']['Tables'][T]['Row'];

export type TablesUpdate<T extends keyof DatabaseWithTables['public']['Tables']> = 
  DatabaseWithTables['public']['Tables'][T]['Update'];
