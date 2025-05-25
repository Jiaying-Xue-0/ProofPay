'use client';

import { useEffect, useState } from 'react';
import { storage } from '@/services/storage';
import { jsPDF } from 'jspdf';

// 格式化 USDT 金额，保留 6 位小数
const formatUSDTAmount = (amount: string): string => {
  const num = parseFloat(amount);
  return num.toFixed(6);
};

// 创建简单的 PDF 布局
const createSimplePDF = (data: {
  type: 'invoice' | 'receipt';
  date: string;
  transactionHash: string;
  customerName: string;
  amount: string;
  tokenSymbol: string;
  description: string;
  tags?: string[];
  additionalNotes?: string;
}) => {
  const doc = new jsPDF();
  let y = 20;
  const lineHeight = 10;
  
  // 使用默认字体
  doc.setFont('helvetica');
  
  // 标题
  doc.setFontSize(24);
  doc.text(data.type === 'invoice' ? 'INVOICE' : 'RECEIPT', 105, y, { align: 'center' });
  y += lineHeight * 2;

  // 基本信息
  doc.setFontSize(12);
  doc.text(`Date: ${data.date}`, 20, y);
  y += lineHeight;

  doc.text(`Transaction ID: ${data.transactionHash}`, 20, y);
  y += lineHeight;

  doc.text(`Customer: ${data.customerName}`, 20, y);
  y += lineHeight;

  doc.text(`Amount: ${data.amount} ${data.tokenSymbol}`, 20, y);
  y += lineHeight * 1.5;

  // 描述
  doc.text('Description:', 20, y);
  y += lineHeight;
  const descriptionLines = doc.splitTextToSize(data.description, 170);
  doc.text(descriptionLines, 20, y);
  y += lineHeight * (descriptionLines.length + 0.5);

  // 标签
  if (data.tags && data.tags.length > 0) {
    doc.text(`Tags: ${data.tags.join(', ')}`, 20, y);
    y += lineHeight;
  }

  // 备注
  if (data.additionalNotes) {
    doc.text('Notes:', 20, y);
    y += lineHeight;
    const notesLines = doc.splitTextToSize(data.additionalNotes, 170);
    doc.text(notesLines, 20, y);
  }

  return doc;
};

export default function SharePage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvoice = async () => {
      try {
        const invoice = storage.getInvoiceById(params.id);
        if (!invoice) {
          setError('找不到该发票或收据');
          return;
        }

        // 创建 PDF
        const doc = createSimplePDF({
          type: invoice.type,
          date: new Date(invoice.date).toLocaleDateString(),
          transactionHash: `${invoice.transactionHash.slice(0, 6)}...${invoice.transactionHash.slice(-4)}`,
          customerName: invoice.customerName,
          amount: formatUSDTAmount(invoice.amount),
          tokenSymbol: invoice.tokenSymbol,
          description: invoice.description,
          tags: invoice.tags,
          additionalNotes: invoice.additionalNotes,
        });

        // 保存 PDF
        const fileName = `proofpay-${invoice.type}-${Date.now()}.pdf`;
        try {
          doc.save(fileName);
        } catch (saveError) {
          console.error('PDF save error:', saveError);
          setError('PDF 生成失败，请重试');
          return;
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error generating PDF:', err);
        setError('加载发票时出错');
        setLoading(false);
      }
    };

    loadInvoice();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">正在加载...</h2>
          <p className="text-gray-600">请稍候，文件即将自动下载</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">出错了</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">文件已开始下载</h2>
        <p className="text-gray-600">如果下载没有自动开始，请检查浏览器设置</p>
      </div>
    </div>
  );
} 