import { InvoiceRecord } from '../types/storage';
import { useWalletStore } from '../store/walletStore';
import { Wallet } from '../store/walletStore';

interface FilterParams {
  startDate?: number;
  endDate?: number;
  type?: 'income' | 'expense';
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

  saveInvoice(invoice: Omit<InvoiceRecord, 'id' | 'createdAt'>): InvoiceRecord {
    try {
      const records = this.getInvoices();
      const newInvoice: InvoiceRecord = {
        ...invoice,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      records.push(newInvoice);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
      return newInvoice;
    } catch (error) {
      throw new Error('保存发票失败');
    }
  }

  getInvoice(id: string): InvoiceRecord | null {
    const invoices = this.getAllInvoices();
    return invoices.find(invoice => invoice.id === id || invoice.documentId === id) || null;
  }

  private getAllInvoices(): InvoiceRecord[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
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
      const walletStore = useWalletStore.getState();
      const isMainWallet = walletStore.mainWallet?.toLowerCase() === address.toLowerCase();
      const subWallets = walletStore.availableWallets;

      // 如果是主钱包，返回主钱包和所有子钱包的记录
      if (isMainWallet) {
        const subWalletAddresses = subWallets
          .filter((w: Wallet) => w.parentWallet.toLowerCase() === address.toLowerCase())
          .map((w: Wallet) => w.address.toLowerCase());

        return invoices.filter(
          (invoice) =>
            invoice.from.toLowerCase() === address.toLowerCase() ||
            invoice.to.toLowerCase() === address.toLowerCase() ||
            subWalletAddresses.includes(invoice.from.toLowerCase()) ||
            subWalletAddresses.includes(invoice.to.toLowerCase())
        );
      }

      // 如果是子钱包，只返回该钱包的记录
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

      // 按创建时间倒序排序
      records.sort((a, b) => b.createdAt - a.createdAt);

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