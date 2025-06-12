'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useChainId, usePublicClient, useWriteContract, useConnect, useWalletClient } from 'wagmi';
import { readContract } from '@wagmi/core';
import { injected } from 'wagmi/connectors';
import { db } from '../../../services/db';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { shortenAddress } from '../../../utils/address';
import { ChainOption, TokenOption, SUPPORTED_CHAINS, SUPPORTED_TOKENS } from '../../../types/payment';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { parseUnits, formatUnits } from 'viem';
import type { Address, Hash } from 'viem';
import { watchAsset } from 'viem/actions';

interface PaymentRequest {
  id: string;
  created_at: string;
  updated_at: string;
  amount: string;
  token_symbol: string;
  token_address: string;
  chain_id: string;
  customer_name: string;
  description?: string;
  tags?: string[];
  additional_notes?: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  payment_link: string;
  requester_address: string;
  payer_address?: string;
  transaction_hash?: string;
  paid_at?: string;
  expires_at: string;
}

// 修改 ERC20_ABI 定义，支持所有 ERC20 代币包括 USDT
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'decimals', type: 'uint8' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'symbol', type: 'string' }]
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' }
    ],
    outputs: [] // 兼容 USDT 的无返回值情况
  }
] as const;

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  txHash: Hash;
  amount: string;
  tokenSymbol: string;
}

function PaymentSuccessModal({ isOpen, onClose, txHash, amount, tokenSymbol }: PaymentSuccessModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-lg p-8 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-xl"
          >
            {/* 成功图标 */}
            <div className="flex justify-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center"
              >
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>
            </div>

            {/* 标题和金额 */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-6"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-2">支付成功！</h3>
              <p className="text-lg text-gray-600">
                已支付 <span className="font-semibold text-purple-600">{amount}</span>{' '}
                <span className="font-semibold text-blue-600">{tokenSymbol}</span>
              </p>
            </motion.div>

            {/* 交易信息 */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white/80 rounded-xl p-4 mb-6"
            >
              <p className="text-sm text-gray-600 mb-2">交易哈希：</p>
              <p className="font-mono text-sm text-purple-600 break-all">{txHash}</p>
            </motion.div>

            {/* 按钮 */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex gap-4"
            >
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-all duration-200 transform hover:scale-105"
              >
                完成
              </button>
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-6 py-3 bg-white text-purple-600 font-medium rounded-xl border-2 border-purple-100 hover:border-purple-200 transition-all duration-200 transform hover:scale-105"
              >
                查看交易
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function PaymentRequestPage() {
  const params = useParams();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTxHash, setSuccessTxHash] = useState<Hash | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [copySuccess, setCopySuccess] = useState<'address' | 'amount' | null>(null);
  const { data: walletClient } = useWalletClient();

  // 使用 hook 获取代币余额
  const { data: tokenBalance } = useReadContract({
    address: paymentRequest?.token_address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as Address],
    query: {
      enabled: !!address && !!paymentRequest?.token_address && paymentRequest.token_address !== 'native'
    }
  });

  // 代币转账
  const { writeContractAsync } = useWriteContract();

  // 处理复制
  const handleCopy = async (type: 'address' | 'amount', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 处理支付
  const handlePay = async () => {
    try {
      setError(null);
      setIsPending(true);

      if (!paymentRequest) {
        throw new Error('支付信息不完整');
      }

      // 连接钱包
      await connect({ connector: injected() });
      
      if (!walletClient) {
        throw new Error('无法获取钱包客户端');
      }

      // 检查是否使用收款地址进行支付
      if (address?.toLowerCase() === paymentRequest.requester_address.toLowerCase()) {
        throw new Error('不能使用收款地址进行支付');
      }

      const isNativeToken = paymentRequest.token_address === 'native';
      const token = isNativeToken ? null : SUPPORTED_TOKENS.find(t => t.address.toLowerCase() === paymentRequest.token_address.toLowerCase());
      
      if (isNativeToken) {
        // 发送原生代币 (ETH/MATIC)
        const amount = parseUnits(paymentRequest.amount, 18); // 原生代币使用18位小数
        const hash = await walletClient.sendTransaction({
          to: paymentRequest.requester_address as Address,
          value: amount,
        });

        // 等待交易确认
        await publicClient?.waitForTransactionReceipt({ hash });

        // 更新支付状态
        await db.updatePaymentRequestStatus(paymentRequest.id, 'paid', address);
        
        // 更新本地状态
        setPaymentRequest(prev => prev ? { 
          ...prev, 
          status: 'paid',
          payer_address: address 
        } : null);
        
        // 显示成功对话框
        setSuccessTxHash(hash);
        setShowSuccessModal(true);
      } else {
        // 如果是 ERC20 代币
        if (!token) {
          throw new Error('不支持的代币');
        }

        try {
          // 准备支付参数
          const amount = parseUnits(paymentRequest.amount, token.decimals);

          // 直接发起转账，使用正确的代币合约地址
          const tx = await writeContractAsync({
            address: paymentRequest.token_address as Address,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [paymentRequest.requester_address as Address, amount],
            account: address as Address
          });

          // 等待交易确认
          await publicClient?.waitForTransactionReceipt({ hash: tx });

          // 更新支付状态
          await db.updatePaymentRequestStatus(paymentRequest.id, 'paid', address);
          
          // 更新本地状态
          setPaymentRequest(prev => prev ? { 
            ...prev, 
            status: 'paid',
            payer_address: address 
          } : null);
          
          // 显示成功对话框
          setSuccessTxHash(tx);
          setShowSuccessModal(true);
        } catch (err: any) {
          console.error('Error:', err);
          if (err.message?.includes('User rejected the request')) {
            // 用户拒绝了请求，不显示错误
            return;
          }
          throw err;
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : '支付失败，请重试');
    } finally {
      setIsPending(false);
    }
  };

  // 处理成功对话框关闭
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    // 确保状态已更新
    if (paymentRequest) {
      setPaymentRequest({ ...paymentRequest, status: 'paid' });
    }
  };

  // 生成支付二维码内容
  const getQRCodeContent = () => {
    if (!paymentRequest) return '';
    try {
      // 如果是原生代币（ETH/MATIC）
      if (paymentRequest.token_address === 'native') {
        const amountInWei = parseUnits(paymentRequest.amount, 18); // 原生代币使用18位小数
        return `ethereum:${paymentRequest.requester_address}?value=${amountInWei.toString()}`;
      }
      // 如果是ERC20代币
      const token = SUPPORTED_TOKENS.find(t => t.address.toLowerCase() === paymentRequest.token_address.toLowerCase());
      if (!token) return '';
      
      // 使用正确的 ERC20 转账格式
      const amountInWei = parseUnits(paymentRequest.amount, token.decimals);
      return `ethereum:${paymentRequest.token_address}/transfer?address=${paymentRequest.requester_address}&uint256=${amountInWei.toString()}`;
    } catch (err) {
      console.error('Error generating QR code content:', err);
      return '';
    }
  };

  // 检查是否是收款地址
  const isRequesterAddress = address?.toLowerCase() === paymentRequest?.requester_address.toLowerCase();

  useEffect(() => {
    const fetchPaymentRequest = async () => {
      try {
        const { data, error } = await db.getPaymentRequest(params.id as string);
        if (error) throw error;
        if (!data) throw new Error('支付请求不存在');
        setPaymentRequest(data);
      } catch (err) {
        console.error('Error fetching payment request:', err);
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchPaymentRequest();
    }
  }, [params.id]);

  // 添加倒计时效果
  useEffect(() => {
    if (!paymentRequest?.expires_at) return;

    const updateTimeLeft = () => {
      const expireDate = new Date(paymentRequest.expires_at);
      if (isPast(expireDate)) {
        setTimeLeft('已过期');
        return;
      }
      setTimeLeft(`${formatDistanceToNow(expireDate, { locale: zhCN })}后过期`);
    };

    updateTimeLeft();
    const timer = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [paymentRequest?.expires_at]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error || !paymentRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
          <p className="text-gray-500">{error || '支付请求不存在'}</p>
        </div>
      </div>
    );
  }

  const chain = SUPPORTED_CHAINS.find(c => c.id === paymentRequest.chain_id);
  const token = SUPPORTED_TOKENS.find(t => t.address === paymentRequest.token_address);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-8">
            {/* 标题和金额 */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
                支付请求
              </h1>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-4xl font-bold text-gray-900">{paymentRequest?.amount}</span>
                <span className="text-2xl font-semibold text-gray-600">{paymentRequest?.token_symbol}</span>
              </div>
              {paymentRequest?.customer_name && (
                <p className="mt-2 text-gray-500">来自 {paymentRequest.customer_name}</p>
              )}
            </div>

            {/* 支付信息 */}
            <div className="space-y-6">
              {/* 链和代币信息 */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">链</label>
                    <div className="flex items-center space-x-3 bg-white rounded-xl p-3 border border-gray-200">
                      <span className="text-gray-900">{chain?.name || paymentRequest.chain_id}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">代币</label>
                    <div className="flex items-center space-x-3 bg-white rounded-xl p-3 border border-gray-200">
                      {token?.logoURI && (
                        <img src={token.logoURI} alt={token.symbol} className="w-6 h-6 rounded-full" />
                      )}
                      <span className="text-gray-900">{token?.name || paymentRequest.token_symbol}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 过期时间信息 */}
              {paymentRequest.expires_at && (
                <div className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">过期时间</label>
                      <div className="text-gray-900">
                        {format(new Date(paymentRequest.expires_at), 'yyyy-MM-dd HH:mm:ss')}
                      </div>
                    </div>
                    <div className={`flex items-center px-4 py-2 rounded-xl ${
                      isPast(new Date(paymentRequest.expires_at))
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">{timeLeft}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 收款地址（更新显示方式） */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">收款地址</label>
                    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                      <div className="font-mono text-sm text-gray-600 break-all mr-4">
                        {paymentRequest.requester_address}
                      </div>
                      <button
                        onClick={() => handleCopy('address', paymentRequest.requester_address)}
                        className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                      >
                        {copySuccess === 'address' ? (
                          <>
                            <svg className="w-4 h-4 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            已复制
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            复制地址
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">支付金额</label>
                    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                          {paymentRequest.amount}
                        </span>
                        <span className="text-lg text-gray-600">
                          {paymentRequest.token_symbol}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy('amount', paymentRequest.amount)}
                        className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                      >
                        {copySuccess === 'amount' ? (
                          <>
                            <svg className="w-4 h-4 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            已复制
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            复制金额
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 描述和备注 */}
              {(paymentRequest.description || paymentRequest.additional_notes) && (
                <div className="bg-gray-50 rounded-2xl p-6">
                  {paymentRequest.description && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
                      <p className="text-gray-900">{paymentRequest.description}</p>
                    </div>
                  )}
                  {paymentRequest.additional_notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">额外备注</label>
                      <p className="text-gray-900">{paymentRequest.additional_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 标签 */}
              {paymentRequest.tags && paymentRequest.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {paymentRequest.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 二维码支付（更新二维码内容） */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <h3 className="text-sm font-medium text-gray-700 mb-4">扫码支付</h3>
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-2xl shadow-lg">
                    <QRCodeSVG
                      value={getQRCodeContent()}
                      size={200}
                      level="H"
                      includeMargin={true}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <p className="text-center text-sm text-gray-500 mt-4">
                  使用支持的钱包扫描二维码进行支付
                </p>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="rounded-xl bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 支付按钮 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePay}
                disabled={isPending || paymentRequest?.status !== 'pending' || isRequesterAddress}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {isPending ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>支付中...</span>
                  </div>
                ) : paymentRequest?.status === 'paid' ? (
                  '已支付'
                ) : paymentRequest?.status === 'expired' ? (
                  '已过期'
                ) : isRequesterAddress ? (
                  '不能使用收款地址支付'
                ) : (
                  '支付'
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 支付成功弹窗 */}
      {successTxHash && (
        <PaymentSuccessModal
          isOpen={showSuccessModal}
          onClose={handleSuccessModalClose}
          txHash={successTxHash}
          amount={paymentRequest?.amount || ''}
          tokenSymbol={paymentRequest?.token_symbol || ''}
        />
      )}
    </div>
  );
} 