import { Transaction } from '../types/transaction';

interface SignatureParams {
  walletAddress: string;
  amount: string;
  token: string;
  fromAddress: string;
  date: string;
  txHash: string;
}

export function generateSignatureMessage({
  walletAddress,
  amount,
  token,
  fromAddress,
  date,
  txHash,
}: SignatureParams): string {
  return `I confirm that I, the owner of wallet ${walletAddress}, received a payment of ${amount} ${token} from ${fromAddress} on ${date} (tx hash: ${txHash}).
Signed via ProofPay.`;
}

export function formatSignatureDisplay(signature: string): string {
  if (!signature) return '';
  // 只显示签名的前10个和后10个字符
  return `${signature.slice(0, 10)}...${signature.slice(-10)}`;
} 