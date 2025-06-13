import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { SignatureStatus } from '../types/storage';
import { shortenAddress } from './address';
import { ethers } from 'ethers';

interface PDFData {
  type: 'income' | 'expense';
  documentId: string;
  date: string;
  customerName: string;
  customerAddress?: string;
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  decimals: number;
  description: string;
  tags: string[];
  additionalNotes?: string;
  transactionHash: string;
  blockNumber: number;
  transactionStatus: string;
  issuer: string;
  chainId: number;
  signatureStatus: SignatureStatus;
  signedBy?: string;
  invoiceType?: 'pre_payment_invoice' | 'post_payment_invoice';
  status?: 'paid' | 'unpaid' | 'expired';
  paymentLink?: string;
  dueDate?: string;
  explorerLink?: string;
}

const getStatusText = (status: SignatureStatus, signedBy?: string): string => {
  switch (status) {
    case 'signed':
      return `Signed by ${shortenAddress(signedBy || '')}`;
    case 'pending':
      return 'Pending verification';
    case 'mismatch':
      return 'Signature mismatch';
    case 'unverifiable':
      return 'Not verifiable';
    default:
      return 'Unknown status';
  }
};

const formatAmount = (amount: string, decimals: number, invoiceType?: string): string => {
  try {
    if (invoiceType === 'pre_payment_invoice') {
      return amount;
    }
    const formattedAmount = ethers.utils.formatUnits(amount, decimals);
    return formattedAmount.replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error formatting amount:', error);
    return amount;
  }
};

export async function generatePDF(data: PDFData): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // Helper functions
  const addTitle = (text: string) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
  };

  const addField = (label: string, value: string) => {
    const valueLines = doc.splitTextToSize(value, pageWidth - (margin * 2 + 60));
    doc.text(label, margin, y);
    doc.text(valueLines, margin + 60, y);
    y += 7 * valueLines.length;
  };

  const addSeparator = () => {
    y += 5;
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  };

  // Document Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth / 2, y, { align: 'center' });
  y += 20;

  // Reset font for content
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Document Information
  addTitle('Document Information');
  addField('Document ID:', data.documentId);
  addField('Issue Date:', new Date(data.date).toLocaleDateString('en-US'));
  if (data.status) {
    addField('Payment Status:', data.status.toUpperCase());
  }
  addSeparator();

  // Customer Information
  addTitle('Customer Information');
  addField('Name:', data.customerName);
  if (data.customerAddress) {
    addField('Address:', data.customerAddress);
  }
  addSeparator();

  // Transaction Details
  addTitle('Transaction Details');
  const displayAmount = data.invoiceType === 'pre_payment_invoice'
    ? `${data.amount} ${data.tokenSymbol}`
    : `${formatAmount(data.amount, data.decimals)} ${data.tokenSymbol}`;
  addField('Amount:', displayAmount);
  addField('Description:', data.description);
  if (data.tags.length > 0) {
    addField('Tags:', data.tags.join(', '));
  }
  if (data.additionalNotes) {
    addField('Notes:', data.additionalNotes);
  }

  // 预付款发票特有字段
  if (data.invoiceType === 'pre_payment_invoice' && data.status === 'unpaid') {
    if (data.paymentLink) {
      addField('Payment Link:', data.paymentLink);
      doc.setTextColor(0, 0, 255);
      doc.link(margin + 60, y - 7, doc.getTextWidth(data.paymentLink), 7, { url: data.paymentLink });
      doc.setTextColor(0);
    }
    if (data.dueDate) {
      const formattedDueDate = new Date(data.dueDate).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      addField('Due Date:', formattedDueDate);
    }
  }
  addSeparator();

  // 区块链信息（只在非预付款发票或已支付的预付款发票中显示）
  if (data.invoiceType !== 'pre_payment_invoice' || data.status === 'paid') {
    addTitle('Blockchain Information');
    if (data.from) {
      addField('From:', data.from);
    }
    addField('To:', data.to);
    addField('Block Number:', data.blockNumber.toString());
    addField('Status:', data.transactionStatus);
    if (data.transactionHash) {
      addField('Transaction Hash:', data.transactionHash);
      if (data.explorerLink) {
        // 从 explorerLink 中提取域名和交易哈希
        const url = new URL(data.explorerLink);
        const displayText = `${url.hostname}/tx/${shortenAddress(data.transactionHash)}`;
        addField('Explorer Link:', displayText);
        doc.setTextColor(0, 0, 255);
        doc.link(margin + 60, y - 7, doc.getTextWidth(displayText), 7, { url: data.explorerLink });
        doc.setTextColor(0);
      }
    }
    addSeparator();
  }

  // Signature Status
  addTitle('Signature Status');
  addField('Status:', getStatusText(data.signatureStatus, data.signedBy));

  // QR Code and Verification Link
  const verifyUrl = `${window.location.origin}/verify/${data.documentId}`;
  const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl);
  const qrSize = 30;
  doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - margin - qrSize, y, qrSize, qrSize);

  // Verification Link
  doc.setFontSize(8);
  doc.text('Verify this document at:', margin, y + qrSize / 2);
  doc.setTextColor(0, 0, 255);
  doc.text(verifyUrl, margin, y + qrSize / 2 + 4);
  doc.link(margin, y + qrSize / 2 + 1, doc.getTextWidth(verifyUrl), 6, { url: verifyUrl });
  doc.setTextColor(0);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(
    'Generated by ProofPay · https://proofpay.io',
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  return doc;
}

function getExplorerUrl(chainId: number, hash: string): string {
  const domain = getExplorerDomain(chainId);
  return `https://${domain}/tx/${hash}`;
}

function getExplorerDomain(chainId: number): string {
  switch (chainId) {
    case 1: return 'etherscan.io';
    case 137: return 'polygonscan.com';
    case 56: return 'bscscan.com';
    case 42161: return 'arbiscan.io';
    case 10: return 'optimistic.etherscan.io';
    case 43114: return 'snowtrace.io';
    case 250: return 'ftmscan.com';
    case 80001: return 'mumbai.polygonscan.com';
    case 5: return 'goerli.etherscan.io';
    case 97: return 'testnet.bscscan.com';
    default: return 'etherscan.io';
  }
} 