import { InvoiceRecord } from '../types/storage';
import { useWalletStore } from '../store/walletStore';
import { Wallet } from '../store/walletStore';
import { db } from './db';

interface FilterParams {
  startDate?: number;
  endDate?: number;
  type?: 'income' | 'expense';
  tokenSymbol?: string;
}

class StorageService {
  async saveInvoice(invoice: Omit<InvoiceRecord, 'id' | 'createdAt'>): Promise<InvoiceRecord> {
    try {
      return await db.saveInvoice(invoice);
    } catch (error) {
      throw new Error('保存发票失败');
    }
  }

  async getInvoice(id: string): Promise<InvoiceRecord | null> {
    return await db.getInvoice(id);
  }

  async getInvoiceById(id: string): Promise<InvoiceRecord | null> {
    return await db.getInvoice(id);
  }

  async getInvoicesByAddress(address: string): Promise<InvoiceRecord[]> {
    return await db.getInvoicesByAddress(address);
  }

  generateShareLink(invoiceId: string): string {
    return `${window.location.origin}/share/${invoiceId}`;
  }
}

export const storage = new StorageService(); 