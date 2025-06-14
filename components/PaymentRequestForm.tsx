'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ChainOption, TokenOption, SUPPORTED_CHAINS, SUPPORTED_TOKENS, addCustomToken } from '../types/payment';
import { useWalletStore } from '../store/walletStore';
import { db } from '../services/db';
import { QRCodeSVG } from 'qrcode.react';
import { shortenAddress } from '../utils/address';
import { motion } from 'framer-motion';
import { supabase } from '../services/supabase';
import { ethers } from 'ethers';

interface PaymentRequestFormProps {
  onSubmit?: (data: {
    amount: string;
    tokenSymbol: string;
    customerName: string;
    customerAddress: string;
    description: string;
    tags: string[];
    additionalNotes: string;
  }) => Promise<void>;
}

const PREDEFINED_TAGS = [
  'Salary',
  'Service Fee',
  'Art Collaboration',
  'Development',
  'Consulting',
  'Others',
];

export function PaymentRequestForm({ onSubmit }: PaymentRequestFormProps) {
  const { address } = useAccount();
  const { currentConnectedWallet } = useWalletStore();
  const [selectedChain, setSelectedChain] = useState<ChainOption | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenOption | null>(null);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    customerName: '',
    description: '',
    tags: [] as string[],
    additionalNotes: '',
    expiresIn: '24', // 默认24小时
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<{
    id: string;
    payment_link: string;
    amount: string;
    token_symbol: string;
  } | null>(null);

  const handleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Error signing in:', err);
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    }
  };

  const getTokenInfo = async (contract: ethers.Contract) => {
    try {
      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => '未知代币'),
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.decimals().catch(() => 18)
      ]);
      return { name, symbol, decimals };
    } catch (err) {
      console.error('Error getting token info:', err);
      throw err;
    }
  };

  const handleAddCustomToken = async () => {
    if (!selectedChain || !customTokenAddress || !ethers.utils.isAddress(customTokenAddress)) {
      setError('请输入有效的代币地址');
      return;
    }

    try {
      setIsLoadingToken(true);
      setError(null);

      // 创建 ERC20 合约实例
      const provider = new ethers.providers.JsonRpcProvider(selectedChain.rpcUrl);
      const tokenContract = new ethers.Contract(
        customTokenAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function balanceOf(address) view returns (uint256)'
        ],
        provider
      );

      const tokenInfo = await getTokenInfo(tokenContract);
      
      // 添加自定义代币
      const customToken: Omit<TokenOption, 'logoURI'> = {
        address: customTokenAddress,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        chainId: parseInt(selectedChain.id),
      };

      addCustomToken(customToken);
      setSelectedToken(customToken);
      setCustomTokenAddress('');
      console.log('Successfully added token:', customToken);
    } catch (err) {
      console.error('Error adding custom token:', err);
      setError(err instanceof Error ? err.message : '无法加载代币信息，请确保地址正确');
    } finally {
      setIsLoadingToken(false);
    }
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

      if (!currentConnectedWallet) {
        throw new Error('请先连接钱包');
      }

      // 验证金额
      if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
        throw new Error('请输入有效的金额');
      }

      // 计算过期时间
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(formData.expiresIn));

      // 创建支付请求，直接使用用户输入的金额字符串，不做任何转换
      const { data, error: dbError } = await db.createPaymentRequest({
        amount: formData.amount,
        token_symbol: selectedToken.symbol,
        token_address: selectedToken.address === '0x0000000000000000000000000000000000000000' ? 'native' : selectedToken.address,
        chain_id: selectedChain.id,
        customer_name: formData.customerName,
        description: formData.description,
        tags: formData.tags,
        additional_notes: formData.additionalNotes,
        requester_address: currentConnectedWallet,
        expires_at: expiresAt.toISOString()
      });

      if (dbError) throw dbError;
      if (!data) throw new Error('创建支付请求失败');

      setPaymentRequest({
        id: data.id,
        payment_link: data.payment_link,
        amount: formData.amount,
        token_symbol: selectedToken.symbol,
      });
    } catch (err) {
      console.error('Form submission error:', err);
      setError(err instanceof Error ? err.message : '提交失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!paymentRequest?.payment_link) return;
    try {
      await navigator.clipboard.writeText(paymentRequest.payment_link);
      // 使用 toast 通知而不是 alert
      // toast.success('链接已复制到剪贴板');
    } catch (err) {
      console.error('Failed to copy link:', err);
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
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSignIn}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity duration-200"
          >
            使用 Google 登录
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (paymentRequest) {
  return (
    <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-blue-50 opacity-50" />
          <div className="relative p-8">
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-400 to-blue-500 p-[2px]"
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </motion.div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                收款请求已创建
              </h2>
              <div className="mt-4 flex items-center justify-center space-x-2">
                <span className="text-3xl font-bold text-gray-900">{paymentRequest.amount}</span>
                <span className="text-2xl font-semibold text-gray-600">{paymentRequest.token_symbol}</span>
              </div>
            </div>

            <div className="flex justify-center mb-8">
              <div className="p-4 bg-white rounded-2xl shadow-lg">
                <QRCodeSVG
                  value={paymentRequest.payment_link}
                  size={200}
                  level="H"
                  includeMargin={true}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-4">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100"
              >
                <span className="text-sm font-mono text-gray-600 truncate flex-1 mr-4">
                  {paymentRequest.payment_link}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center space-x-2 px-4 py-2 bg-white rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors duration-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>复制链接</span>
                </button>
              </motion.div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setPaymentRequest(null);
                  setFormData({
                    amount: '',
                    customerName: '',
                    description: '',
                    tags: [],
                    additionalNotes: '',
                    expiresIn: '24',
                  });
                  setSelectedChain(null);
                  setSelectedToken(null);
                }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity duration-200"
                >
                创建新的收款请求
                </motion.button>
            </div>
          </div>
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
            创建收款请求
            </h2>
          <p className="mt-2 text-gray-500">填写以下信息创建新的收款请求</p>
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
                    const chain = SUPPORTED_CHAINS.find((c: ChainOption) => c.id === e.target.value);
                      setSelectedChain(chain || null);
                      setSelectedToken(null);
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
                  >
                    <option value="">请选择</option>
                  {SUPPORTED_CHAINS.map((chain: ChainOption) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </motion.div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">选择代币</label>
                <motion.div whileHover={{ scale: 1.02 }} className="relative">
                  <select
                    value={selectedToken?.address || ''}
                    onChange={(e) => {
                    const token = SUPPORTED_TOKENS.find((t: TokenOption) => t.address === e.target.value);
                      setSelectedToken(token || null);
                    }}
                    disabled={!selectedChain}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">请选择</option>
                  {SUPPORTED_TOKENS.filter((token: TokenOption) => {
                      const selectedChainId = selectedChain ? parseInt(selectedChain.id) : 0;
                      return token.chainId === selectedChainId;
                  }).map((token: TokenOption) => (
                      <option key={token.address} value={token.address}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
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
            <label className="block text-sm font-medium text-gray-700">描述</label>
              <motion.div whileHover={{ scale: 1.02 }}>
                <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="添加付款说明..."
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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">过期时间</label>
            <motion.div whileHover={{ scale: 1.02 }}>
              <select
                value={formData.expiresIn}
                onChange={(e) => setFormData({ ...formData, expiresIn: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
              >
                <option value="1">1小时</option>
                <option value="2">2小时</option>
                <option value="4">4小时</option>
                <option value="8">8小时</option>
                <option value="12">12小时</option>
                <option value="24">24小时</option>
                <option value="48">48小时</option>
                <option value="72">72小时</option>
                <option value="168">7天</option>
              </select>
            </motion.div>
          </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">收款地址</label>
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
                <div>
                  <span className="block text-sm font-mono text-gray-900">
                    {shortenAddress(currentConnectedWallet)}
                  </span>
                  <span className="text-xs text-gray-500">当前连接的钱包地址</span>
                </div>
              </div>
            </div>

          {/* 添加自定义代币部分 */}
          {selectedChain && (
            <div className="relative p-8 border-t border-gray-100">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">添加自定义代币</h3>
                <div className="flex space-x-4">
                  <input
                    type="text"
                    value={customTokenAddress}
                    onChange={(e) => setCustomTokenAddress(e.target.value)}
                    placeholder="输入代币合约地址"
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddCustomToken}
                    disabled={isLoadingToken || !customTokenAddress}
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingToken ? (
                      <div className="flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                        <span>加载中...</span>
                  </div>
                    ) : '添加代币'}
                  </motion.button>
                </div>
              </div>
            </div>
            )}

            <div className="pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>创建中...</span>
                  </div>
              ) : '发起收款请求'}
              </motion.button>
            </div>
          </div>
        </motion.form>
    </div>
  );
} 