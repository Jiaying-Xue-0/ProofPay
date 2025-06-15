import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generatePDF } from '../utils/pdfGenerator';
import { ReactMultiEmail, isEmail } from 'react-multi-email';
import 'react-multi-email/dist/style.css';

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
  const [emails, setEmails] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  // 打开弹窗或切换invoice时重置所有状态
  useEffect(() => {
    if (open) {
      setEmails([]);
      setMessage('');
      setError('');
      setSuccess(false);
      setSending(false);
    }
  }, [open, invoice]);

  const handleSend = async () => {
    setError('');
    setSuccess(false);
    if (!emails.length || !emails.every(email => isEmail(email))) {
      setError('Please enter valid email address(es)');
      return;
    }
    setSending(true);
    try {
      // 生成PDF为arraybuffer
      const doc = await generatePDF(invoice);
      const arrayBuffer = await doc.output('arraybuffer');
      // 邮件内容
      const html = `
        <body style="background:#f7f8fa;padding:0;margin:0;">
          <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:18px;padding:0 0 32px 0;box-shadow:0 4px 24px #b2b6ff18;overflow:hidden;">
            <!-- Header -->
            <div style="text-align:center;padding:32px 0 10px 0;">
              <img src='https://proof-pay.vercel.app/logo-proofpay-email.png' alt='ProofPay Logo' style='width:56px;height:56px;border-radius:14px;display:inline-block;background:#fff;' />
              <div style="font-weight:800;font-size:1.2rem;background:linear-gradient(90deg,#6366f1,#a855f7);-webkit-background-clip:text;color:transparent;margin-top:10px;letter-spacing:1px;">ProofPay</div>
            </div>
            <div style="height:2px;width:92%;margin:0 auto 24px auto;background:linear-gradient(90deg,#6366f1,#a855f7);border-radius:2px;"></div>
            <!-- Main Content -->
            <div style="padding:0 32px;">
              <h2 style="font-size:1.18rem;font-weight:800;color:#222;margin-bottom:18px;letter-spacing:0.5px;">You have a new on-chain payment request</h2>
              <div style="border-radius:14px;background:linear-gradient(90deg,#f5f6ff 60%,#f3e8ff 100%);padding:20px 18px 12px 18px;margin-bottom:18px;">
                <table style="width:100%;font-size:1.05rem;color:#222;border-collapse:collapse;">
                  <tr>
                    <td style="color:#888;padding:6px 0;">Amount</td>
                    <td style="text-align:right;font-weight:700;color:#7c3aed;">${invoice.amount} ${invoice.tokenSymbol}</td>
                  </tr>
                  <tr>
                    <td style="color:#888;padding:6px 0;">Due Date</td>
                    <td style="text-align:right;">${invoice.dueDate}</td>
                  </tr>
                  <tr>
                    <td style="color:#888;padding:6px 0;">Recipient</td>
                    <td style="text-align:right;color:#6366f1;font-weight:600;">${invoice.customerName || '-'}</td>
                  </tr>
                  <tr>
                    <td style="color:#888;padding:6px 0;">Recipient Address</td>
                    <td style="text-align:right;color:#6366f1;word-break:break-all;font-size:0.97rem;">
                      ${invoice.to || invoice.receiverAddress || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#888;padding:6px 0;">Description</td>
                    <td style="text-align:right;color:#444;">${invoice.description}</td>
                  </tr>
                </table>
                ${message ? `<div style='margin: 12px 0 0 0; color: #6366f1; font-style: italic; font-size: 1rem;'><b>Message:</b> ${message}</div>` : ''}
              </div>
              <a href="${invoice.paymentLink}" style="display:block;width:100%;max-width:400px;margin:32px auto 0 auto;padding:16px 0;background:linear-gradient(90deg,#6366f1,#a855f7);color:#fff;text-align:center;font-weight:800;font-size:1.1rem;border-radius:14px;text-decoration:none;letter-spacing:0.5px;box-shadow:0 2px 12px #a855f733;">Pay Invoice</a>
            </div>
            <!-- Footer -->
            <div style="margin-top:32px;padding:0 32px;text-align:center;color:#aaa;font-size:0.97rem;">
              Need help? <a href="mailto:support@proofpay.com" style="color:#6366f1;text-decoration:none;">Contact Support</a><br/>
              &copy; ${new Date().getFullYear()} ProofPay. All rights reserved.
            </div>
          </div>
          <style>@media (max-width:700px){div[style*='max-width:640px']{max-width:99vw !important;margin:8px auto !important;}h2{font-size:1rem !important;}table{font-size:0.97rem !important;}a[style*='padding:16px 0']{font-size:1rem !important;padding:13px 0 !important;}}</style>
        </body>
      `;
      const subject = `ProofPay 区块链预付款发票 - ${invoice.customerName || ''}`;
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emails,
          subject,
          html,
          pdfBuffer: { data: Array.from(new Uint8Array(arrayBuffer)) },
          pdfFileName: `proofpay-invoice-${invoice.documentId || Date.now()}.pdf`
        })
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || '邮件发送失败');
      } else {
        setSuccess(true);
      }
    } catch (e) {
      setError('邮件发送失败');
    } finally {
      setSending(false);
    }
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
                <ReactMultiEmail
                  emails={emails}
                  onChange={setEmails}
                  placeholder="Enter email(s)"
                  getLabel={(email, index, removeEmail) => (
                    <div data-tag key={index} className="inline-flex items-center px-3 py-1 m-1 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 text-sm font-medium shadow-sm">
                      {email}
                      <span
                        data-tag-handle
                        onClick={() => removeEmail(index)}
                        className="ml-2 cursor-pointer text-indigo-400 hover:text-indigo-700 text-lg font-bold"
                        style={{ lineHeight: 1 }}
                      >×</span>
                    </div>
                  )}
                  validateEmail={isEmail}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-400 bg-white/80 min-h-[48px]"
                />
                <div className="text-xs text-gray-400 mt-1 ml-1">Press Enter or comma to add multiple emails</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Optional Message</label>
                <textarea className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-400 bg-white/80" value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a note (optional)" rows={2} />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex items-center space-x-3 mt-2">
                <button type="button" className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg hover:from-indigo-600 hover:to-purple-600 hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-400" onClick={handleSend} disabled={sending}>
                  {sending ? 'Sending...' : success ? 'Sent!' : 'Send Email'}
                </button>
                <button type="button" className="px-5 py-2 rounded-xl border border-indigo-200 text-indigo-600 font-medium bg-white/80 hover:bg-indigo-50 shadow hover:scale-105 transition-transform" onClick={() => setShowPreview(true)}>
                  Preview Email
                </button>
              </div>
              {success && <div className="text-green-600 font-medium mt-2">Email sent successfully!</div>}
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