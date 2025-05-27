import { InvoiceRecord } from '../types/storage';

interface FilterParams {
  startDate?: number;
  endDate?: number;
  type?: 'invoice' | 'receipt';
  tokenSymbol?: string;
}

class StorageService {
  private readonly STORAGE_KEY = 'proofpay_invoices';

  private getInvoices(): InvoiceRecord[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveInvoices(invoices: InvoiceRecord[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(invoices));
  }

  saveInvoice(data: Omit<InvoiceRecord, 'id' | 'createdAt'>): InvoiceRecord {
    try {
      const invoices = this.getInvoices();
      const newInvoice: InvoiceRecord = {
        ...data,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
      };
      invoices.push(newInvoice);
      this.saveInvoices(invoices);
      return newInvoice;
    } catch (error) {
      throw new Error('保存发票数据失败');
    }
  }

  getInvoiceById(id: string): InvoiceRecord | null {
    try {
      const invoices = this.getInvoices();
      // 先尝试通过 documentId 查找
      const invoice = invoices.find(inv => inv.documentId === id);
      if (invoice) {
        return invoice;
      }
      
      // 如果找不到，再尝试通过 id 查找（向后兼容）
      const fallbackInvoice = invoices.find(inv => inv.id === id);
      return fallbackInvoice || null;
    } catch (error) {
      return null;
    }
  }

  getInvoicesByAddress(address: string): InvoiceRecord[] {
    try {
      const invoices = this.getInvoices();
      return invoices.filter(
        (invoice) =>
          invoice.from.toLowerCase() === address.toLowerCase() ||
          invoice.to.toLowerCase() === address.toLowerCase()
      );
    } catch (error) {
      return [];
    }
  }

  filterInvoices(params: FilterParams): InvoiceRecord[] {
    try {
      let records = this.getInvoices();

      if (params.startDate) {
        records = records.filter((record) => record.date >= params.startDate!);
      }

      if (params.endDate) {
        records = records.filter((record) => record.date <= params.endDate!);
      }

      if (params.type) {
        records = records.filter((record) => record.type === params.type);
      }

      if (params.tokenSymbol) {
        records = records.filter((record) => record.tokenSymbol === params.tokenSymbol);
      }

      return records;
    } catch (error) {
      return [];
    }
  }

  generateShareLink(invoiceId: string): string {
    return `${window.location.origin}/share/${invoiceId}`;
  }
}

export const storage = new StorageService(); 