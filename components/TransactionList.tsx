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
        {filteredTransactions.map((tx) => (
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
                  {type === 'income' ? '收到' : '支付'} {formatTokenAmount(tx.value, tx.tokenSymbol, tx.decimals)} {tx.tokenSymbol}
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