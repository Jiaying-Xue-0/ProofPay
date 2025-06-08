import { Transaction } from '../types/transaction';
import axios from 'axios';
import { ethers } from 'ethers';

const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;

// API endpoints for different networks
const API_ENDPOINTS = {
  ethereum: 'https://api.etherscan.io/api',
  polygon: 'https://api.polygonscan.com/api',
  optimism: 'https://api-optimistic.etherscan.io/api',
  arbitrum: 'https://api.arbiscan.io/api',
};

// 限制查询范围为最近 30 天
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
const startTimestamp = Math.floor(Date.now() / 1000) - THIRTY_DAYS_IN_SECONDS;

export interface TransactionDetails {
  blockNumber: number;
  status: string;
  chainId: number;
}

class BlockchainService {
  async getTransactionDetails(txHash: string): Promise<TransactionDetails | null> {
    try {
      // 获取交易详情
      const txResponse = await axios.get(API_ENDPOINTS.ethereum, {
        params: {
          module: 'proxy',
          action: 'eth_getTransactionByHash',
          txhash: txHash,
          apikey: ETHERSCAN_API_KEY,
        },
      });

      if (!txResponse.data.result) {
        return null;
      }

      const tx = txResponse.data.result;

      // 获取交易收据（包含状态）
      const receiptResponse = await axios.get(API_ENDPOINTS.ethereum, {
        params: {
          module: 'proxy',
          action: 'eth_getTransactionReceipt',
          txhash: txHash,
          apikey: ETHERSCAN_API_KEY,
        },
      });

      if (!receiptResponse.data.result) {
        return null;
      }

      const receipt = receiptResponse.data.result;

      // 获取区块信息（包含时间戳）
      const blockResponse = await axios.get(API_ENDPOINTS.ethereum, {
        params: {
          module: 'block',
          action: 'getblockreward',
          blockno: parseInt(receipt.blockNumber, 16).toString(),
          apikey: ETHERSCAN_API_KEY,
        },
      });

      if (blockResponse.data.status !== '1' || !blockResponse.data.result) {
        return null;
      }

      return {
        blockNumber: parseInt(receipt.blockNumber, 16),
        status: receipt.status === '0x1' ? 'success' : 'failed',
        chainId: 1, // Assuming chainId is 1 for Ethereum
      };
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      return null;
    }
  }

  getExplorerUrl(txHash: string, chainId: number = 1): string {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io',
      5: 'https://goerli.etherscan.io',
      11155111: 'https://sepolia.etherscan.io',
    };
    
    const baseUrl = explorers[chainId] || explorers[1];
    return `${baseUrl}/tx/${txHash}`;
  }

  async getTransactions(address: string, network: 'ethereum' | 'polygon' | 'optimism' | 'arbitrum'): Promise<Transaction[]> {
    try {
      const [normalTxs, tokenTxs] = await Promise.all([
        this.getTransactionsByType(address, network, 'normal'),
        this.getTransactionsByType(address, network, 'token'),
      ]);

      return [...normalTxs, ...tokenTxs].sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error(`Error fetching ${network} transactions:`, error);
      return [];
    }
  }

  private async getTransactionsByType(
    address: string, 
    network: 'ethereum' | 'polygon' | 'optimism' | 'arbitrum',
    type: 'normal' | 'token'
  ): Promise<Transaction[]> {
    try {
      const response = await axios.get(API_ENDPOINTS[network], {
        params: {
          module: 'account',
          action: type === 'normal' ? 'txlist' : 'tokentx',
          address,
          startblock: 0,
          endblock: 99999999,
          sort: 'desc',
          apikey: ETHERSCAN_API_KEY,
        },
      });

      if (response.data.status === '1' && response.data.result) {
        const startTimestamp = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // 30 days ago
        return response.data.result
          .filter((tx: any) => parseInt(tx.timeStamp) >= startTimestamp)
          .map((tx: any) => {
            // 处理原生代币交易
            if (type === 'normal') {
              return {
                hash: tx.hash,
                timestamp: parseInt(tx.timeStamp),
                from: tx.from,
                to: tx.to,
                value: tx.value,
                tokenSymbol: network.toUpperCase(),
                chain: network,
                decimals: 18, // 原生代币（ETH等）都是18位小数
              };
            }
            
            // 处理代币交易
            return {
              hash: tx.hash,
              timestamp: parseInt(tx.timeStamp),
              from: tx.from,
              to: tx.to,
              value: tx.value,
              tokenSymbol: tx.tokenSymbol,
              chain: network,
              contractAddress: tx.contractAddress,
              decimals: parseInt(tx.tokenDecimal), // Etherscan API 返回的代币精度
            };
          });
      }

      return [];
    } catch (error) {
      console.error(`Error fetching ${type} transactions for ${network}:`, error);
      return [];
    }
  }

  async verifySignature(message: string, signature: string): Promise<string> {
    try {
      return ethers.utils.verifyMessage(message, signature);
    } catch (error) {
      console.error('Error verifying signature:', error);
      throw new Error('签名验证失败');
    }
  }
}

export const blockchain = new BlockchainService(); 