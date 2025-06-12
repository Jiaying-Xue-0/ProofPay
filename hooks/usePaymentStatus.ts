import { useEffect, useState } from 'react';
import { useAccount, useContractRead, useChainId, usePublicClient, useSwitchChain } from 'wagmi';
import { ethers } from 'ethers';
import { db } from '../services/db';
import { PaymentRequest } from '../types/storage';
import useSWR from 'swr';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function transferFrom(address from, address to, uint256 value) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export function usePaymentStatus(paymentRequest: PaymentRequest) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  // 使用 SWR 获取最新的支付状态
  const { data: latestPaymentRequest, mutate } = useSWR(
    paymentRequest.id ? ['payment_request', paymentRequest.id] : null,
    async () => {
      const { data, error } = await db.getPaymentRequest(paymentRequest.id);
      if (error) throw error;
      return data;
    },
    {
      refreshInterval: 5000, // 每5秒自动刷新
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  );

  // 检查并切换网络
  useEffect(() => {
    if (!isConnected) {
      setError('请先连接钱包');
      return;
    }

    const requestedChainId = Number(paymentRequest.chain_id);
    if (chainId !== requestedChainId) {
      setIsWrongNetwork(true);
      if (switchChain) {
        switchChain({ chainId: requestedChainId });
      }
    } else {
      setIsWrongNetwork(false);
    }
  }, [chainId, isConnected, paymentRequest.chain_id, switchChain]);

  // 检查代币余额
  const { data: balance, isError: balanceError } = useContractRead({
    address: paymentRequest.token_address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
    chainId: Number(paymentRequest.chain_id),
    query: {
      enabled: isConnected && !isWrongNetwork,
    },
  });

  useEffect(() => {
    if (!isConnected || isWrongNetwork || !address || !publicClient) {
      return;
    }

    // 如果已经不是pending状态，不需要继续监听
    if (latestPaymentRequest?.status !== 'pending') {
      return;
    }

    // 检查是否过期
    const expirationDate = new Date(paymentRequest.expires_at);
    if (expirationDate < new Date()) {
      db.updatePaymentRequestStatus(paymentRequest.id, 'expired');
      mutate(); // 刷新状态
      return;
    }

    // 创建provider和合约实例
    const provider = new ethers.providers.JsonRpcProvider(publicClient.transport.url);
    const contract = new ethers.Contract(paymentRequest.token_address, ERC20_ABI, provider);

    // 监听Transfer事件
    const filter = contract.filters.Transfer(null, paymentRequest.requester_address);
    
    const handleTransfer = async (from: string, to: string, value: ethers.BigNumber) => {
      try {
        setIsLoading(true);
        
        // 检查金额是否匹配
        const decimals = await contract.decimals();
        const expectedAmount = ethers.utils.parseUnits(paymentRequest.amount, decimals);
        
        if (value.eq(expectedAmount) && 
            to.toLowerCase() === paymentRequest.requester_address.toLowerCase()) {
          await db.updatePaymentRequestStatus(paymentRequest.id, 'paid', from);
          mutate(); // 刷新状态
        }
      } catch (err) {
        console.error('Error handling transfer:', err);
        setError(err instanceof Error ? err.message : '处理支付时出错');
      } finally {
        setIsLoading(false);
      }
    };

    contract.on(filter, handleTransfer);

    // 清理函数
    return () => {
      contract.removeListener(filter, handleTransfer);
    };
  }, [address, chainId, paymentRequest, latestPaymentRequest?.status, isConnected, isWrongNetwork, publicClient, mutate]);

  return {
    status: latestPaymentRequest?.status || paymentRequest.status,
    isLoading,
    error,
    balance,
    isWrongNetwork,
    balanceError,
  };
} 