import { useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { format } from 'date-fns';
import { generatePDF } from '../utils/pdfGenerator';
import { blockchain } from '../services/blockchain';
import { Dialog } from '@headlessui/react';
import { useWalletStore } from '../store/walletStore';
import { shortenAddress } from '../utils/address';
import { QRCodeSVG } from 'qrcode.react';
import { createWalletConnectSession } from '../utils/walletConnect';
import { WalletSwitchingOverlay } from './WalletSwitchingOverlay';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';

interface Invoice {
  id: string;
  documentId: string;
  type: 'income' | 'expense';
  customerName: string;
  customerAddress?: string;
  amount: string;
  tokenSymbol: string;
  description: string;
  date: number;
  tags?: string[];
  transactionHash: string;
  from: string;
  to: string;
  additionalNotes?: string;
  blockNumber?: number;
  signatureStatus: 'pending' | 'signed' | 'mismatch' | 'unverifiable';
  signedBy?: string;
  decimals: number;
}

interface FilterState {
  type: '' | 'income' | 'expense';
  tokenSymbol: string;
  startDate: string;
  endDate: string;
}

// 格式化金额的辅助函数
const formatAmount = (amount: string, decimals: number): string => {
  try {
    return ethers.utils.formatUnits(amount, decimals);
  } catch (error) {
    console.error('Error formatting amount:', error);
    return amount;
  }
};

export function InvoiceHistory() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<FilterState>({
    type: '',
    tokenSymbol: '',
    startDate: '',
    endDate: '',
  });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

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

  const handleDownload = async (invoice: Invoice) => {
    try {
      setLoadingStates(prev => ({ ...prev, [invoice.id]: true }));
      setError(null);

      const txDetails = await blockchain.getTransactionDetails(invoice.transactionHash);

      if (!txDetails) {
        throw new Error('无法获取交易详情');
      }

      const doc = await generatePDF({
        type: invoice.type,
        documentId: invoice.documentId,
        date: new Date(invoice.date).toISOString().split('T')[0],
        customerName: invoice.customerName,
        customerAddress: invoice.customerAddress,
        from: invoice.from,
        to: invoice.to,
        amount: invoice.amount,
        tokenSymbol: invoice.tokenSymbol,
        description: invoice.description,
        tags: invoice.tags || [],
        additionalNotes: invoice.additionalNotes,
        transactionHash: invoice.transactionHash,
        blockNumber: txDetails.blockNumber,
        transactionStatus: txDetails.status,
        issuer: 'ProofPay',
        chainId: Number(txDetails.chainId),
        signatureStatus: invoice.signatureStatus,
        signedBy: invoice.signedBy,
      });

      const fileName = `proofpay-${invoice.type}-${invoice.documentId}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : '下载失败，请重试');
    } finally {
      setLoadingStates(prev => ({ ...prev, [invoice.id]: false }));
    }
  };

  const handlePreview = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsPreviewOpen(true);
  };

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

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="group relative bg-white/80 backdrop-blur-lg rounded-xl p-5 shadow-sm border border-gray-100 hover:border-indigo-100 hover:shadow-md transition-all duration-300 overflow-hidden"
          >
            {/* 背景装饰 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${
                    invoice.type === 'income' 
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-emerald-700'
                      : 'bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700'
                  }`}>
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      {invoice.type === 'income' ? (
                        <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span>{invoice.type === 'income' ? '收入' : '支出'}</span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">{invoice.customerName}</h3>
                  <span className="text-sm text-gray-500">
                    {format(invoice.date, 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-600 line-clamp-1">{invoice.description}</p>
                  <div className="mt-1.5 flex items-center space-x-2">
                    <span className="text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      {formatAmount(invoice.amount, invoice.decimals)} {invoice.tokenSymbol}
                    </span>
                    {invoice.tags && invoice.tags.length > 0 && (
                      <>
                        <span className="text-gray-300">•</span>
                        <div className="flex items-center space-x-1.5">
                          {invoice.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePreview(invoice)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                >
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  查看
                </button>
                <button
                  onClick={() => handleDownload(invoice)}
                  disabled={loadingStates[invoice.id]}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow"
                >
                  {loadingStates[invoice.id] ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      下载中
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      下载
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-3xl w-full rounded-2xl bg-white/95 backdrop-blur-xl p-6 shadow-xl border border-white/20">
            <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 mb-4">
              凭证详情
            </Dialog.Title>
            {selectedInvoice && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-gray-500">凭证编号</h4>
                    <p className="text-sm text-gray-900 font-mono">{selectedInvoice.documentId}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-gray-500">日期</h4>
                    <p className="text-sm text-gray-900">
                      {format(selectedInvoice.date, 'yyyy-MM-dd HH:mm:ss')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-gray-500">客户名称</h4>
                    <p className="text-sm text-gray-900">{selectedInvoice.customerName}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-gray-500">金额</h4>
                    <p className="text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      {formatAmount(selectedInvoice.amount, selectedInvoice.decimals)} {selectedInvoice.tokenSymbol}
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <h4 className="text-sm font-medium text-gray-500">描述</h4>
                    <p className="text-sm text-gray-900">{selectedInvoice.description}</p>
                  </div>
                  {selectedInvoice.additionalNotes && (
                    <div className="col-span-2 space-y-1">
                      <h4 className="text-sm font-medium text-gray-500">备注</h4>
                      <p className="text-sm text-gray-900">{selectedInvoice.additionalNotes}</p>
                    </div>
                  )}
                  <div className="col-span-2 space-y-1">
                    <h4 className="text-sm font-medium text-gray-500">交易哈希</h4>
                    <p className="text-sm font-mono text-gray-900 break-all">{selectedInvoice.transactionHash}</p>
                  </div>
                </div>
                <div className="mt-8 flex justify-end space-x-3">
                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                  >
                    关闭
                  </button>
                  <button
                    onClick={() => {
                      handleDownload(selectedInvoice);
                      setIsPreviewOpen(false);
                    }}
                    disabled={loadingStates[selectedInvoice.id]}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 border border-transparent rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow"
                  >
                    {loadingStates[selectedInvoice.id] ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 inline-block h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        下载中...
                      </>
                    ) : '下载 PDF'}
                  </button>
                </div>
              </div>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
} 