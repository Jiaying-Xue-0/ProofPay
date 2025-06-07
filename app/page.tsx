'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { TransactionList } from '../components/TransactionList';
import { InvoiceForm } from '../components/InvoiceForm';
import { InvoiceHistory } from '../components/InvoiceHistory';
import { Transaction } from '../types/transaction';
import { blockchain } from '../services/blockchain';
import { Dialog } from '@headlessui/react';

export default function Home() {
  const { address, isConnected, chain } = useAccount();
  const [activeTab, setActiveTab] = useState('income');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState<'invoice' | 'receipt'>('invoice');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!address || !chain) return;

    setLoading(true);
    try {
      let network: 'ethereum' | 'polygon' | 'optimism' | 'arbitrum';
      
      // 根据当前链ID确定网络
      switch (chain.id) {
        case 1:
          network = 'ethereum';
          break;
        case 137:
          network = 'polygon';
          break;
        case 10:
          network = 'optimism';
          break;
        case 42161:
          network = 'arbitrum';
          break;
        default:
          console.error('Unsupported network');
          setTransactions([]);
          setLoading(false);
          return;
      }

      const txs = await blockchain.getTransactions(address, network);
      
      // 根据当前标签过滤交易
      const filteredTxs = txs.filter((tx) =>
        activeTab === 'income'
          ? tx.to.toLowerCase() === address.toLowerCase()
          : tx.from.toLowerCase() === address.toLowerCase()
      );

      setTransactions(filteredTxs);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    }
    setLoading(false);
  }, [address, chain, activeTab]);

  useEffect(() => {
    if (isConnected && address && !showHistory) {
      fetchTransactions();
    }
  }, [isConnected, address, chain, showHistory, fetchTransactions]);

  const handleTransactionSelect = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    // Set form type based on transaction direction
    const isIncoming = transaction.to.toLowerCase() === address?.toLowerCase();
    setFormType(isIncoming ? 'invoice' : 'receipt');
    setIsFormOpen(true);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">ProofPay</h1>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isConnected ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900">
              请连接钱包以开始使用 ProofPay
            </h2>
            <p className="mt-2 text-gray-600">
              连接钱包后可以查看交易记录并生成发票或收据
            </p>
          </div>
        ) : (
          <div>
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => {
                    setShowHistory(false);
                    setActiveTab('income');
                  }}
                  className={`${
                    !showHistory && activeTab === 'income'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  收入发票/收据
                </button>
                <button
                  onClick={() => {
                    setShowHistory(false);
                    setActiveTab('expense');
                  }}
                  className={`${
                    !showHistory && activeTab === 'expense'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  支出账单
                </button>
                <button
                  onClick={() => setShowHistory(true)}
                  className={`${
                    showHistory
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  历史记录
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="mt-6">
              {showHistory ? (
                <InvoiceHistory />
              ) : loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">加载中...</p>
                </div>
              ) : transactions.length > 0 ? (
                <TransactionList
                  transactions={transactions}
                  onSelectTransaction={handleTransactionSelect}
                  type={activeTab as 'income' | 'expense'}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">暂无交易记录</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invoice/Receipt Form Dialog */}
      <Dialog
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-xl rounded bg-white p-6">
            <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 mb-4">
              {formType === 'invoice' 
                ? '生成发票' 
                : (activeTab === 'expense' ? '生成支出凭证' : '生成收据')}
            </Dialog.Title>
            {selectedTransaction && (
              <InvoiceForm
                transaction={selectedTransaction}
                type={formType}
                onClose={() => setIsFormOpen(false)}
              />
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </main>
  );
}
