import SignClient from '@walletconnect/sign-client';
import { ethers } from 'ethers';

interface WalletConnectSession {
  uri: string;
  waitForConnection: () => Promise<string>;
}

let signClient: SignClient | null = null;
let currentSession: any = null;

export async function initWalletConnect() {
  if (signClient) return signClient;

  signClient = await SignClient.init({
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
    metadata: {
      name: 'ProofPay',
      description: 'Multi-wallet management for crypto payments',
      url: window.location.origin,
      icons: ['https://your-icon-url.com/icon.png']
    }
  });

  return signClient;
}

export async function createWalletConnectSession(message: string, targetAddress: string): Promise<WalletConnectSession> {
  const client = await initWalletConnect();
  if (!client) throw new Error('Failed to initialize WalletConnect');

  try {
    // 清理现有会话
    if (currentSession) {
      try {
        await client.disconnect({
          topic: currentSession.topic,
          reason: {
            code: 6000,
            message: 'User disconnected'
          }
        });
      } catch (e) {
        console.log('Failed to disconnect previous session:', e);
      }
      currentSession = null;
    }

    // 创建新会话
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        eip155: {
          methods: ['personal_sign', 'eth_sign'],
          chains: ['eip155:1'],
          events: ['chainChanged', 'accountsChanged']
        }
      }
    });

    if (!uri) throw new Error('Failed to get WalletConnect URI');

    return {
      uri,
      waitForConnection: async () => {
        try {
          const session = await approval();
          currentSession = session;

          if (!session?.namespaces?.eip155?.accounts?.[0]) {
            throw new Error('No account connected');
          }

          // 获取连接的钱包地址
          const account = session.namespaces.eip155.accounts[0].split(':')[2]?.toLowerCase();
          if (!account) {
            throw new Error('Failed to get wallet address');
          }

          // 验证钱包地址
          if (account !== targetAddress.toLowerCase()) {
            console.error('Address mismatch:', { account, targetAddress });
            throw new Error(`Please connect with the correct wallet (${targetAddress})`);
          }

          // 请求签名
          console.log('Requesting signature for message:', message);
          const signature = await client.request({
            topic: session.topic,
            chainId: 'eip155:1',
            request: {
              method: 'personal_sign',
              params: [message, account]
            }
          });

          // 验证签名
          console.log('Verifying signature:', {
            message,
            signature,
            account
          });

          const recoveredAddress = ethers.utils.verifyMessage(message, signature as string).toLowerCase();
          console.log('Signature verification result:', {
            recoveredAddress,
            account,
            isMatch: recoveredAddress === account
          });

          if (recoveredAddress === account) {
            console.log('Signature verification successful');
            return signature as string;
          } else {
            console.error('Signature verification failed:', {
              recoveredAddress,
              account,
              message
            });
            throw new Error('Signature verification failed - address mismatch');
          }
        } catch (error: any) {
          console.error('WalletConnect error:', error);
          // 清理会话
          if (currentSession) {
            try {
              await client.disconnect({
                topic: currentSession.topic,
                reason: {
                  code: 6000,
                  message: error.message
                }
              });
            } catch (e) {
              console.error('Failed to disconnect session:', e);
            }
            currentSession = null;
          }
          throw error;
        }
      }
    };
  } catch (error) {
    console.error('Failed to create WalletConnect session:', error);
    throw error;
  }
} 