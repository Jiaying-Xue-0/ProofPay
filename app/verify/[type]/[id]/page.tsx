'use client';

import { useEffect, useState } from 'react';
import { storage } from '@/services/storage';
import { blockchain, TransactionDetails } from '@/services/blockchain';
import { InvoiceRecord } from '@/types/storage';
import Link from 'next/link';

export default function VerifyPage({
  params,
}: {
  params: { type: string; id: string };
}) {
  const [document, setDocument] = useState<InvoiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockchainData, setBlockchainData] = useState<TransactionDetails | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        const doc = storage.getInvoiceById(params.id);
        if (doc && doc.type === params.type) {
          setDocument(doc);
          // 获取区块链交易详情
          const txDetails = await blockchain.getTransactionDetails(doc.transactionHash);
          setBlockchainData(txDetails);
        }
      } catch (error) {
        console.error('Error loading document:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [params.id, params.type]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Document Not Found</h1>
          <p className="text-gray-600 mb-8">The document you are looking for does not exist or has been removed.</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getExplorerUrl = () => {
    return blockchain.getExplorerUrl(document.transactionHash);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto bg-white shadow rounded-lg overflow-hidden">
        {/* 文档标题 */}
        <div className="bg-indigo-600 px-6 py-4">
          <h1 className="text-2xl font-bold text-white text-center">
            {document.type === 'invoice' ? 'INVOICE' : 'RECEIPT'} VERIFICATION
          </h1>
        </div>

        {/* 文档内容 */}
        <div className="p-6 space-y-8">
          {/* 基本信息 */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Document Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Document ID</p>
                <p className="mt-1 text-sm text-gray-900">{document.documentId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Issue Date</p>
                <p className="mt-1 text-sm text-gray-900">{formatDate(document.date)}</p>
              </div>
            </div>
          </div>

          {/* 客户信息 */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="mt-1 text-sm text-gray-900">{document.customerName}</p>
              </div>
              {document.customerAddress && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p className="mt-1 text-sm text-gray-900">{document.customerAddress}</p>
                </div>
              )}
            </div>
          </div>

          {/* 交易详情 */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Details</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Amount</p>
                <p className="mt-1 text-lg font-medium text-gray-900">
                  {document.amount} {document.tokenSymbol}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Description</p>
                <p className="mt-1 text-sm text-gray-900">{document.description}</p>
              </div>
              {document.tags && document.tags.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Tags</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {document.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {document.additionalNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="mt-1 text-sm text-gray-900">{document.additionalNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* 区块链验证 */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Blockchain Verification</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">From Wallet</p>
                <p className="mt-1 text-sm text-gray-900 break-all font-mono">{document.from}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">To Wallet</p>
                <p className="mt-1 text-sm text-gray-900 break-all font-mono">{document.to}</p>
              </div>
              {blockchainData && (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Block Number</p>
                    <p className="mt-1 text-sm text-gray-900">{blockchainData.blockNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Transaction Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      blockchainData.status === 'success' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {blockchainData.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Transaction Time</p>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(blockchainData.timestamp)}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Transaction Hash</p>
                <p className="mt-1 text-sm text-gray-900 break-all font-mono">{document.transactionHash}</p>
              </div>
              <a
                href={getExplorerUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
              >
                View on Blockchain Explorer
                <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <div className="bg-gray-50 px-6 py-4">
          <p className="text-center text-sm text-gray-500">
            Verified by{' '}
            <a href="https://proofpay.io" className="text-indigo-600 hover:text-indigo-500">
              ProofPay
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 