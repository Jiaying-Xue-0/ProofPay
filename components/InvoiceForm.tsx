import { useState } from 'react';
import { Transaction } from '../types/transaction';
import { jsPDF } from 'jspdf';
import { storage } from '../services/storage';

const PREDEFINED_TAGS = [
  'Salary',
  'Service Fee',
  'Art Collaboration',
  'Development',
  'Consulting',
  'Others',
];

// 格式化 USDT 金额，保留 6 位小数，并进行单位转换
const formatUSDTAmount = (amount: string): string => {
  const num = parseFloat(amount);
  // USDT 合约金额需要除以 10^6 来得到实际金额
  return (num / 1000000).toFixed(6);
};

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
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  let y = 20;
  const lineHeight = 10;
  
  // 标题
  doc.setFont('helvetica', 'normal');
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
  doc.text('Tags:', 20, y);
  y += lineHeight;
  if (data.tags && data.tags.length > 0) {
    const tagsText = data.tags.join(' | ');
    doc.text(tagsText, 20, y);
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

interface InvoiceFormProps {
  transaction: Transaction;
  type: 'invoice' | 'receipt';
  onClose: () => void;
}

export function InvoiceForm({ transaction, type, onClose }: InvoiceFormProps) {
  const [formData, setFormData] = useState({
    customerName: '',
    description: '',
    additionalNotes: '',
    tags: [] as string[],
  });
  const [showShareLink, setShowShareLink] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 保存到本地存储
      const savedInvoice = storage.saveInvoice({
        transactionHash: transaction.hash,
        type,
        customerName: formData.customerName,
        description: formData.description,
        amount: formatUSDTAmount(transaction.value),
        tokenSymbol: transaction.tokenSymbol,
        date: transaction.timestamp * 1000,
        from: transaction.from,
        to: transaction.to,
        additionalNotes: formData.additionalNotes,
        tags: formData.tags,
      });

      // 创建 PDF
      const doc = createSimplePDF({
        type,
        date: new Date(transaction.timestamp * 1000).toLocaleDateString(),
        transactionHash: `${transaction.hash.slice(0, 6)}...${transaction.hash.slice(-4)}`,
        customerName: formData.customerName,
        amount: formatUSDTAmount(transaction.value),
        tokenSymbol: transaction.tokenSymbol,
        description: formData.description,
        tags: formData.tags,
        additionalNotes: formData.additionalNotes,
      });

      // 保存 PDF
      const fileName = `proofpay-${type}-${Date.now()}.pdf`;
      try {
        doc.save(fileName);
      } catch (saveError) {
        console.error('PDF save error:', saveError);
        alert('PDF 生成失败，请重试');
        return;
      }

      // 生成分享链接
      const shareUrl = new URL(`/share/${savedInvoice.id}`, window.location.origin);
      setShareLink(shareUrl.toString());
      setShowShareLink(true);
    } catch (error) {
      console.error('Form submission error:', error);
      alert('发票生成失败，请重试');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="customerName"
          className="block text-sm font-medium text-gray-700"
        >
          客户名称
        </label>
        <input
          type="text"
          name="customerName"
          id="customerName"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 px-3"
          value={formData.customerName}
          onChange={(e) =>
            setFormData({ ...formData, customerName: e.target.value })
          }
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          描述
        </label>
        <textarea
          name="description"
          id="description"
          required
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 min-h-[80px] resize-none"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          标签
        </label>
        <div className="flex flex-wrap gap-2">
          {PREDEFINED_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagToggle(tag)}
              className={`px-3 py-1 rounded-full text-sm ${
                formData.tags.includes(tag)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="additionalNotes"
          className="block text-sm font-medium text-gray-700"
        >
          额外备注
        </label>
        <textarea
          name="additionalNotes"
          id="additionalNotes"
          rows={2}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 min-h-[60px] resize-none"
          value={formData.additionalNotes}
          onChange={(e) =>
            setFormData({ ...formData, additionalNotes: e.target.value })
          }
        />
      </div>

      {showShareLink && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <p className="text-sm font-medium text-gray-700 mb-2">分享链接：</p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={shareLink}
              className="flex-1 rounded-md border-gray-300 bg-white text-sm h-10 px-3"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(shareLink)}
              className="px-4 h-10 bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 text-sm"
            >
              复制
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          取消
        </button>
        <button
          type="submit"
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          生成{type === 'invoice' ? '发票' : '收据'}
        </button>
      </div>
    </form>
  );
} 