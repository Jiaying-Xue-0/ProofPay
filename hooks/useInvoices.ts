import useSWR from 'swr';
import { storage } from '../services/storage';
import { useWalletStore } from '../store/walletStore';
import { InvoiceRecord } from '../types/storage';

interface FilterState {
  type: '' | 'income' | 'expense';
  tokenSymbol: string;
  startDate: string;
  endDate: string;
}

// 创建一个唯一的缓存键
const createCacheKey = (address: string | null, filter: FilterState) => {
  if (!address) return null;
  return ['invoices', address, filter.type, filter.tokenSymbol, filter.startDate, filter.endDate].join('-');
};

// 过滤发票数据
const filterInvoices = (invoices: InvoiceRecord[], filter: FilterState, mainWallet: string | null) => {
  return invoices.filter(invoice => {
    // 类型筛选（收入/支出）
    const matchesType = !filter.type || (
      filter.type === 'income' 
        ? invoice.to.toLowerCase() === mainWallet?.toLowerCase() // 收入：当前钱包是接收方
        : invoice.from.toLowerCase() === mainWallet?.toLowerCase() // 支出：当前钱包是发送方
    );

    // 代币符号筛选
    const matchesToken = !filter.tokenSymbol || 
      invoice.tokenSymbol.toLowerCase().includes(filter.tokenSymbol.toLowerCase());
    
    // 日期筛选
    let matchesStartDate = true;
    let matchesEndDate = true;

    if (filter.startDate) {
      const startDate = new Date(filter.startDate);
      startDate.setHours(0, 0, 0, 0);
      matchesStartDate = invoice.date >= startDate.getTime();
    }

    if (filter.endDate) {
      const endDate = new Date(filter.endDate);
      endDate.setHours(23, 59, 59, 999);
      matchesEndDate = invoice.date <= endDate.getTime();
    }

    return matchesType && matchesToken && matchesStartDate && matchesEndDate;
  });
};

export function useInvoices(filter: FilterState) {
  const { mainWallet } = useWalletStore();
  
  // 使用 SWR 获取数据
  const { data: invoices, error, isLoading, mutate } = useSWR(
    createCacheKey(mainWallet, filter),
    async () => {
      if (!mainWallet) return [];
      const allInvoices = await storage.getInvoicesByAddress(mainWallet);
      return filterInvoices(allInvoices, filter, mainWallet);
    },
    {
      revalidateOnFocus: true, // 页面重新获得焦点时重新验证
      revalidateOnReconnect: true, // 重新连接时重新验证
      refreshInterval: 30000, // 每30秒自动刷新一次
      dedupingInterval: 5000, // 5秒内重复请求会被去重
    }
  );

  return {
    invoices: invoices || [],
    error,
    isLoading,
    mutate, // 用于手动触发重新验证
  };
} 