import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SendInvoiceEmailModalProps {
  open: boolean;
  onClose: () => void;
  invoice: any; // 真实项目应定义Invoice类型
  onSend: (email: string, message: string) => Promise<void>;
  loading?: boolean;
  sent?: boolean;
}

export const SendInvoiceEmailModal: React.FC<SendInvoiceEmailModalProps> = ({ open, onClose, invoice, onSend, loading, sent }) => {
  if (!invoice) return null;
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setError('');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    await onSend(email, message);
  };

  // 英文邮件预览内容
  const emailPreview = (
    <div className="space-y-4 text-gray-800">
      <div className="font-semibold text-lg">You have a new on-chain pre-payment invoice</div>
      <div>Hello,</div>
      <div>
        You have received a pre-payment invoice from <b>{invoice.customerName || 'the sender'}</b>.<br/>
        <ul className="list-disc ml-6 mt-2">
          <li>Amount: <b>{invoice.amount} {invoice.tokenSymbol}</b></li>
          <li>Recipient: <b>{invoice.to || invoice.receiverAddress || '-'}</b></li>
          <li>Due Date: <b>{invoice.dueDate}</b></li>
          <li>Description: <b>{invoice.description}</b></li>
        </ul>
      </div>
      {message && <div className="italic text-indigo-600">Message: {message}</div>}
      <div className="mt-4">
        <a href={invoice.paymentLink} target="_blank" rel="noopener" className="inline-block px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg hover:scale-105 transition-transform">Pay Invoice</a>
      </div>
      <div className="text-xs text-gray-400 mt-6">This invoice is secured by blockchain. Powered by ProofPay.</div>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 20 }}
        >
          <motion.div
            className="bg-gradient-to-br from-white via-indigo-50 to-purple-50 rounded-3xl shadow-2xl p-8 max-w-lg w-full relative border border-white/30"
            initial={{ scale: 0.92, y: 60, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 18 }}
          >
            <button className="absolute top-4 right-4 text-gray-400 hover:text-indigo-500 text-2xl" onClick={onClose}>&times;</button>
            <div className="flex flex-col items-center mb-6">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 rounded-full mb-2 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12H8m8 0a4 4 0 11-8 0 4 4 0 018 0zm0 0v4m0-4V8" /></svg>
              </div>
              <div className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">Send Invoice by Email</div>
              <div className="text-gray-500 text-sm mt-1">Let your client pay easily and securely</div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                <input type="email" className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-400 bg-white/80" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Optional Message</label>
                <textarea className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-400 bg-white/80" value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a note (optional)" rows={2} />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex items-center space-x-3 mt-2">
                <button type="button" className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg hover:from-indigo-600 hover:to-purple-600 hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-400" onClick={handleSend} disabled={loading}>
                  {loading ? 'Sending...' : sent ? 'Sent!' : 'Send Email'}
                </button>
                <button type="button" className="px-5 py-2 rounded-xl border border-indigo-200 text-indigo-600 font-medium bg-white/80 hover:bg-indigo-50 shadow hover:scale-105 transition-transform" onClick={() => setShowPreview(true)}>
                  Preview Email
                </button>
              </div>
              {sent && <div className="text-green-600 font-medium mt-2">Email sent successfully!</div>}
            </div>
            {/* 邮件预览模态框 */}
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 20 }}
                >
                  <motion.div
                    className="bg-gradient-to-br from-white via-indigo-50 to-purple-50 rounded-3xl shadow-2xl p-8 max-w-xl w-full relative border border-white/30"
                    initial={{ scale: 0.92, y: 40, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.92, y: 40, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                  >
                    <button className="absolute top-5 right-5 text-gray-400 hover:text-indigo-500 text-2xl" onClick={() => setShowPreview(false)}>&times;</button>
                    <div className="mb-6 text-2xl font-extrabold text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text">Email Preview</div>
                    <div className="space-y-6">
                      <div className="text-lg font-semibold text-gray-900">You have a new on-chain pre-payment invoice</div>
                      <div className="text-gray-700">Hello,</div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-6">
                          <div>
                            <div className="text-xs text-gray-500">From</div>
                            <div className="font-bold text-indigo-700">{invoice.customerName || 'the sender'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Recipient</div>
                            <div className="font-bold text-indigo-700">{invoice.to || invoice.receiverAddress || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Amount</div>
                            <div className="font-bold text-purple-700">{invoice.amount} {invoice.tokenSymbol}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Due Date</div>
                            <div className="font-bold text-gray-800">{invoice.dueDate}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mt-4">Description</div>
                          <div className="text-gray-800 font-medium">{invoice.description}</div>
                        </div>
                        {message && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-500">Message</div>
                            <div className="italic text-indigo-600">{message}</div>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-center mt-8">
                        <a href={invoice.paymentLink} target="_blank" rel="noopener" className="inline-block px-8 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg hover:scale-105 transition-transform text-lg">Pay Invoice</a>
                      </div>
                      <div className="text-xs text-gray-400 mt-8 text-center">This invoice is secured by blockchain. Powered by ProofPay.</div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 