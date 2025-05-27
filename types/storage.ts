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
  createdAt: number;
} 