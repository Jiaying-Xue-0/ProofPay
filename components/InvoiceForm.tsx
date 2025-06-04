import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Transaction } from '../types/transaction';
import { generatePDF } from '../utils/pdfGenerator';
import { generateDocumentId } from '../utils/documentId';
import { storage } from '../services/storage';
import { blockchain } from '../services/blockchain';
import { generateSignatureMessage } from '../utils/signature';
import { SignatureStatus } from '../types/storage';

const PREDEFINED_TAGS = [
  'Salary',
  'Service Fee',
  'Art Collaboration',
  'Development',
  'Consulting',
  'Others',
];

// 格式化 USDT 金额，保留 6 位小数，并进行单位转换
const formatUSDTAmount = (amount: string): string => {
  const num = parseFloat(amount);
  // USDT 合约金额需要除以 10^6 来得到实际金额
  return (num / 1000000).toFixed(6);
};

interface InvoiceFormProps {
  transaction: Transaction;
  type: 'invoice' | 'receipt';
  onClose: () => void;
}

export function InvoiceForm({ transaction, type, onClose }: InvoiceFormProps) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [formData, setFormData] = useState({
    customerName: '',
    customerAddress: '',
    description: '',
    additionalNotes: '',
    tags: [] as string[],
  });
  const [showShareLink, setShowShareLink] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureStatus, setSignatureStatus] = useState<SignatureStatus>('pending');

  const isIncome = transaction.to.toLowerCase() === address?.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setError(null);

      let signature: string | undefined;
      let signedMessage: string | undefined;

      // 如果是收入发票，需要先签名
      if (isIncome) {
        if (!address) {
          throw new Error('请先连接钱包');
        }

        const message = generateSignatureMessage({
          walletAddress: address,
          amount: formatUSDTAmount(transaction.value),
          token: transaction.tokenSymbol,
          fromAddress: transaction.from,
          date: new Date(transaction.timestamp * 1000).toLocaleDateString(),
          txHash: transaction.hash,
        });

        signature = await signMessageAsync({ message });
        signedMessage = message;

        // 验证签名
        const recoveredAddress = await blockchain.verifySignature(message, signature);
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          setSignatureStatus('mismatch');
          throw new Error('签名验证失败');
        }
        setSignatureStatus('signed');
      }

      const documentId = generateDocumentId(type);
      const date = new Date(transaction.timestamp * 1000).toISOString().split('T')[0];
      const amount = formatUSDTAmount(transaction.value);

      // 获取区块链交易详情
      const txDetails = await blockchain.getTransactionDetails(transaction.hash);

      if (!txDetails) {
        throw new Error('无法获取交易详情，请确保交易已确认');
      }

      // 保存到本地存储
      const savedDocument = storage.saveInvoice({
        documentId,
        transactionHash: transaction.hash,
        type,
        customerName: formData.customerName,
        customerAddress: formData.customerAddress,
        description: formData.description,
        amount,
        tokenSymbol: transaction.tokenSymbol,
        date: transaction.timestamp * 1000,
        from: transaction.from,
        to: transaction.to,
        additionalNotes: formData.additionalNotes,
        tags: formData.tags,
        signatureStatus: isIncome ? (signature ? 'signed' : 'pending') : 'unverifiable',
        signedBy: isIncome && signature ? address : undefined,
        signedAt: isIncome && signature ? new Date() : undefined,
        signature,
        signedMessage,
      });

      // 生成 PDF
      const doc = await generatePDF({
        type,
        documentId,
        date: new Date().toISOString().split('T')[0],
        customerName: formData.customerName,
        customerAddress: formData.customerAddress,
        from: transaction.from,
        to: transaction.to,
        amount,
        tokenSymbol: transaction.tokenSymbol,
        description: formData.description,
        tags: formData.tags,
        additionalNotes: formData.additionalNotes,
        transactionHash: transaction.hash,
        blockNumber: txDetails.blockNumber,
        transactionStatus: txDetails.status,
        issuer: 'ProofPay',
        chainId: Number(transaction.chain),
        signatureStatus: isIncome ? (signature ? 'signed' : 'pending') : 'unverifiable',
        signedBy: isIncome && signature ? address : undefined,
      });

      // 保存 PDF
      const fileName = `proofpay-${type}-${documentId}.pdf`;
      doc.save(fileName);

      // 生成分享链接
      const shareUrl = new URL(`/verify/${documentId}`, window.location.origin);
      setShareLink(shareUrl.toString());
      setShowShareLink(true);
    } catch (error) {
      console.error('Form submission error:', error);
      setError(error instanceof Error ? error.message : '发票生成失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto px-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="customerName"
          className="block text-sm font-medium text-gray-700"
        >
          客户名称
        </label>
        <input
          type="text"
          name="customerName"
          id="customerName"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 px-3"
          value={formData.customerName}
          onChange={(e) =>
            setFormData({ ...formData, customerName: e.target.value })
          }
        />
      </div>

      <div>
        <label
          htmlFor="customerAddress"
          className="block text-sm font-medium text-gray-700"
        >
          客户地址（可选）
        </label>
        <input
          type="text"
          name="customerAddress"
          id="customerAddress"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 px-3"
          value={formData.customerAddress}
          onChange={(e) =>
            setFormData({ ...formData, customerAddress: e.target.value })
          }
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          描述
        </label>
        <textarea
          name="description"
          id="description"
          required
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 min-h-[80px] resize-none"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          标签
        </label>
        <div className="flex flex-wrap gap-2">
          {PREDEFINED_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagToggle(tag)}
              className={`px-3 py-1 rounded-full text-sm ${
                formData.tags.includes(tag)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="additionalNotes"
          className="block text-sm font-medium text-gray-700"
        >
          额外备注
        </label>
        <textarea
          name="additionalNotes"
          id="additionalNotes"
          rows={2}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 min-h-[60px] resize-none"
          value={formData.additionalNotes}
          onChange={(e) =>
            setFormData({ ...formData, additionalNotes: e.target.value })
          }
        />
      </div>

      {isIncome && (
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">需要签名确认</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>生成收入发票需要您使用钱包签名，以证明您是此笔收入的接收方。</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShareLink && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <p className="text-sm font-medium text-gray-700 mb-2">分享链接：</p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={shareLink}
              className="flex-1 rounded-md border-gray-300 bg-white text-sm h-10 px-3"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(shareLink)}
              className="px-4 h-10 bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 text-sm"
            >
              复制
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 mt-8 pb-6">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {isLoading ? '处理中...' : `生成${type === 'invoice' ? '发票' : '收据'}`}
        </button>
      </div>
    </form>
  );
} 