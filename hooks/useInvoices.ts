import { useEffect } from 'react';
import useSWR from 'swr';
import { db } from '../services/db';
import { useWalletStore } from '../store/walletStore';
import { InvoiceRecord } from '../types/storage';

interface FilterState {
  type: '' | 'income' | 'expense';
  tokenSymbol: string;
  startDate: string;
  endDate: string;
  paymentStatus: '' | 'paid' | 'unpaid' | 'expired' | 'cancelled';
}

export function useInvoices(filter: FilterState) {
  const { mainWallet, currentConnectedWallet, availableWallets } = useWalletStore();

  // 获取要查询的钱包地址列表
  const getWalletAddresses = () => {
    if (!currentConnectedWallet) return [];
    
    // 如果当前连接的是主钱包，返回主钱包和所有子钱包的地址
    if (currentConnectedWallet.toLowerCase() === mainWallet?.toLowerCase()) {
      return [
        mainWallet.toLowerCase(),
        ...availableWallets.map(w => w.address.toLowerCase())
      ];
    }
    
    // 如果是子钱包，只返回当前连接的子钱包地址
    return [currentConnectedWallet.toLowerCase()];
  };

  // 构建缓存键
  const getCacheKey = () => {
    const addresses = getWalletAddresses();
    if (addresses.length === 0) return null;

    return [
      'invoices',
      addresses.join(','),
      filter.type,
      filter.tokenSymbol,
      filter.startDate,
      filter.endDate,
      filter.paymentStatus
    ];
  };

  // 获取发票数据
  const fetchInvoices = async () => {
    const addresses = getWalletAddresses();
    if (addresses.length === 0) return [];

    const uniqueInvoices = new Map<string, InvoiceRecord>();
    
    // 获取所有相关钱包的发票
    for (const address of addresses) {
      const walletInvoices = await db.getInvoicesByAddress(address);
      
      // 如果是子钱包，只获取与该钱包相关的发票
      if (currentConnectedWallet?.toLowerCase() !== mainWallet?.toLowerCase()) {
        const filteredInvoices = walletInvoices.filter(invoice => {
          const invoiceAddress = invoice.from.toLowerCase() === address.toLowerCase() ? 
            invoice.from.toLowerCase() : 
            invoice.to.toLowerCase();
          return invoiceAddress === currentConnectedWallet?.toLowerCase();
        });
        filteredInvoices.forEach(invoice => uniqueInvoices.set(invoice.id, invoice));
      } else {
        // 如果是主钱包，获取所有发票
        walletInvoices.forEach(invoice => uniqueInvoices.set(invoice.id, invoice));
      }
    }

    // 转换为数组并按照筛选条件过滤
    return Array.from(uniqueInvoices.values()).filter(invoice => {
      let matches = true;

      if (filter.type && invoice.type !== filter.type) {
        matches = false;
      }

      if (filter.tokenSymbol && !invoice.tokenSymbol.toLowerCase().includes(filter.tokenSymbol.toLowerCase())) {
        matches = false;
      }

      if (filter.startDate) {
        const startDate = new Date(filter.startDate).getTime();
        if (invoice.date < startDate) {
          matches = false;
        }
      }

      if (filter.endDate) {
        const endDate = new Date(filter.endDate).getTime() + 24 * 60 * 60 * 1000; // 包含结束日期当天
        if (invoice.date > endDate) {
          matches = false;
        }
      }

      // 支付状态筛选
      if (filter.paymentStatus) {
        // 如果发票没有状态字段，根据发票类型判断默认状态
        const invoiceStatus = invoice.status || (invoice.invoiceType === 'pre_payment_invoice' ? 'unpaid' : 'paid');
        
        if (filter.paymentStatus !== invoiceStatus) {
          matches = false;
        }
      }

      return matches;
    }).sort((a, b) => b.date - a.date); // 按日期降序排序
  };

  const { data: invoices = [], error, isLoading } = useSWR(
    getCacheKey(),
    fetchInvoices,
    {
      refreshInterval: 30000, // 每30秒自动刷新
      revalidateOnFocus: true, // 窗口获得焦点时重新验证
      revalidateOnReconnect: true, // 重新连接时重新验证
    }
  );

  return {
    invoices,
    error,
    isLoading,
  };
} 