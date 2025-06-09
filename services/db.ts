import { createClient } from '@supabase/supabase-js';
import { InvoiceRecord } from '../types/storage';

// 创建 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface DbWallet {
  address: string;
  label: string;
  parent_wallet?: string;
  is_main: boolean;
}

class DatabaseService {
  async saveWallet(wallet: DbWallet): Promise<DbWallet> {
    try {
      console.log('Saving wallet:', { ...wallet, address: wallet.address.slice(0, 10) + '...' });

      // 检查钱包是否已存在
      const { data: existingWallet } = await supabase
        .from('wallets')
        .select()
        .eq('address', wallet.address.toLowerCase())
        .maybeSingle();

      if (existingWallet) {
        // 如果钱包已存在，更新它
        const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { error } = await supabase
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
      const { data: wallet } = await supabase
        .from('wallets')
        .select()
        .eq('address', invoice.from.toLowerCase())
        .maybeSingle();

      // 如果是子钱包，使用父钱包地址作为 wallet_address
      const walletAddress = wallet?.parent_wallet || invoice.from.toLowerCase();

      const { data, error } = await supabase
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
          created_at: Date.now()
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
      const { data, error } = await supabase
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
      const { data: wallet } = await supabase
        .from('wallets')
        .select()
        .eq('address', normalizedAddress)
        .single();

      let relatedAddresses: string[] = [normalizedAddress];

      if (wallet?.is_main) {
        // 如果是主钱包，获取所有子钱包
        const { data: subWallets } = await supabase
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
        const { data: siblingWallets } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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

  private mapDbInvoiceToInvoiceRecord(dbInvoice: any): InvoiceRecord {
    return {
      id: dbInvoice.id,
      documentId: dbInvoice.document_id,
      type: dbInvoice.type,
      date: dbInvoice.date,
      customerName: dbInvoice.customer_name,
      customerAddress: dbInvoice.customer_address,
      from: dbInvoice.from_address,
      to: dbInvoice.to_address,
      amount: dbInvoice.amount,
      tokenSymbol: dbInvoice.token_symbol,
      decimals: dbInvoice.decimals,
      description: dbInvoice.description,
      tags: dbInvoice.tags,
      additionalNotes: dbInvoice.additional_notes,
      transactionHash: dbInvoice.transaction_hash,
      signatureStatus: dbInvoice.signature_status,
      signedBy: dbInvoice.signed_by,
      walletAddress: dbInvoice.wallet_address,
      createdAt: dbInvoice.created_at,
    };
  }
}

export const db = new DatabaseService(); 