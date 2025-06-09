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
  tags?: string[];
  additionalNotes?: string;
  transactionHash: string;
  signatureStatus?: SignatureStatus;
  signedBy?: string;
  walletAddress: string;
  createdAt: string;
} 