export type SignatureStatus = 'pending' | 'signed' | 'mismatch' | 'unverifiable';

export interface InvoiceRecord {
  id: string;
  documentId: string;
  type: 'income' | 'expense';
  date: number;
  customerName: string;
  customerAddress: string;
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  decimals: number;
  description: string;
  tags: string[];
  additionalNotes: string;
  transactionHash: string;
  signatureStatus: SignatureStatus;
  signedBy?: string;
  createdAt: number;
  invoiceType: 'pre_payment_invoice' | 'post_payment_invoice';
  status: 'unpaid' | 'paid' | 'cancelled';
  paymentLink?: string;
  dueDate?: string;
  updatedAt: string;
  blockchainData?: {
    blockNumber: number;
    status: string;
    chainId: number;
  };
  verifierData?: {
    tokenSymbol: string;
    amount: string;
    txHash: string;
    from: string;
    to: string;
    timestamp: number;
    type: 'income' | 'expense';
  };
}

export interface PaymentRequest {
  id: string;
  created_at: string;
  updated_at: string;
  amount: string;
  token_symbol: string;
  token_address: string;
  chain_id: string;
  customer_name: string;
  description?: string;
  tags?: string[];
  additional_notes?: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  payment_link: string;
  requester_address: string;
  payer_address?: string;
  transaction_hash?: string;
  paid_at?: string;
  expires_at: string;
} 