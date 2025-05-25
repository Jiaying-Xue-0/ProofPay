import { useState } from 'react';
import { Transaction } from '../types/transaction';
import { useAccount } from 'wagmi';
import { getExplorerUrl } from '@/utils/explorer';
import { shortenAddress } from '@/utils/address';

interface TransactionListProps {
  transactions: Transaction[];
  onSelectTransaction: (transaction: Transaction) => void;
  type: 'income' | 'expense';
}

// 格式化 USDT 金额显示
const formatUSDTAmount = (amount: string): string => {
  const num = parseFloat(amount);
  return (num / 1000000).toFixed(6); // 除以 10^6 转换为实际金额
};

export function TransactionList({ transactions, onSelectTransaction, type }: TransactionListProps) {
  const { address } = useAccount();

  if (!address) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">请连接钱包以查看交易记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">交易记录</h2>
      </div>

      <div className="space-y-4">
        {transactions.map((tx) => (
          <div
            key={tx.hash}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelectTransaction(tx)}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">
                  {new Date(tx.timestamp * 1000).toLocaleString()}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {type === 'income' ? '收到' : '支付'} {formatUSDTAmount(tx.value)} {tx.tokenSymbol}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(getExplorerUrl(tx), '_blank');
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-sm"
                >
                  查看详情
                </button>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              <p>{type === 'income' ? '从' : '至'}: {shortenAddress(type === 'income' ? tx.from : tx.to)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 