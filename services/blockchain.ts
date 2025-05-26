import { Transaction } from '../types/transaction';
import axios from 'axios';

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

export const blockchain = {
  async getTransactions(address: string, network: 'ethereum' | 'polygon' | 'optimism' | 'arbitrum'): Promise<Transaction[]> {
    try {
      const [normalTxs, tokenTxs] = await Promise.all([
        getTransactions(address, network, 'normal'),
        getTransactions(address, network, 'token'),
      ]);

      return [...normalTxs, ...tokenTxs].sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error(`Error fetching ${network} transactions:`, error);
      return [];
    }
  }
};

async function getTransactions(
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
      return response.data.result
        .filter((tx: any) => parseInt(tx.timeStamp) >= startTimestamp)
        .map((tx: any) => ({
          hash: tx.hash,
          timestamp: parseInt(tx.timeStamp),
          from: tx.from,
          to: tx.to,
          value: tx.value,
          tokenSymbol: type === 'normal' ? network.toUpperCase() : tx.tokenSymbol,
          chain: network,
        }));
    }

    return [];
  } catch (error) {
    console.error(`Error fetching ${type} transactions for ${network}:`, error);
    return [];
  }
} 