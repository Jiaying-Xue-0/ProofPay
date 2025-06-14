'use client';

import { useEffect, useState } from 'react';
import { db } from '@/services/db';
import { blockchain, TransactionDetails } from '@/services/blockchain';
import { InvoiceRecord } from '@/types/storage';
import { shortenAddress } from '@/utils/address';
import { ethers } from 'ethers';
import Link from 'next/link';

// 格式化金额的辅助函数
const formatAmount = (amount: string, decimals: number, invoiceType?: string): string => {
  try {
    if (invoiceType === 'pre_payment_invoice') {
      return amount;
    }
    // 移除可能存在的小数部分，确保是整数字符串
    const [integerPart] = amount.split('.');
    const cleanAmount = integerPart.replace(/[^\d]/g, '');
    return ethers.utils.formatUnits(cleanAmount, decimals);
  } catch (error) {
    console.error('Error formatting amount:', error);
    return amount;
  }
};

// 获取区块链浏览器链接
const getExplorerUrl = (chainId: number, txHash: string): string => {
  const baseUrl = chainId === 1 ? 'etherscan.io' :
                 chainId === 5 ? 'goerli.etherscan.io' :
                 chainId === 137 ? 'polygonscan.com' :
                 chainId === 80001 ? 'mumbai.polygonscan.com' :
                 'etherscan.io';
  return `https://${baseUrl}/tx/${txHash}`;
};

export default function VerifyPage({
  params,
}: {
  params: { id: string };
}) {
  const [document, setDocument] = useState<InvoiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockchainData, setBlockchainData] = useState<TransactionDetails | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        const doc = await db.getInvoice(params.id);
        if (doc) {
          setDocument(doc);
          // 只有在非预付款发票或已支付的预付款发票时获取区块链信息
          if (doc.invoiceType !== 'pre_payment_invoice' || doc.status === 'paid') {
            const txDetails = await blockchain.getTransactionDetails(doc.transactionHash);
            setBlockchainData(txDetails);
          }
        }
      } catch (error) {
        console.error('Error loading document:', error);
        setError('Failed to load document. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-8">{error}</p>
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
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto bg-white shadow rounded-lg overflow-hidden">
        {/* Document Title */}
        <div className="bg-indigo-600 px-6 py-4">
          <h1 className="text-2xl font-bold text-white text-center">
            {document.type === 'income' ? 'INVOICE' : 'EXPENSE RECEIPT'} VERIFICATION
          </h1>
        </div>

        {/* Document Content */}
        <div className="p-6 space-y-8">
          {/* Basic Information */}
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
              <div>
                <p className="text-sm font-medium text-gray-500">Payment Status</p>
                <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(document.status)}`}>
                  {document.status.toUpperCase()}
                </span>
              </div>
              {document.invoiceType === 'pre_payment_invoice' && document.dueDate && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Due Date</p>
                  <p className="mt-1 text-sm text-gray-900">{new Date(document.dueDate).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Information */}
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

          {/* Transaction Details */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Details</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Amount</p>
                <p className="mt-1 text-lg font-medium text-gray-900">
                  {formatAmount(document.amount, document.decimals, document.invoiceType)} {document.tokenSymbol}
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

          {/* Payment Link for unpaid pre-payment invoices */}
          {document.invoiceType === 'pre_payment_invoice' && document.status === 'unpaid' && document.paymentLink && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Payment Link</p>
                <a
                  href={document.paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Click here to make payment
                  <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          )}

          {/* Blockchain Verification - Only show for post-payment invoices or paid pre-payment invoices */}
          {(document.invoiceType !== 'pre_payment_invoice' || document.status === 'paid') && (
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
                  </>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-500">Transaction Time</p>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(document.date)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Transaction Hash</p>
                  <p className="mt-1 text-sm text-gray-900 break-all font-mono">{document.transactionHash}</p>
                </div>
                {blockchainData && (
                  <a
                    href={getExplorerUrl(blockchainData.chainId, document.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    View on Blockchain Explorer
                    <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Signature Status */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Signature Status</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <span className={`flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full ${
                  document.signatureStatus === 'signed'
                    ? 'bg-green-100 text-green-800'
                    : document.signatureStatus === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : document.signatureStatus === 'mismatch'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {document.signatureStatus === 'signed' && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {document.signatureStatus === 'pending' && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {document.signatureStatus === 'mismatch' && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                  {document.signatureStatus === 'unverifiable' && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {document.signatureStatus === 'signed' && `Signed by ${document.signedBy ? shortenAddress(document.signedBy) : 'Unknown'}`}
                    {document.signatureStatus === 'pending' && 'Pending verification'}
                    {document.signatureStatus === 'mismatch' && 'Signature verification failed'}
                    {document.signatureStatus === 'unverifiable' && 'No signature required'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
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