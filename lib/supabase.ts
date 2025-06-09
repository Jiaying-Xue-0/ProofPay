import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  }
});

// 类型定义
export type SignatureStatus = 'pending' | 'signed' | 'mismatch' | 'unverifiable';

export interface DbInvoice {
  id: string;
  document_id: string;
  transaction_hash: string;
  type: 'income' | 'expense';
  customer_name: string;
  customer_address?: string;
  description: string;
  amount: string;
  token_symbol: string;
  decimals: number;
  date: number;
  from_address: string;
  to_address: string;
  additional_notes?: string;
  tags: string[];
  signature_status: SignatureStatus;
  signed_by?: string;
  signed_at?: string;
  signature?: string;
  signed_message?: string;
  created_at: number;
  block_number?: number;
  wallet_address: string; // 关联的钱包地址
}

export interface DbWallet {
  id: string;
  address: string;
  parent_wallet?: string;
  label: string;
  created_at: string;
  is_main: boolean;
} 