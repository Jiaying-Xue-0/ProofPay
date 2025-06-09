import { useState, useEffect, useRef } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { shortenAddress } from '../utils/address';
import { useConnectModal } from '@rainbow-me/rainbowkit';

export function WalletSwitcher() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    mainWallet,
    currentConnectedWallet,
    availableWallets,
    setMainWallet,
    setCurrentConnectedWallet,
    removeWallet,
    isSubWallet,
    resetAllWalletData,
    isSwitchingWallet,
    switchingToAddress,
    setSwitchingWallet,
  } = useWalletStore();

  // 处理点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 如果未连接钱包，不显示组件
  if (!isConnected) {
    return null;
  }

  // 监听连接状态变化
  useEffect(() => {
    if (!isConnected && !isDisconnecting) {
      setCurrentConnectedWallet(null);
      // 不再自动清除所有钱包数据
    } else if (address && !isDisconnecting) {
      setCurrentConnectedWallet(address);
    }
  }, [isConnected, address, isDisconnecting, setCurrentConnectedWallet]);

  const handleWalletSwitch = async (newAddress: string) => {
    if (isSwitchingWallet) {
      return;
    }

    try {
      setSwitchingWallet(true, newAddress);
      setError(null);
      setIsOpen(false);
      setIsDisconnecting(true);
      
      await disconnectAsync();

      const connector = connectors.find(c => c.id === 'metaMask');
      if (!connector) {
        throw new Error('MetaMask connector not found');
      }

      const result = await connectAsync({ connector });

      if (!result.accounts?.[0] || result.accounts[0].toLowerCase() !== newAddress.toLowerCase()) {
        throw new Error('请在MetaMask中选择正确的账户地址');
      }

      setCurrentConnectedWallet(newAddress);
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      if (error.message.includes('User rejected')) {
        setError('用户取消了操作');
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        setError(error.message || '切换钱包失败，请重试');
      }
      
      try {
        const connector = connectors.find(c => c.id === 'metaMask');
        if (connector) {
          await connectAsync({ connector });
        }
      } catch (e) {
        console.error('Failed to recover connection:', e);
      }
    } finally {
      setSwitchingWallet(false, null);
      setError(null);
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
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
        <div 
          className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100"
          style={{ zIndex: 100 }}
        >
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
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      当前连接
                    </span>
                  ) : (
                    <button
                      onClick={() => handleWalletSwitch(mainWallet!)}
                      disabled={isSwitchingWallet}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSwitchingWallet ? (
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            当前连接
                          </span>
                        ) : (
                          <button
                            onClick={() => handleWalletSwitch(wallet.address)}
                            disabled={isSwitchingWallet}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSwitchingWallet ? (
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