import { createClient } from '@supabase/supabase-js';
import { InvoiceRecord, SignatureStatus } from '../types/storage';
import { supabase } from './supabase';
import { PaymentRequest } from '../types/storage';

// 创建 Supabase 客户端
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,        // ✅ 保存 session
      autoRefreshToken: true       // ✅ 自动刷新 token
    }
  }
);

export interface DbWallet {
  id: string;
  address: string;
  label: string;
  parent_wallet?: string;
  is_main: boolean;
  created_at: string;
}

interface CreatePaymentRequestData {
  amount: string;
  token_symbol: string;
  token_address: string;
  chain_id: string;
  customer_name: string;
  description?: string;
  tags?: string[];
  additional_notes?: string;
  requester_address: string;
  expires_at: string;
}

interface DbInvoice {
  id: string;
  document_id: string;
  type: 'income' | 'expense';
  date: number;
  customer_name: string;
  customer_address?: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_symbol: string;
  decimals: number;
  description?: string;
  tags?: string[];
  additional_notes?: string;
  transaction_hash: string;
  signature_status: SignatureStatus;
  signed_by?: string;
  wallet_address: string;
  created_at: number;
  block_number?: number;
  request_id?: string;
  invoice_type: 'pre_payment_invoice' | 'post_payment_invoice';
  status: 'unpaid' | 'paid' | 'cancelled';
  payment_link?: string;
  due_date?: string;
  updated_at: string;
}

export interface DbPaymentRequest {
  id: string;
  created_at: string;
  updated_at: string;
  amount: string;
  token_symbol: string;
  token_address: string;
  chain_id: string;
  customer_name: string;
  description?: string;
  tags?: string[];
  additional_notes?: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  payment_link: string;
  requester_address: string;
  payer_address?: string;
  transaction_hash?: string;
  paid_at?: string;
  expires_at: string;
}

export class DatabaseService {
  async saveWallet(wallet: DbWallet): Promise<DbWallet> {
    try {
      console.log('Saving wallet:', { ...wallet, address: wallet.address.slice(0, 10) + '...' });

      // 检查钱包是否已存在
      const { data: existingWallet } = await supabaseClient
        .from('wallets')
        .select()
        .eq('address', wallet.address.toLowerCase())
        .maybeSingle();

      if (existingWallet) {
        // 如果钱包已存在，更新它
        const { data, error } = await supabaseClient
          .from('wallets')
          .update({
            label: wallet.label,
            parent_wallet: wallet.parent_wallet?.toLowerCase(),
            is_main: wallet.is_main
          })
          .eq('address', wallet.address.toLowerCase())
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('Failed to update wallet');
        return data;
      }

      // 如果钱包不存在，创建新钱包
      const { data, error } = await supabaseClient
        .from('wallets')
        .insert({
          address: wallet.address.toLowerCase(),
          label: wallet.label,
          parent_wallet: wallet.parent_wallet?.toLowerCase(),
          is_main: wallet.is_main
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to save wallet');

      return data;
    } catch (error) {
      console.error('Error saving wallet:', error);
      throw error;
    }
  }

  async getMainWallet(address: string): Promise<DbWallet | null> {
    try {
      console.log('Getting main wallet for address:', address);
      const { data, error } = await supabaseClient
        .from('wallets')
        .select()
        .eq('address', address.toLowerCase())
        .eq('is_main', true)
        .maybeSingle();

      if (error) throw error;
      console.log('Found main wallet:', data);
      return data;
    } catch (error) {
      console.error('Error getting main wallet:', error);
      throw error;
    }
  }

  async getSubWallets(parentAddress: string): Promise<DbWallet[]> {
    try {
      console.log('Getting sub wallets for parent:', parentAddress);
      const { data, error } = await supabaseClient
        .from('wallets')
        .select()
        .eq('parent_wallet', parentAddress.toLowerCase())
        .eq('is_main', false);

      if (error) throw error;
      console.log('Found sub wallets:', data);
      return data || [];
    } catch (error) {
      console.error('Error getting sub wallets:', error);
      throw error;
    }
  }

  async removeWallet(address: string): Promise<void> {
    try {
      console.log('Removing wallet:', address);
      const { error } = await supabaseClient
        .from('wallets')
        .delete()
        .eq('address', address.toLowerCase());

      if (error) throw error;
    } catch (error) {
      console.error('Error removing wallet:', error);
      throw error;
    }
  }

  async saveInvoice(invoice: Omit<InvoiceRecord, 'id' | 'createdAt'>): Promise<InvoiceRecord> {
    try {
      console.log('Saving invoice:', { ...invoice, documentId: invoice.documentId });

      // 获取钱包信息以确定正确的 wallet_address
      const { data: wallet } = await supabaseClient
        .from('wallets')
        .select()
        .eq('address', invoice.from.toLowerCase())
        .maybeSingle();

      // 如果是子钱包，使用父钱包地址作为 wallet_address
      const walletAddress = wallet?.parent_wallet || invoice.from.toLowerCase();

      const { data, error } = await supabaseClient
        .from('invoices')
        .insert({
          document_id: invoice.documentId,
          type: invoice.type,
          date: invoice.date,
          customer_name: invoice.customerName,
          customer_address: invoice.customerAddress,
          from_address: invoice.from.toLowerCase(),
          to_address: invoice.to.toLowerCase(),
          amount: invoice.amount,
          token_symbol: invoice.tokenSymbol,
          decimals: invoice.decimals,
          description: invoice.description,
          tags: invoice.tags,
          additional_notes: invoice.additionalNotes,
          transaction_hash: invoice.transactionHash,
          signature_status: invoice.signatureStatus || 'pending',
          signed_by: invoice.signedBy,
          wallet_address: walletAddress,
          created_at: Date.now(),
          invoice_type: invoice.invoiceType || 'post_payment_invoice',
          status: invoice.status || 'paid',
          payment_link: invoice.paymentLink,
          due_date: invoice.dueDate,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to save invoice');

      return this.mapDbInvoiceToInvoiceRecord(data);
    } catch (error) {
      console.error('Error saving invoice:', error);
      throw error;
    }
  }

  async getInvoice(id: string): Promise<InvoiceRecord | null> {
    try {
      console.log('Getting invoice:', id);
      const { data, error } = await supabaseClient
        .from('invoices')
        .select('*')
        .eq('document_id', id)
        .maybeSingle();

      if (error) {
        console.error('Database error:', error);
        return null;
      }
      
      return data ? this.mapDbInvoiceToInvoiceRecord(data) : null;
    } catch (error) {
      console.error('Error getting invoice:', error);
      return null;
    }
  }

  async getInvoicesByAddress(address: string): Promise<InvoiceRecord[]> {
    try {
      const normalizedAddress = address.toLowerCase();
      console.log('Getting invoices for address:', normalizedAddress);

      // 获取钱包信息
      const { data: wallet } = await supabaseClient
        .from('wallets')
        .select()
        .eq('address', normalizedAddress)
        .single();

      let relatedAddresses: string[] = [normalizedAddress];

      if (wallet?.is_main) {
        // 如果是主钱包，获取所有子钱包
        const { data: subWallets } = await supabaseClient
          .from('wallets')
          .select('address')
          .eq('parent_wallet', normalizedAddress);

        if (subWallets) {
          relatedAddresses = [
            normalizedAddress,
            ...subWallets.map(w => w.address)
          ];
        }
      } else if (wallet?.parent_wallet) {
        // 如果是子钱包，使用父钱包地址
        relatedAddresses = [normalizedAddress, wallet.parent_wallet];
        
        // 获取同一父钱包下的其他子钱包
        const { data: siblingWallets } = await supabaseClient
          .from('wallets')
          .select('address')
          .eq('parent_wallet', wallet.parent_wallet);

        if (siblingWallets) {
          relatedAddresses = [
            ...new Set([
              ...relatedAddresses,
              ...siblingWallets.map(w => w.address)
            ])
          ];
        }
      }

      console.log('Related addresses:', relatedAddresses);

      // 构建查询
      const { data, error } = await supabaseClient
        .from('invoices')
        .select()
        .or(
          relatedAddresses.map(addr => 
            `or(wallet_address.eq.${addr},from_address.eq.${addr},to_address.eq.${addr})`
          ).join(',')
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting invoices:', error);
        throw error;
      }

      if (!data) {
        console.log('No invoices found');
        return [];
      }

      console.log(`Found ${data.length} invoices`);
      const invoices = data.map(this.mapDbInvoiceToInvoiceRecord);
      return invoices;
    } catch (error) {
      console.error('Error in getInvoicesByAddress:', error);
      throw error;
    }
  }

  async getSubWallet(address: string) {
    try {
      const { data, error } = await supabaseClient
        .from('wallets')
        .select('*')
        .eq('address', address.toLowerCase())
        .eq('is_main', false)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting sub wallet:', error);
      return null;
    }
  }

  async createPaymentRequest(data: CreatePaymentRequestData): Promise<{ data: DbPaymentRequest | null; error: Error | null }> {
    try {
      // 先创建请求，获取 ID
      const { data: result, error } = await supabaseClient
        .from('payment_requests')
        .insert({
          amount: data.amount,
          token_symbol: data.token_symbol,
          token_address: data.token_address,
          chain_id: data.chain_id,
          customer_name: data.customer_name,
          description: data.description || '',
          tags: data.tags || [],
          additional_notes: data.additional_notes || '',
          requester_address: data.requester_address.toLowerCase(),
          status: 'pending',
          expires_at: data.expires_at,
          payment_link: '', // 临时空值
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      // 更新支付链接，使用返回的 ID
      if (result) {
        const paymentLink = `${window.location.origin}/pay/${result.id}`;
        const { error: updateError } = await supabaseClient
          .from('payment_requests')
          .update({ payment_link: paymentLink })
          .eq('id', result.id);

        if (updateError) throw updateError;

        // 返回更新后的完整数据
        return { 
          data: {
            ...result,
            payment_link: paymentLink
          },
          error: null 
        };
      }

      return { data: null, error: new Error('创建支付请求失败') };
    } catch (error) {
      console.error('Error creating payment request:', error);
      return { data: null, error: error as Error };
    }
  }

  async getPaymentRequests(filter: {
    type?: string;
    tokenSymbol?: string;
    startDate?: string;
    endDate?: string;
    requesterAddress?: string;
  }): Promise<{ data: DbPaymentRequest[]; error: Error | null }> {
    try {
      if (!filter.requesterAddress) {
        return { data: [], error: null };
      }

      const normalizedAddress = filter.requesterAddress.toLowerCase();

      // 获取钱包信息
      const { data: wallet } = await supabaseClient
        .from('wallets')
        .select()
        .eq('address', normalizedAddress)
        .maybeSingle();

      let query = supabaseClient
        .from('payment_requests')
        .select('*');

      if (wallet?.is_main) {
        // 如果是主钱包，获取所有子钱包的地址
        const { data: subWallets } = await supabaseClient
          .from('wallets')
          .select('address')
          .eq('parent_wallet', normalizedAddress);

        const relatedAddresses = [
          normalizedAddress,
          ...(subWallets?.map(w => w.address) || [])
        ];

        // 查询主钱包和所有子钱包的支付请求
        query = query.in('requester_address', relatedAddresses);
      } else {
        // 如果是子钱包或普通钱包，只查询自己的支付请求
        query = query.eq('requester_address', normalizedAddress);
      }

      if (filter.tokenSymbol) {
        query = query.eq('token_symbol', filter.tokenSymbol);
      }

      if (filter.startDate) {
        query = query.gte('created_at', filter.startDate);
      }

      if (filter.endDate) {
        query = query.lte('created_at', filter.endDate);
      }

      // 按创建时间降序排序
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error getting payment requests:', error);
      return { data: [], error: error as Error };
    }
  }

  async getPaymentRequest(id: string): Promise<{ data: DbPaymentRequest | null; error: Error | null }> {
    try {
      const { data, error } = await supabaseClient
        .from('payment_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error getting payment request:', error);
      return { data: null, error: error as Error };
    }
  }

  async updatePaymentRequestStatus(id: string, status: 'paid' | 'cancelled' | 'expired', payer_address?: string): Promise<{ error: Error | null }> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
        if (payer_address) {
          updateData.payer_address = payer_address.toLowerCase();
        }
      }

      const { error } = await supabaseClient
        .from('payment_requests')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error updating payment request status:', error);
      return { error: error as Error };
    }
  }

  startExpirationCheck() {
    // 每小时检查一次过期的支付请求
    setInterval(async () => {
      try {
        const now = new Date().toISOString();
        const { data: expiredRequests } = await supabaseClient
          .from('payment_requests')
          .select('id')
          .eq('status', 'pending')
          .lt('expires_at', now);

        if (expiredRequests) {
          for (const request of expiredRequests) {
            await this.updatePaymentRequestStatus(request.id, 'expired');
          }
        }
      } catch (error) {
        console.error('Error checking expired payment requests:', error);
      }
    }, 60 * 60 * 1000); // 1小时
  }

  async saveInvoiceWithSignature(
    invoice: Omit<InvoiceRecord, 'id' | 'createdAt'>,
    signature: string,
    signedMessage: string,
    signerAddress: string
  ): Promise<InvoiceRecord> {
    try {
      console.log('Saving invoice with signature:', { ...invoice, documentId: invoice.documentId });

      // 获取钱包信息以确定正确的 wallet_address
      const { data: wallet } = await supabaseClient
        .from('wallets')
        .select()
        .eq('address', invoice.from.toLowerCase())
        .maybeSingle();

      // 如果是子钱包，使用父钱包地址作为 wallet_address
      const walletAddress = wallet?.parent_wallet || invoice.from.toLowerCase();

      const { data, error } = await supabaseClient
        .from('invoices')
        .insert({
          document_id: invoice.documentId,
          type: invoice.type,
          date: invoice.date,
          customer_name: invoice.customerName,
          customer_address: invoice.customerAddress,
          from_address: invoice.from.toLowerCase(),
          to_address: invoice.to.toLowerCase(),
          amount: invoice.amount,
          token_symbol: invoice.tokenSymbol,
          decimals: invoice.decimals,
          description: invoice.description,
          tags: invoice.tags,
          additional_notes: invoice.additionalNotes,
          transaction_hash: invoice.transactionHash,
          signature_status: 'signed',
          signature: signature,
          signed_message: signedMessage,
          signed_by: signerAddress.toLowerCase(),
          wallet_address: walletAddress,
          created_at: Date.now(),
          invoice_type: invoice.invoiceType || 'post_payment_invoice',
          status: invoice.status || 'paid',
          payment_link: invoice.paymentLink,
          due_date: invoice.dueDate,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to save invoice');

      return this.mapDbInvoiceToInvoiceRecord(data);
    } catch (error) {
      console.error('Error saving invoice:', error);
      throw error;
    }
  }

  private mapDbInvoiceToInvoiceRecord(dbInvoice: DbInvoice): InvoiceRecord {
    return {
      id: dbInvoice.id,
      documentId: dbInvoice.document_id,
      type: dbInvoice.type,
      date: dbInvoice.date,
      customerName: dbInvoice.customer_name,
      customerAddress: dbInvoice.customer_address || '',
      from: dbInvoice.from_address,
      to: dbInvoice.to_address,
      amount: dbInvoice.amount,
      tokenSymbol: dbInvoice.token_symbol,
      decimals: dbInvoice.decimals,
      description: dbInvoice.description || '',
      tags: dbInvoice.tags || [],
      additionalNotes: dbInvoice.additional_notes || '',
      transactionHash: dbInvoice.transaction_hash,
      signatureStatus: dbInvoice.signature_status,
      signedBy: dbInvoice.signed_by,
      createdAt: dbInvoice.created_at,
      invoiceType: dbInvoice.invoice_type,
      status: dbInvoice.status,
      paymentLink: dbInvoice.payment_link,
      dueDate: dbInvoice.due_date,
      updatedAt: dbInvoice.updated_at
    };
  }
}

export const db = new DatabaseService();

// 启动过期检查
db.startExpirationCheck(); 