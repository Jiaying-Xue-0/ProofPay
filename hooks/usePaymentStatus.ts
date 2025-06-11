import { useEffect, useState } from 'react';
import { useAccount, useContractRead, useChainId, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { db } from '../services/db';
import { PaymentRequest } from '../types/storage';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function transferFrom(address from, address to, uint256 value) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export function usePaymentStatus(paymentRequest: PaymentRequest) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [status, setStatus] = useState(paymentRequest.status);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 检查代币余额
  const { data: balance } = useContractRead({
    address: paymentRequest.token_address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
    chainId,
  });

  useEffect(() => {
    if (!address || chainId !== Number(paymentRequest.chain_id) || !publicClient) {
      return;
    }

    // 如果已经不是pending状态，不需要继续监听
    if (status !== 'pending') {
      return;
    }

    // 检查是否过期
    const expirationDate = new Date(paymentRequest.expires_at);
    if (expirationDate < new Date()) {
      setStatus('expired');
      db.updatePaymentRequestStatus(paymentRequest.id, 'expired');
      return;
    }

    // 创建provider和合约实例
    const provider = new ethers.providers.JsonRpcProvider(publicClient.transport.url);
    const contract = new ethers.Contract(paymentRequest.token_address, ERC20_ABI, provider);

    // 监听Transfer事件
    const filter = contract.filters.Transfer(address, paymentRequest.requester_address);
    
    const handleTransfer = async (from: string, to: string, value: ethers.BigNumber) => {
      try {
        setIsLoading(true);
        
        // 检查金额是否匹配
        const decimals = await contract.decimals();
        const expectedAmount = ethers.utils.parseUnits(paymentRequest.amount, decimals);
        
        if (value.eq(expectedAmount) && 
            from.toLowerCase() === address?.toLowerCase() && 
            to.toLowerCase() === paymentRequest.requester_address.toLowerCase()) {
          setStatus('paid');
          await db.updatePaymentRequestStatus(paymentRequest.id, 'paid');
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
  }, [address, chainId, paymentRequest, status]);

  return {
    status,
    isLoading,
    error,
    balance,
  };
} 