import { Transaction } from '../types/transaction';

export const getExplorerUrl = (tx: Transaction): string => {
  // 默认使用以太坊主网浏览器
  return `https://etherscan.io/tx/${tx.hash}`;
}; 