import { useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  type: 'invoice' | 'receipt';
  customerName: string;
  amount: string;
  tokenSymbol: string;
  description: string;
  date: number;
  tags?: string[];
}

interface FilterState {
  type: '' | 'invoice' | 'receipt';
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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value as FilterState['type'] })}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">所有类型</option>
          <option value="invoice">发票</option>
          <option value="receipt">收据</option>
        </select>

        <input
          type="text"
          placeholder="代币符号"
          value={filter.tokenSymbol}
          onChange={(e) => setFilter({ ...filter, tokenSymbol: e.target.value })}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />

        <input
          type="date"
          value={filter.startDate}
          onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />

        <input
          type="date"
          value={filter.endDate}
          onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="overflow-hidden bg-white shadow sm:rounded-md">
        <ul role="list" className="divide-y divide-gray-200">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
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
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
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