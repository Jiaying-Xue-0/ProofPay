export type SignatureStatus = 'pending' | 'signed' | 'mismatch' | 'unverifiable';

export interface InvoiceRecord {
  id: string;
  documentId: string;
  transactionHash: string;
  type: 'invoice' | 'receipt';
  customerName: string;
  customerAddress?: string;
  description: string;
  amount: string;
  tokenSymbol: string;
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
} 