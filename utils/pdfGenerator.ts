import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface DocumentData {
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
  blockNumber?: number;
  transactionStatus?: 'success' | 'failed';
  issuer?: string;
  chainId?: number;
}

export async function generatePDF(data: DocumentData): Promise<jsPDF> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // 设置基本参数
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;

    // 绘制表格函数
    const drawTableRow = (label: string, value: string, indent: number = 0) => {
      doc.text(label, margin + indent, y);
      const valueLines = doc.splitTextToSize(value, contentWidth - 60);
      doc.text(valueLines, margin + 60, y);
      y += 7 * valueLines.length;
    };

    // 添加分隔线函数
    const drawSeparator = () => {
      doc.setLineWidth(0.1);
      doc.line(margin, y - 3, pageWidth - margin, y - 3);
      y += 5;
    };

    // 添加标题函数
    const drawSectionTitle = (title: string) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
    };

    // 添加标题
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(data.type.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 15;

    // 添加基本信息
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // 文档信息
    drawSectionTitle('Document Information');
    drawTableRow('Document ID:', data.documentId);
    drawTableRow('Issue Date:', new Date().toISOString().split('T')[0]);
    drawTableRow('Issuer Name:', 'ProofPay');
    drawTableRow('Issuer Website:', 'https://proofpay.io');
    y += 5;

    // 客户信息
    drawSeparator();
    drawSectionTitle('Customer Information');
    drawTableRow('Name:', data.customerName);
    if (data.customerAddress) {
      drawTableRow('Address:', data.customerAddress);
    }
    y += 5;

    // 交易信息
    drawSeparator();
    drawSectionTitle('Transaction Details');
    const amount = parseFloat(data.amount).toFixed(2);
    drawTableRow('Amount:', `${amount} ${data.tokenSymbol}`);
    drawTableRow('Description:', data.description);
    if (data.tags.length > 0) {
      drawTableRow('Tags:', data.tags.join(', '));
    }
    if (data.additionalNotes) {
      drawTableRow('Notes:', data.additionalNotes);
    }
    y += 5;

    // 区块链信息
    drawSeparator();
    drawSectionTitle('Blockchain Information');
    drawTableRow('From:', data.from);
    drawTableRow('To:', data.to);
    if (data.blockNumber) {
      drawTableRow('Block Number:', data.blockNumber.toString());
    }
    if (data.transactionStatus) {
      drawTableRow('Status:', data.transactionStatus.toUpperCase());
    }
    drawTableRow('Transaction Hash:', data.transactionHash);
    
    // 根据链生成对应的区块链浏览器链接
    const getExplorerUrl = (chainId: number, hash: string) => {
      switch (chainId) {
        case 1: // Ethereum Mainnet
          return `https://etherscan.io/tx/${hash}`;
        case 137: // Polygon Mainnet
          return `https://polygonscan.com/tx/${hash}`;
        case 56: // BSC Mainnet
          return `https://bscscan.com/tx/${hash}`;
        case 42161: // Arbitrum One
          return `https://arbiscan.io/tx/${hash}`;
        case 10: // Optimism
          return `https://optimistic.etherscan.io/tx/${hash}`;
        case 43114: // Avalanche C-Chain
          return `https://snowtrace.io/tx/${hash}`;
        case 250: // Fantom Opera
          return `https://ftmscan.com/tx/${hash}`;
        case 80001: // Polygon Mumbai Testnet
          return `https://mumbai.polygonscan.com/tx/${hash}`;
        case 5: // Goerli Testnet
          return `https://goerli.etherscan.io/tx/${hash}`;
        case 97: // BSC Testnet
          return `https://testnet.bscscan.com/tx/${hash}`;
        default:
          return `https://etherscan.io/tx/${hash}`; // 默认使用 Ethereum
      }
    };

    const getExplorerDomain = (chainId: number) => {
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
    };

    const explorerUrl = getExplorerUrl(data.chainId || 1, data.transactionHash);
    const shortHash = `${data.transactionHash.slice(0, 6)}...${data.transactionHash.slice(-4)}`;
    const explorerDomain = getExplorerDomain(data.chainId || 1);
    const displayText = `${explorerDomain}/tx/${shortHash}`;
    drawTableRow('Explorer Link:', displayText);
    doc.setTextColor(0, 0, 255);
    doc.link(margin + 60, y - 7, contentWidth - 60, 7, { url: explorerUrl });
    doc.setTextColor(0);
    y += 10;

    // 生成验证链接和二维码
    const verifyUrl = `${window.location.origin}/verify/${data.type}/${data.documentId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl);
    
    // 添加二维码
    const qrSize = 30;
    doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - margin - qrSize, y, qrSize, qrSize);

    // 添加验证链接
    doc.setFontSize(8);
    doc.text('Verify this document at:', margin, y + qrSize / 2);
    doc.setTextColor(0, 0, 255);
    const verifyUrlChunks = doc.splitTextToSize(verifyUrl, pageWidth - 2 * margin - qrSize - 10);
    doc.text(verifyUrlChunks, margin, y + qrSize / 2 + 4);
    doc.setTextColor(0);

    // 添加页脚
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text('Generated by ProofPay · https://proofpay.io', pageWidth / 2, pageHeight - 10, {
      align: 'center'
    });

    return doc;
  } catch (error) {
    throw error;
  }
} 