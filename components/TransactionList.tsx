import { Transaction } from '../types/transaction';
import { useAccount } from 'wagmi';
import { getExplorerUrl } from '@/utils/explorer';
import { shortenAddress } from '@/utils/address';
// Import ethers for handling large numbers and formatting ETH
import { ethers } from 'ethers';
import { useWalletStore } from '../store/walletStore';

interface TransactionListProps {
  transactions: Transaction[];
  onSelectTransaction: (transaction: Transaction) => void;
  type: 'income' | 'expense';
}

// Helper function to format token amounts based on decimals
const formatTokenAmount = (amount: string, tokenSymbol: string, decimals?: number): string => {
  try {
    if (decimals === undefined) {
      console.warn(`No decimals provided for ${tokenSymbol}. Displaying raw amount.`);
      return amount;
    }

    return ethers.utils.formatUnits(amount, decimals);
  } catch (error) {
    console.error(`Error formatting amount ${amount} for token ${tokenSymbol} with decimals ${decimals}:`, error);
    return amount; // Return raw amount on error
  }
};

export function TransactionList({
  transactions,
  onSelectTransaction,
  type,
}: TransactionListProps) {
  const { address } = useAccount();
  const { currentConnectedWallet } = useWalletStore();

  // 根据当前连接的钱包地址过滤交易
  const filteredTransactions = transactions.filter((tx) => {
    const walletAddress = currentConnectedWallet || address;
    if (!walletAddress) return false;

    if (type === 'income') {
      return tx.to.toLowerCase() === walletAddress.toLowerCase();
    } else {
      return tx.from.toLowerCase() === walletAddress.toLowerCase();
    }
  });

  // 在同一类型内去重：使用 Set 来存储已经看到的交易哈希和类型组合
  const seenHashesWithType = new Set<string>();
  const uniqueTransactions = filteredTransactions.filter(tx => {
    const hashWithType = `${tx.hash}-${type}`;
    if (seenHashesWithType.has(hashWithType)) {
      return false;
    }
    seenHashesWithType.add(hashWithType);
    return true;
  });

  if (!address) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">请连接钱包以查看交易记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          交易记录
        </h2>
      </div>

      <div className="space-y-4">
        {uniqueTransactions.map((tx) => (
          <div
            key={`${tx.hash}-${type}-${tx.timestamp}`}
            className="group relative bg-white/80 backdrop-blur-lg rounded-xl p-5 shadow-sm border border-gray-100 hover:border-indigo-100 hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer"
            onClick={() => onSelectTransaction(tx)}
          >
            {/* 背景装饰 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${
                    type === 'income' 
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-emerald-700'
                      : 'bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700'
                  }`}>
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      {type === 'income' ? (
                        <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span>{type === 'income' ? '收到' : '支付'}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(tx.timestamp * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      {formatTokenAmount(tx.value, tx.tokenSymbol, tx.decimals)} {tx.tokenSymbol}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-600">
                      {type === 'income' ? '从' : '至'} {shortenAddress(type === 'income' ? tx.from : tx.to)}
                    </span>
                  </div>
                  {tx.contractAddress && (
                    <p className="mt-1 text-xs text-gray-500">
                      合约地址: {shortenAddress(tx.contractAddress)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(getExplorerUrl(tx), '_blank');
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                >
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                  查看详情
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTransaction(tx);
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow"
                >
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  生成凭证
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 