import { useState } from 'react';
import { Transaction } from '../types/transaction';
import { jsPDF } from 'jspdf';
import { storage } from '../services/storage';

interface InvoiceFormProps {
  transaction: Transaction;
  type: 'invoice' | 'receipt';
  onClose: () => void;
}

const PREDEFINED_TAGS = [
  '薪资',
  '服务费',
  '艺术合作',
  '开发费用',
  '咨询费',
  '其他',
];

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
    
    // 保存到本地存储
    const savedInvoice = storage.saveInvoice({
      transactionHash: transaction.hash,
      type,
      customerName: formData.customerName,
      description: formData.description,
      amount: transaction.value,
      tokenSymbol: transaction.tokenSymbol,
      date: transaction.timestamp * 1000,
      from: transaction.from,
      to: transaction.to,
      additionalNotes: formData.additionalNotes,
      tags: formData.tags,
    });
    
    // 创建 PDF
    const doc = new jsPDF();
    
    // 添加标题
    doc.setFontSize(20);
    doc.text(type === 'invoice' ? '发票' : '收据', 105, 20, { align: 'center' });
    
    // 添加基本信息
    doc.setFontSize(12);
    doc.text(`客户名称: ${formData.customerName}`, 20, 40);
    doc.text(`日期: ${new Date(transaction.timestamp * 1000).toLocaleDateString()}`, 20, 50);
    doc.text(`交易哈希: ${transaction.hash}`, 20, 60);
    doc.text(`金额: ${transaction.value} ${transaction.tokenSymbol}`, 20, 70);
    doc.text(`描述: ${formData.description}`, 20, 80);
    
    if (formData.additionalNotes) {
      doc.text(`备注: ${formData.additionalNotes}`, 20, 90);
    }

    if (formData.tags.length > 0) {
      doc.text(`标签: ${formData.tags.join(', ')}`, 20, 100);
    }
    
    // 保存 PDF
    doc.save(`proofpay-${type}-${Date.now()}.pdf`);

    // 生成分享链接
    const link = storage.generateShareLink(savedInvoice.id);
    setShareLink(link);
    setShowShareLink(true);
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
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={formData.additionalNotes}
          onChange={(e) =>
            setFormData({ ...formData, additionalNotes: e.target.value })
          }
        />
      </div>

      {showShareLink && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <p className="text-sm font-medium text-gray-700">分享链接：</p>
          <div className="flex mt-2">
            <input
              type="text"
              readOnly
              value={shareLink}
              className="flex-1 rounded-l-md border-gray-300 text-sm"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(shareLink)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-r-md border border-l-0 border-gray-300 hover:bg-gray-200"
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