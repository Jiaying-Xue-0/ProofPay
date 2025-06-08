import { useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  type: 'income' | 'expense';
  customerName: string;
  amount: string;
  tokenSymbol: string;
  description: string;
  date: number;
  tags?: string[];
}

interface FilterState {
  type: '' | 'income' | 'expense';
  tokenSymbol: string;
  startDate: string;
  endDate: string;
}

export function InvoiceHistory() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<FilterState>({
    type: '',
    tokenSymbol: '',
    startDate: '',
    endDate: '',
  });

  const loadInvoices = useCallback(() => {
    const records = storage.filterInvoices({
      type: filter.type || undefined,
      tokenSymbol: filter.tokenSymbol || undefined,
      startDate: filter.startDate ? new Date(filter.startDate).getTime() : undefined,
      endDate: filter.endDate ? new Date(filter.endDate).getTime() : undefined,
    });
    setInvoices(records);
  }, [filter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  return (
    <div className="mt-8">
      <div className="mb-8 bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-2xl p-6 shadow-lg backdrop-blur-lg border border-white/20">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
                <span>类型</span>
              </div>
            </label>
            <div className="relative">
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value as FilterState['type'] })}
                className="block w-full pl-3 pr-10 py-2.5 text-base border-0 rounded-xl bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all duration-200 hover:bg-white"
              >
                <option value="">所有类型</option>
                <option value="income">收入</option>
                <option value="expense">支出</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                <span>代币符号</span>
              </div>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ETH, USDT..."
                value={filter.tokenSymbol}
                onChange={(e) => setFilter({ ...filter, tokenSymbol: e.target.value })}
                className="block w-full pl-3 pr-10 py-2.5 text-base border-0 rounded-xl bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all duration-200 hover:bg-white"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM4.46 4.46a6 6 0 119.08 7.79l2.12 2.12a1 1 0 11-1.42 1.42l-2.12-2.12A6 6 0 014.46 4.46z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span>开始日期</span>
              </div>
            </label>
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
              className="block w-full pl-3 pr-10 py-2.5 text-base border-0 rounded-xl bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all duration-200 hover:bg-white"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span>结束日期</span>
              </div>
            </label>
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
              className="block w-full pl-3 pr-10 py-2.5 text-base border-0 rounded-xl bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all duration-200 hover:bg-white"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setFilter({
              type: '',
              tokenSymbol: '',
              startDate: '',
              endDate: '',
            })}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            重置筛选
          </button>
        </div>
      </div>

      <div className="overflow-hidden bg-white shadow sm:rounded-xl border border-gray-100">
        <ul role="list" className="divide-y divide-gray-200">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="hover:bg-gray-50 transition-colors duration-150">
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="truncate">
                    <div className="flex text-sm">
                      <p className="font-medium text-indigo-600 truncate">
                        {invoice.customerName} - {invoice.amount} {invoice.tokenSymbol}
                      </p>
                    </div>
                    <div className="mt-2 flex">
                      <div className="flex items-center text-sm text-gray-500">
                        <p>{invoice.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-2 flex flex-shrink-0">
                    <p className="text-sm text-gray-500">
                      {format(invoice.date, 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                </div>
                {invoice.tags && invoice.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {invoice.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 