import { useState, useEffect } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { shortenAddress } from '../utils/address';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { WalletSwitchingOverlay } from './WalletSwitchingOverlay';

export function WalletSwitcher() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingToAddress, setSwitchingToAddress] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const {
    mainWallet,
    currentConnectedWallet,
    availableWallets,
    setMainWallet,
    setCurrentConnectedWallet,
    removeWallet,
  } = useWalletStore();

  // 监听连接状态变化
  useEffect(() => {
    if (!isConnected && !isDisconnecting) {
      setCurrentConnectedWallet(null);
    } else if (address && !isDisconnecting) {
      if (!mainWallet) {
        setMainWallet(address);
      }
      setCurrentConnectedWallet(address);
    }
  }, [isConnected, address, mainWallet, isDisconnecting]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [error]);

  // 如果正在切换钱包，显示过渡页面而不是初始页面
  if (isSwitching && switchingToAddress) {
    return <WalletSwitchingOverlay targetAddress={switchingToAddress} />;
  }

  // 如果没有连接钱包且不是在切换过程中，不显示任何内容
  if (!isConnected && !isSwitching) {
    return null;
  }

  const handleWalletSwitch = async (newAddress: string) => {
    try {
      // 设置切换状态
      setIsSwitching(true);
      setSwitchingToAddress(newAddress);
      setError(null);
      setIsOpen(false);

      // 标记正在断开连接
      setIsDisconnecting(true);
      
      // 断开当前连接
      await disconnectAsync();

      const connector = connectors.find(c => c.id === 'metaMask');
      if (!connector) {
        throw new Error('MetaMask connector not found');
      }

      // 连接新钱包
      const result = await connectAsync({ connector });

      // 验证连接的地址是否正确
      if (!result.accounts?.[0] || result.accounts[0].toLowerCase() !== newAddress.toLowerCase()) {
        throw new Error('请在MetaMask中选择正确的账户地址');
      }

      // 更新状态
      setCurrentConnectedWallet(newAddress);
      
      // 成功后等待一小段时间再关闭过渡页面
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error('Failed to switch wallet:', error);
      
      if (error.message.includes('User rejected')) {
        setError('用户取消了操作');
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        setError(error.message || '切换钱包失败，请重试');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // 尝试恢复之前的连接
      try {
        const connector = connectors.find(c => c.id === 'metaMask');
        if (connector) {
          await connectAsync({ connector });
        }
      } catch (e) {
        console.error('Failed to recover connection:', e);
      }
    } finally {
      // 重置所有状态
      setIsSwitching(false);
      setSwitchingToAddress(null);
      setError(null);
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
      >
        <div className="flex items-center">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 mr-2">
            <svg className="h-3 w-3 text-orange-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
          </span>
          <span className="text-sm font-medium">
            {shortenAddress(currentConnectedWallet || address || '')}
          </span>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          <div className="p-2">
            <div className="px-3 py-2 text-sm font-medium text-gray-900">钱包管理</div>
            
            <div className="space-y-1">
              {/* 主钱包 */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                      <svg className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">主钱包</p>
                    <p className="text-xs text-gray-500 font-mono">{shortenAddress(mainWallet || '')}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  {mainWallet?.toLowerCase() === currentConnectedWallet?.toLowerCase() ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      当前连接
                    </span>
                  ) : (
                    <button
                      onClick={() => handleWalletSwitch(mainWallet!)}
                      disabled={isSwitching}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSwitching ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          切换中
                        </div>
                      ) : '切换'}
                    </button>
                  )}
                </div>
              </div>

              {availableWallets.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500">
                    已验证的子钱包
                  </div>

                  {availableWallets.map((wallet) => (
                    <div
                      key={wallet.address}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                            <svg className="h-4 w-4 text-orange-600" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{wallet.label}</p>
                          <p className="text-xs text-gray-500 font-mono">{shortenAddress(wallet.address)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {wallet.address.toLowerCase() === currentConnectedWallet?.toLowerCase() ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            当前连接
                          </span>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => {
                                // 设置切换状态和目标地址
                                setIsSwitching(true);
                                setSwitchingToAddress(wallet.address);
                                // 调用切换函数
                                handleWalletSwitch(wallet.address);
                              }}
                              disabled={isSwitching}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSwitching ? (
                                <div className="flex items-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  切换中
                                </div>
                              ) : '切换'}
                            </button>
                            <button
                              onClick={() => removeWallet(wallet.address)}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200"
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {error && (
              <div className="px-3 py-2 mt-1 text-xs text-red-600 bg-red-50 rounded-lg">{error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}