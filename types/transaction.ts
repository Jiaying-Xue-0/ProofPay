export interface Transaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  chain: 'ethereum' | 'solana';
  contractAddress?: string;
  decimals?: number;
} 