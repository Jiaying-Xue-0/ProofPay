interface InvoiceRecord {
  id: string;
  transactionHash: string;
  type: 'invoice' | 'receipt';
  customerName: string;
  description: string;
  amount: string;
  tokenSymbol: string;
  date: number;
  from: string;
  to: string;
  additionalNotes?: string;
  tags?: string[];
  createdAt: number;
}

const STORAGE_KEY = 'proofpay_invoices';

export const storage = {
  saveInvoice: (invoice: Omit<InvoiceRecord, 'id' | 'createdAt'>) => {
    const records = storage.getInvoices();
    const newInvoice: InvoiceRecord = {
      ...invoice,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };
    records.push(newInvoice);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return newInvoice;
  },

  getInvoices: (): InvoiceRecord[] => {
    if (typeof window === 'undefined') return [];
    const records = localStorage.getItem(STORAGE_KEY);
    return records ? JSON.parse(records) : [];
  },

  filterInvoices: (params: {
    startDate?: number;
    endDate?: number;
    type?: 'invoice' | 'receipt';
    tokenSymbol?: string;
  }) => {
    let records = storage.getInvoices();

    if (params.startDate) {
      records = records.filter(record => record.date >= params.startDate!);
    }
    if (params.endDate) {
      records = records.filter(record => record.date <= params.endDate!);
    }
    if (params.type) {
      records = records.filter(record => record.type === params.type);
    }
    if (params.tokenSymbol) {
      records = records.filter(record => record.tokenSymbol === params.tokenSymbol);
    }

    return records;
  },

  generateShareLink: (invoiceId: string): string => {
    return `${window.location.origin}/share/${invoiceId}`;
  }
}; 