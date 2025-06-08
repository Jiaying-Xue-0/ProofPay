export type SignatureStatus = 'pending' | 'signed' | 'mismatch' | 'unverifiable';

export interface InvoiceRecord {
  id: string;
  documentId: string;
  transactionHash: string;
  type: 'income' | 'expense';
  customerName: string;
  customerAddress?: string;
  description: string;
  amount: string;
  tokenSymbol: string;
  decimals: number;
  date: number;
  from: string;
  to: string;
  additionalNotes?: string;
  tags: string[];
  signatureStatus: SignatureStatus;
  signedBy?: string;
  signedAt?: Date;
  signature?: string;
  signedMessage?: string;
  createdAt: number;
  blockNumber?: number;
} 