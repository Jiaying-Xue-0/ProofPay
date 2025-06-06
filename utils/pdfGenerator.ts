import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { SignatureStatus } from '../types/storage';
import { shortenAddress } from './address';

interface PDFData {
  type: 'invoice' | 'receipt';
  documentId: string;
  date: string;
  customerName: string;
  customerAddress?: string;
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
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
}

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
  doc.text(data.type.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 20;

  // Reset font for content
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Document Information
  addTitle('Document Information');
  addField('Document ID:', data.documentId);
  addField('Issue Date:', data.date);
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
  addField('Amount:', `${data.amount} ${data.tokenSymbol}`);
  addField('Description:', data.description);
  if (data.tags.length > 0) {
    addField('Tags:', data.tags.join(', '));
  }
  if (data.additionalNotes) {
    addField('Notes:', data.additionalNotes);
  }
  addSeparator();

  // Blockchain Information
  addTitle('Blockchain Information');
  addField('From:', data.from);
  addField('To:', data.to);
  addField('Block Number:', data.blockNumber.toString());
  addField('Status:', data.transactionStatus);
  addField('Transaction Hash:', data.transactionHash);

  // Explorer Link
  const explorerUrl = getExplorerUrl(data.chainId, data.transactionHash);
  const explorerDomain = getExplorerDomain(data.chainId);
  const shortHash = shortenAddress(data.transactionHash);
  addField('Explorer Link:', `${explorerDomain}/tx/${shortHash}`);
  doc.setTextColor(0, 0, 255);
  doc.link(margin + 60, y - 7, pageWidth - (margin * 2 + 60), 7, { url: explorerUrl });
  doc.setTextColor(0);
  addSeparator();

  // Signature Status
  addTitle('Signature Status');
  
  // Ensure consistent font and spacing for signature status
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Draw label and status text directly
  doc.text('Status:', margin, y);
  const statusText = getStatusText(data.signatureStatus, data.signedBy);
  doc.text(statusText, margin + 60, y);
  
  y += 15;

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

function getStatusText(status: SignatureStatus, signedBy?: string): string {
  switch (status) {
    case 'signed':
      return signedBy ? `Signed by ${shortenAddress(signedBy)}` : 'Signed';
    case 'pending':
      return 'Pending verification';
    case 'mismatch':
      return 'Signature verification failed';
    case 'unverifiable':
      return 'No signature required';
    default:
      return 'Unknown status';
  }
} 