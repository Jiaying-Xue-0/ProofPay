import { Transaction } from '../types/transaction';

interface SignatureMessageParams {
  walletAddress: string;
  amount: string;
  token: string;
  fromAddress: string;
  date: string;
  txHash: string;
  type?: 'income' | 'expense';
}

export function generateSignatureMessage({
  walletAddress,
  amount,
  token,
  fromAddress,
  date,
  txHash,
  type = 'income'
}: SignatureMessageParams): string {
  const templates = {
    income: `我确认在 ${date} 从钱包地址 ${fromAddress} 收到了 ${amount} ${token}。

交易哈希：${txHash}
签名钱包：${walletAddress}

此签名用于证明我是该笔收入的接收方。`,
    expense: `I confirm that I paid ${amount} ${token} from my wallet address ${fromAddress} on ${date}.

Transaction Hash: ${txHash}
Signing Wallet: ${walletAddress}

This signature proves that I am the payer of this expense.`
  };

  return templates[type];
}

export function formatSignatureDisplay(signature: string): string {
  if (!signature) return '';
  // 只显示签名的前10个和后10个字符
  return `${signature.slice(0, 10)}...${signature.slice(-10)}`;
} 