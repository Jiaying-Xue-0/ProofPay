'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ChainOption, TokenOption, SUPPORTED_CHAINS, SUPPORTED_TOKENS } from '../types/payment';
import { useWalletStore } from '../store/walletStore';
import { db } from '../services/db';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { SignatureStatus } from '../types/storage';
import { generatePDF } from '../utils/pdfGenerator';

const PREDEFINED_TAGS = [
  'Consulting',
  'Development',
  'Design',
  'Marketing',
  'Content Creation',
  'Others',
];

interface FormData {
  amount: string;
  customerName: string;
  customerAddress: string;
  description: string;
  tags: string[];
  additionalNotes: string;
  dueDate: string;
  receiverAddress: string;
}

interface InvoiceState {
  id: string;
  payment_link: string;
  amount: string;
  token_symbol: string;
  signatureStatus: SignatureStatus;
}

export function PrePaymentInvoiceForm() {
  const { address } = useAccount();
  const { currentConnectedWallet } = useWalletStore();
  const [selectedChain, setSelectedChain] = useState<ChainOption | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenOption | null>(null);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    amount: '',
    customerName: '',
    customerAddress: '',
    description: '',
    tags: [],
    additionalNotes: '',
    dueDate: '',
    receiverAddress: currentConnectedWallet || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceState | null>(null);

  const { signMessageAsync, status: signatureStatus } = useSignMessage();
  const isSignatureLoading = signatureStatus === 'pending';

  const generateSignatureMessage = (data: {
    documentId: string;
    amount: string;
    tokenSymbol: string;
    receiverAddress: string;
  }) => {
    return `Pre-Payment Invoice Signature Request

I hereby confirm that I am issuing a pre-payment invoice with the following details:

Invoice ID: ${data.documentId}
Amount: ${data.amount} ${data.tokenSymbol}
Receiver Address: ${data.receiverAddress}
Issue Date: ${new Date().toISOString()}

By signing this message, I certify that I am the authorized issuer of this invoice and the information provided is accurate and true.

This signature will be stored on-chain as proof of invoice authenticity.`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setError(null);

      if (!address) {
        throw new Error('请先连接钱包');
      }

      if (!selectedChain || !selectedToken) {
        throw new Error('请选择链和代币');
      }

      if (!formData.receiverAddress || !ethers.utils.isAddress(formData.receiverAddress)) {
        throw new Error('请输入有效的收款钱包地址');
      }

      // 验证金额
      if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
        throw new Error('请输入有效的金额');
      }

      // 验证到期日期
      if (!formData.dueDate) {
        throw new Error('请选择付款截止日期');
      }

      const dueDate = new Date(formData.dueDate);
      if (dueDate < new Date()) {
        throw new Error('付款截止日期不能早于当前时间');
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const documentId = `INC-${year}${month}${day}-${random}`;

      // 先进行签名
      const message = generateSignatureMessage({
        documentId,
        amount: formData.amount,
        tokenSymbol: selectedToken.symbol,
        receiverAddress: formData.receiverAddress
      });

      const signature = await signMessageAsync({ message });

      // 创建支付请求
      const paymentRequest = {
        id: documentId,
        requester_address: formData.receiverAddress,
        amount: formData.amount,
        token_address: selectedToken.address,
        token_symbol: selectedToken.symbol,
        chain_id: selectedChain.id,
        description: formData.description,
        expires_at: formData.dueDate,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        invoice_type: 'pre_payment_invoice',
        customer_name: formData.customerName,
        customer_address: formData.customerAddress,
        additional_notes: formData.additionalNotes
      };

      // 保存支付请求并获取返回的数据（包含payment_link）
      const { data: savedPaymentRequest, error } = await db.createPaymentRequest(paymentRequest);
      
      if (error || !savedPaymentRequest) {
        throw new Error('创建支付请求失败');
      }

      // 创建发票（包含签名信息）
      const invoiceData = {
        documentId,
        type: 'income' as const,
        date: Date.now(),
        customerName: formData.customerName,
        customerAddress: formData.customerAddress,
        from: address,
        to: formData.receiverAddress,
        amount: formData.amount,
        tokenSymbol: selectedToken.symbol,
        decimals: selectedToken.decimals,
        description: formData.description,
        tags: formData.tags,
        additionalNotes: formData.additionalNotes,
        transactionHash: '',
        signatureStatus: 'signed' as const,
        invoiceType: 'pre_payment_invoice' as const,
        status: 'unpaid' as const,
        paymentLink: savedPaymentRequest.payment_link,
        dueDate: formData.dueDate,
        updatedAt: new Date().toISOString(),
      };

      // 保存发票和签名信息
      const savedInvoice = await db.saveInvoiceWithSignature(
        invoiceData,
        signature,
        message,
        address
      );

      // 生成并下载 PDF
      const doc = await generatePDF({
        type: 'income',
        documentId,
        date: new Date().toISOString(),
        customerName: formData.customerName,
        customerAddress: formData.customerAddress,
        from: address,
        to: formData.receiverAddress,
        amount: formData.amount,
        tokenSymbol: selectedToken.symbol,
        decimals: selectedToken.decimals,
        description: formData.description,
        tags: formData.tags,
        additionalNotes: formData.additionalNotes,
        transactionHash: '',
        blockNumber: 0,
        transactionStatus: 'pending',
        issuer: 'ProofPay',
        chainId: Number(selectedChain.id),
        signatureStatus: 'signed',
        signedBy: address,
        invoiceType: 'pre_payment_invoice',
        status: 'unpaid',
        paymentLink: savedPaymentRequest.payment_link,
        dueDate: formData.dueDate,
        explorerLink: ''
      });

      // 保存 PDF
      const fileName = `proofpay-invoice-${documentId}.pdf`;
      doc.save(fileName);
      
      // 更新状态
      setInvoice({
        id: documentId,
        payment_link: savedPaymentRequest.payment_link,
        amount: formData.amount,
        token_symbol: selectedToken.symbol,
        signatureStatus: 'signed'
      });
      
      // 重置表单
      setFormData({
        amount: '',
        customerName: '',
        customerAddress: '',
        description: '',
        tags: [],
        additionalNotes: '',
        dueDate: '',
        receiverAddress: currentConnectedWallet || '',
      });
      setSelectedChain(null);
      setSelectedToken(null);

    } catch (err) {
      console.error('Form submission error:', err);
      setError(err instanceof Error ? err.message : '提交失败，请重试');
      setInvoice(prev => prev ? {
        ...prev,
        signatureStatus: 'mismatch'
      } : null);
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

  if (!currentConnectedWallet) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
          <p className="text-gray-600 text-lg mb-4">请先连接钱包</p>
        </motion.div>
      </div>
    );
  }

  if (invoice) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-400 to-blue-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            发票创建成功
          </h2>
          <p className="text-gray-600 mb-8">
            您可以在历史记录中查看和下载发票
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setInvoice(null)}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity duration-200"
          >
            创建新发票
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <motion.form 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="relative bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-blue-50 opacity-50" />
        
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            开具发票
          </h2>
          <p className="mt-2 text-gray-500">填写以下信息创建预付款发票</p>
        </div>

        {/* Form Content */}
        <div className="relative p-8 space-y-6">
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

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">选择链</label>
              <motion.div whileHover={{ scale: 1.02 }} className="relative">
                <select
                  value={selectedChain?.id || ''}
                  onChange={(e) => {
                    const chain = SUPPORTED_CHAINS.find(c => c.id === e.target.value);
                    setSelectedChain(chain || null);
                    setSelectedToken(null);
                  }}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
                >
                  <option value="">请选择</option>
                  {SUPPORTED_CHAINS.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </motion.div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">选择代币</label>
              <motion.div whileHover={{ scale: 1.02 }} className="relative">
                <select
                  value={selectedToken?.address || ''}
                  onChange={(e) => {
                    const token = SUPPORTED_TOKENS.find(t => t.address === e.target.value);
                    setSelectedToken(token || null);
                  }}
                  disabled={!selectedChain}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
                >
                  <option value="">请选择</option>
                  {SUPPORTED_TOKENS.filter(token => {
                    const selectedChainId = selectedChain ? parseInt(selectedChain.id) : 0;
                    return token.chainId === selectedChainId;
                  }).map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </motion.div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">金额</label>
            <motion.div whileHover={{ scale: 1.02 }} className="relative">
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                step="any"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
              />
              {selectedToken && (
                <div className="absolute inset-y-0 right-0 flex items-center px-4">
                  <span className="text-gray-500">{selectedToken.symbol}</span>
                </div>
              )}
            </motion.div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">收款钱包地址</label>
            <div className="flex items-center space-x-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 p-[2px]">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.receiverAddress}
                  onChange={(e) => setFormData({ ...formData, receiverAddress: e.target.value })}
                  placeholder="输入收款钱包地址"
                  className="w-full bg-transparent border-none focus:outline-none focus:ring-0 font-mono text-sm"
                />
                <span className="text-xs text-gray-500">当前连接的钱包地址</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">客户名称</label>
            <motion.div whileHover={{ scale: 1.02 }}>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="请输入客户名称"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
              />
            </motion.div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">客户地址</label>
            <motion.div whileHover={{ scale: 1.02 }}>
              <input
                type="text"
                value={formData.customerAddress}
                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                placeholder="请输入客户地址（可选）"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
              />
            </motion.div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">付款截止日期</label>
            <motion.div whileHover={{ scale: 1.02 }}>
              <input
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
              />
            </motion.div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">描述</label>
            <motion.div whileHover={{ scale: 1.02 }}>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="添加发票说明..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 resize-none"
              />
            </motion.div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">标签</label>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_TAGS.map((tag) => (
                <motion.button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-3 py-1 rounded-full text-sm ${
                    formData.tags.includes(tag)
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">额外备注</label>
            <motion.div whileHover={{ scale: 1.02 }}>
              <textarea
                value={formData.additionalNotes}
                onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                placeholder="额外备注..."
                rows={2}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 resize-none"
              />
            </motion.div>
          </div>

          <div className="pt-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading || isSignatureLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading || isSignatureLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{isSignatureLoading ? '等待签名...' : '创建中...'}</span>
                </div>
              ) : '开具发票'}
            </motion.button>
          </div>
        </div>
      </motion.form>
    </div>
  );
} 