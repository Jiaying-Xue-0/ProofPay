'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { db } from '../../../services/db';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { shortenAddress } from '../../../utils/address';
import { ChainOption, TokenOption, SUPPORTED_CHAINS, SUPPORTED_TOKENS } from '../../../types/payment';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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

export default function PaymentRequestPage() {
  const params = useParams();
  const { address } = useAccount();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

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

  const handlePay = async () => {
    if (!address || !paymentRequest) return;

    try {
      setIsLoading(true);
      // TODO: 实现支付逻辑
      // 1. 检查钱包是否连接到正确的链
      // 2. 检查代币余额是否足够
      // 3. 发起代币转账交易
      // 4. 等待交易确认
      // 5. 更新支付请求状态
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : '支付失败');
    } finally {
      setIsLoading(false);
    }
  };

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
                <span className="text-4xl font-bold text-gray-900">{paymentRequest.amount}</span>
                <span className="text-2xl font-semibold text-gray-600">{paymentRequest.token_symbol}</span>
              </div>
              {paymentRequest.customer_name && (
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

              {/* 收款地址 */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">收款地址</label>
                <div className="flex items-center space-x-3 bg-white rounded-xl p-3 border border-gray-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 p-[2px]">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <span className="block text-sm font-mono text-gray-900">
                      {shortenAddress(paymentRequest.requester_address)}
                    </span>
                    <span className="text-xs text-gray-500">收款人钱包地址</span>
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

              {/* 支付按钮 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePay}
                disabled={isLoading || paymentRequest.status !== 'pending'}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>处理中...</span>
                  </div>
                ) : paymentRequest.status === 'pending' ? (
                  '支付'
                ) : paymentRequest.status === 'paid' ? (
                  '已支付'
                ) : (
                  '已取消'
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 