import { Transaction } from '../types/transaction';
import axios from 'axios';

const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
const ETHERSCAN_API = 'https://api.etherscan.io/api';

// 限制查询范围为最近 30 天
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
const startTimestamp = Math.floor(Date.now() / 1000) - THIRTY_DAYS_IN_SECONDS;

export const blockchain = {
  async getEthereumTransactions(address: string): Promise<Transaction[]> {
    try {
      const [normalTxs, tokenTxs] = await Promise.all([
        getEthTransactions(address),
        getTokenTransactions(address),
      ]);

      return [...normalTxs, ...tokenTxs].sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error fetching Ethereum transactions:', error);
      return [];
    }
  }
};

async function getEthTransactions(address: string): Promise<Transaction[]> {
  try {
    const response = await axios.get(ETHERSCAN_API, {
      params: {
        module: 'account',
        action: 'txlist',
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
          tokenSymbol: 'ETH',
          chain: 'ethereum' as const,
        }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

async function getTokenTransactions(address: string): Promise<Transaction[]> {
  try {
    const response = await axios.get(ETHERSCAN_API, {
      params: {
        module: 'account',
        action: 'tokentx',
        address,
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
          tokenSymbol: tx.tokenSymbol,
          chain: 'ethereum' as const,
        }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching token transactions:', error);
    return [];
  }
} 