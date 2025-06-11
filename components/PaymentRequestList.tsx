import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useWalletStore } from '../store/walletStore';
import useSWR from 'swr';
import { db, DbPaymentRequest } from '../services/db';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Dialog } from '@headlessui/react';
import Link from 'next/link';

interface PaymentRequestListProps {
  onCreateRequest?: () => void;
}

export function PaymentRequestList({ onCreateRequest }: PaymentRequestListProps) {
  const { currentConnectedWallet } = useWalletStore();
  const [selectedRequest, setSelectedRequest] = useState<DbPaymentRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // 获取支付请求数据
  const { data: requests, isLoading } = useSWR<DbPaymentRequest[]>(
    currentConnectedWallet ? ['payment_requests', currentConnectedWallet] : null,
    async () => {
      const { data, error } = await db.getPaymentRequests({ requesterAddress: currentConnectedWallet || '' });
      if (error) throw error;
      return data;
    }
  );

  const handleCopyLink = async (id: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopySuccess(id);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleViewDetails = (request: DbPaymentRequest) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  const getExpirationStatus = (expiresAt: string) => {
    const expireDate = new Date(expiresAt);
    if (isPast(expireDate)) {
      return { status: 'expired', text: '已过期' };
    }
    return {
      status: 'active',
      text: `${formatDistanceToNow(expireDate, { locale: zhCN })}后过期`
    };
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center space-x-2">
          <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">加载中...</span>
        </div>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-12">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCreateRequest}
          className="max-w-sm mx-auto cursor-pointer"
        >
          <div className="bg-white/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-100 shadow-sm hover:border-purple-200 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">暂无收款请求</h3>
            <p className="text-sm text-gray-500">
              点击"发起收款请求"创建你的第一个收款请求
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        {requests.map((request) => (
          <motion.div
            key={request.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:border-purple-200 transition-colors duration-200"
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      request.status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : request.status === 'expired'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {request.status === 'paid' ? '已支付' : request.status === 'expired' ? '已过期' : '待支付'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {format(request.created_at, 'yyyy-MM-dd HH:mm')}
                    </span>
                    {request.status !== 'paid' && (
                      <span className={`text-sm ${
                        isPast(new Date(request.expires_at)) 
                          ? 'text-red-500' 
                          : 'text-gray-500'
                      }`}>
                        {getExpirationStatus(request.expires_at).text}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {request.customer_name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {request.description}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        {request.amount}
                      </span>
                      <span className="text-lg font-medium text-gray-600">
                        {request.token_symbol}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCopyLink(request.id, request.payment_link)}
                    className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-200"
                  >
                    <AnimatePresence mode="wait">
                      {copySuccess === request.id ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="flex items-center text-green-600"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>已复制</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="flex items-center text-gray-600"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>复制链接</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleViewDetails(request)}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    查看详情
                  </motion.button>
                </div>
              </div>
              {request.tags && request.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {request.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* 详情对话框 */}
      <Dialog
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden">
            {selectedRequest && (
              <div className="max-h-[85vh] overflow-y-auto">
                {/* 顶部渐变装饰条 */}
                <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500" />
                
                <div className="p-8">
                  <div className="border-b border-gray-100 pb-6 mb-6">
                    <Dialog.Title className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      收款请求详情
                    </Dialog.Title>
                  </div>

                  <div className="space-y-8">
                    {/* 基本信息 */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-500">客户名称</h4>
                      <p className="text-lg text-gray-900">{selectedRequest.customer_name}</p>
                    </div>

                    {/* 金额和状态 */}
                    <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl">
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">支付金额</h4>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                            {selectedRequest.amount}
                          </span>
                          <span className="text-xl text-gray-600">{selectedRequest.token_symbol}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          selectedRequest.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : selectedRequest.status === 'expired'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedRequest.status === 'paid' ? '已支付' : selectedRequest.status === 'expired' ? '已过期' : '待支付'}
                        </span>
                      </div>
                    </div>

                    {/* 时间信息 */}
                    <div className="grid grid-cols-2 gap-6 p-6 bg-gray-50 rounded-2xl">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-500">创建时间</span>
                        </div>
                        <p className="text-base text-gray-900">
                          {format(selectedRequest.created_at, 'yyyy-MM-dd HH:mm:ss')}
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-500">过期时间</span>
                        </div>
                        <div className="space-y-1">
                          <p className={`text-base ${
                            isPast(new Date(selectedRequest.expires_at))
                              ? 'text-red-500'
                              : 'text-gray-900'
                          }`}>
                            {format(new Date(selectedRequest.expires_at), 'yyyy-MM-dd HH:mm:ss')}
                          </p>
                          {selectedRequest.status !== 'paid' && (
                            <p className={`text-sm ${
                              isPast(new Date(selectedRequest.expires_at))
                                ? 'text-red-500 font-medium'
                                : 'text-gray-500'
                            }`}>
                              {getExpirationStatus(selectedRequest.expires_at).text}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 支付链接 */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-500">支付链接</h4>
                      <div className="relative flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
                        <div className="flex-1 font-mono text-sm text-gray-600 truncate">
                          {selectedRequest.payment_link}
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleCopyLink(selectedRequest.id, selectedRequest.payment_link)}
                          className="flex items-center px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                        >
                          <AnimatePresence mode="wait">
                            {copySuccess === selectedRequest.id ? (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                className="flex items-center text-green-600"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-sm">已复制</span>
                              </motion.div>
                            ) : (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                className="flex items-center text-gray-600"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm">复制</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </div>
                    </div>

                    {/* 描述和备注 */}
                    {(selectedRequest.description || selectedRequest.additional_notes) && (
                      <div className="space-y-4">
                        {selectedRequest.description && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-500">描述</h4>
                            <p className="text-gray-700">{selectedRequest.description}</p>
                          </div>
                        )}
                        {selectedRequest.additional_notes && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-500">额外备注</h4>
                            <p className="text-gray-700">{selectedRequest.additional_notes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 标签 */}
                    {selectedRequest.tags && selectedRequest.tags.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-500">标签</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedRequest.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsDetailOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200"
                      >
                        关闭
                      </motion.button>
                      <Link href={`/pay/${selectedRequest.id}`} passHref>
                        <motion.a
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/20 transition-all duration-200"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          前往支付页面
                        </motion.a>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
} 