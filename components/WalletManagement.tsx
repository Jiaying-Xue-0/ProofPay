import { useState, useEffect, useCallback } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useAccount, useConnect, useDisconnect, Connector } from 'wagmi';
import { shortenAddress } from '../utils/address';
import { QRCodeSVG } from 'qrcode.react';
import { createWalletConnectSession } from '../utils/walletConnect';
import { WalletSwitchingOverlay } from './WalletSwitchingOverlay';
import { createPortal } from 'react-dom';

export function WalletManagement() {
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'idle' | 'verify' | 'success'>('idle');
  const [signatureMessage, setSignatureMessage] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [waitForConnection, setWaitForConnection] = useState<(() => Promise<string>) | null>(null);
  const [successWalletAddress, setSuccessWalletAddress] = useState<string>('');
  const [isSwitching, setIsSwitching] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [switchingToAddress, setSwitchingToAddress] = useState<string | null>(null);

  const {
    mainWallet,
    currentConnectedWallet,
    availableWallets,
    addWallet,
    removeWallet,
    setMainWallet,
    setCurrentConnectedWallet,
  } = useWalletStore();

  // 生成签名消息
  const generateMessage = useCallback((parentAddress: string, subWalletAddress: string) => {
    return `ProofPay 验证：我证明我拥有地址 ${subWalletAddress}，并将其添加到我的账户 ${parentAddress}
时间戳：${new Date().toISOString()}`;
  }, []);

  // 获取钱包标签
  const getWalletLabel = useCallback((walletAddress: string) => {
    const wallet = availableWallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());
    return wallet?.label || '';
  }, [availableWallets]);

  // 监听钱包连接状态变化
  useEffect(() => {
    // 只在非切换状态下处理连接变化
    if (!isSwitching) {
      if (!isConnected) {
        setCurrentConnectedWallet(null);
      } else if (address && !mainWallet) {
        setMainWallet(address);
        setCurrentConnectedWallet(address);
      }
    }
  }, [isConnected, address, isSwitching, mainWallet, setMainWallet, setCurrentConnectedWallet]);

  // 监听状态变化
  useEffect(() => {
    if (isSwitching && switchingToAddress) {
      // 状态变化 - 显示过渡页面
    }
  }, [isSwitching, switchingToAddress]);

  // 处理钱包切换
  const handleWalletSwitch = useCallback(async (newAddress: string) => {
    // 如果已经在切换中，直接返回
    if (isSwitching) {
      return;
    }

    try {
      // 同步更新状态
      setIsSwitching(true);
      setSwitchingToAddress(newAddress);

      // 等待状态更新完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 断开当前连接
      await disconnectAsync();

      // 等待一段时间确保断开连接完成
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        // 连接新钱包
        const result = await connectAsync({
          connector: activeConnector!,
          chainId: 1,
        });

        // 验证连接的地址是否正确
        if (!result.accounts?.[0] || result.accounts[0].toLowerCase() !== newAddress.toLowerCase()) {
          throw new Error('请在MetaMask中选择正确的账户地址');
        }

        // 更新当前连接的钱包
        setCurrentConnectedWallet(newAddress);
        
        // 等待一段时间后关闭过渡页面
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 只有在成功连接后才重置状态
        setIsSwitching(false);
        setSwitchingToAddress(null);
        setError(null);
      } catch (error: any) {
        // 如果是用户取消或者选择了错误的地址，保持切换状态
        if (error.message.includes('User rejected') || error.message.includes('请在MetaMask中选择正确的账户地址')) {
          setError(error.message.includes('User rejected') ? '用户取消了操作' : error.message);
          // 不重置切换状态，让用户可以重试
          return;
        }
        throw error; // 其他错误继续向外抛出
      }
    } catch (error: any) {
      if (error.message.includes('already pending')) {
        setError('有一个切换请求正在进行中，请等待完成后再试');
      } else {
        setError(error.message || '切换钱包失败，请重试');
      }
      
      // 尝试恢复之前的连接
      try {
        if (activeConnector) {
          await connectAsync({
            connector: activeConnector,
            chainId: 1,
          });
        }
      } catch (e) {
        // 恢复连接失败，继续处理
      }

      // 只有在发生严重错误时才重置状态
      setIsSwitching(false);
      setSwitchingToAddress(null);
      setError(null);
    }
  }, [activeConnector, connectAsync, disconnectAsync, setCurrentConnectedWallet, isSwitching]);

  // 处理开始验证
  const handleStartVerification = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!address) {
        setError('请先连接主钱包');
        return;
      }

      if (!newWalletAddress || !newWalletLabel) {
        setError('请填写完整信息');
        return;
      }

      if (availableWallets.length >= 2) {
        setError('最多只能添加2个子钱包');
        return;
      }

      // 验证钱包地址格式
      if (!newWalletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        setError('无效的钱包地址格式，请确保地址以0x开头并且长度正确');
        return;
      }

      // 检查是否已经添加过这个钱包
      if (availableWallets.some(w => w.address.toLowerCase() === newWalletAddress.toLowerCase())) {
        setError('该钱包地址已经添加过了');
        return;
      }

      // 检查是否与主钱包地址相同
      if (address.toLowerCase() === newWalletAddress.toLowerCase()) {
        setError('不能添加主钱包地址作为子钱包');
        return;
      }

      // 生成签名消息
      const message = generateMessage(address, newWalletAddress);
      setSignatureMessage(message);

      // 创建 WalletConnect 会话
      const session = await createWalletConnectSession(message, newWalletAddress);
      setQrCodeUrl(session.uri);
      setWaitForConnection(() => session.waitForConnection);

      setVerificationStep('verify');

      // 等待用户扫码并签名
      if (session.waitForConnection) {
        try {
          const signature = await session.waitForConnection();
          await handleVerifySignature(signature);
        } catch (err: any) {
          console.error('Verification error:', err);
          let errorMessage = '验证失败: ';
          
          if (err.message.includes('User rejected')) {
            errorMessage += '用户取消了签名请求';
          } else if (err.message.includes('Please connect with the correct wallet')) {
            errorMessage += '请确保使用正确的钱包地址进行扫码 (' + newWalletAddress + ')';
          } else if (err.message.includes('Failed to get wallet address')) {
            errorMessage += '无法获取钱包地址，请重试';
          } else if (err.message.includes('Signature verification failed')) {
            errorMessage += '签名验证失败，请确保使用正确的钱包';
          } else if (err.message.includes('No matching key') || err.message.includes('session topic')) {
            errorMessage += '会话已失效，请重新扫码';
          } else if (err.message.includes('network')) {
            errorMessage += '网络连接错误，请检查你的网络连接并重试';
          } else {
            errorMessage += err.message;
          }
          
          setError(errorMessage);
          setVerificationStep('idle');
          setQrCodeUrl('');
          setWaitForConnection(null);
        }
      }

    } catch (err: any) {
      console.error('Failed to start verification:', err);
      setError('启动验证流程失败：' + (err.message || '未知错误'));
      setVerificationStep('idle');
    } finally {
      setIsLoading(false);
    }
  }, [
    address,
    newWalletAddress,
    newWalletLabel,
    availableWallets,
    generateMessage,
    setError,
    setIsLoading,
    setSignatureMessage,
    setQrCodeUrl,
    setWaitForConnection,
    setVerificationStep
  ]);

  // 处理验证签名
  const handleVerifySignature = useCallback(async (signature: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // 保存成功的钱包地址用于显示
      setSuccessWalletAddress(newWalletAddress);

      // 添加新钱包
      addWallet({
        address: newWalletAddress,
        label: newWalletLabel,
        verified: true,
        parentWallet: address!,
      });

      // 更新状态
      setVerificationStep('success');
      
      // 清空输入
      setNewWalletAddress('');
      setNewWalletLabel('');
      setSignatureMessage('');
      setQrCodeUrl('');
      setWaitForConnection(null);

    } catch (err: any) {
      console.error('Failed to verify signature:', err);
      setError('验证失败：' + err.message);
      setVerificationStep('idle');
    } finally {
      setIsLoading(false);
    }
  }, [
    newWalletAddress,
    newWalletLabel,
    address,
    addWallet,
    setSuccessWalletAddress,
    setNewWalletAddress,
    setNewWalletLabel,
    setSignatureMessage,
    setQrCodeUrl,
    setWaitForConnection,
    setVerificationStep,
    setError,
    setIsLoading
  ]);

  // 渲染切换按钮
  const renderSwitchButton = useCallback((targetAddress: string) => {
    return (
      <button
        onClick={() => handleWalletSwitch(targetAddress)}
        disabled={isSwitching}
        className="inline-flex items-center px-3 py-1.5 border border-indigo-600 text-xs font-medium rounded-lg text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSwitching ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            切换中...
          </>
        ) : (
          '切换'
        )}
      </button>
    );
  }, [isSwitching, handleWalletSwitch]);

  // 如果没有连接钱包，不显示任何内容
  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="relative">
      {/* 切换过渡页面 */}
      {isSwitching && switchingToAddress && createPortal(
        <WalletSwitchingOverlay targetAddress={switchingToAddress} />,
        document.body
      )}

      {/* 主要内容 */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-gray-100">
          <div className="p-4 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900">钱包管理</h2>
            <p className="mt-1 text-sm text-gray-500">
              管理你的主钱包和子钱包。你可以添加最多2个子钱包，并在它们之间切换。
            </p>

            {/* 钱包状态卡片 */}
            <div className="mt-4 sm:mt-6 space-y-4">
              {/* 主钱包卡片 */}
              <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-violet-50 rounded-xl p-3 sm:p-4 border border-indigo-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-600 bg-opacity-10 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-gray-900">主钱包</span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">Root</span>
                      </div>
                      <p className="mt-1 text-sm font-mono text-gray-600">{mainWallet}</p>
                    </div>
                  </div>
                  {mainWallet === currentConnectedWallet && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      当前连接
                    </span>
                  )}
                  {mainWallet !== currentConnectedWallet && renderSwitchButton(mainWallet!)}
                </div>
              </div>

              {/* 当前连接的钱包卡片（如果不是主钱包） */}
              {currentConnectedWallet && currentConnectedWallet !== mainWallet && (
                <div className="bg-white rounded-xl p-4 border-2 border-dashed border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500 bg-opacity-10 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-6h2v2h-2zm0-8h2v6h-2z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-gray-900">当前连接的钱包</span>
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                        </div>
                        <div className="mt-1">
                          <p className="text-sm font-medium text-gray-900">{getWalletLabel(currentConnectedWallet)}</p>
                          <p className="text-sm font-mono text-gray-600">{currentConnectedWallet}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 已验证的子钱包列表 */}
            {availableWallets.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                  </svg>
                  <span>已验证的子钱包</span>
                </h3>
                <div className="mt-3 space-y-3">
                  {availableWallets.map((wallet) => (
                    <div
                      key={wallet.address}
                      className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200 hover:border-indigo-200 transition-colors duration-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{wallet.label}</p>
                          <p className="text-xs font-mono text-gray-500">{wallet.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {wallet.address.toLowerCase() === currentConnectedWallet?.toLowerCase() ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            当前连接
                          </span>
                        ) : (
                          renderSwitchButton(wallet.address)
                        )}
                        <button
                          onClick={() => removeWallet(wallet.address)}
                          className="inline-flex items-center px-3 py-1.5 border border-red-200 text-xs font-medium rounded-lg text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 添加新钱包表单 */}
            <div className="mt-8">
              <h3 className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                </svg>
                <span>添加新钱包</span>
              </h3>
              <div className="mt-2 space-y-4">
                {verificationStep === 'idle' && (
                  <div>
                    <div className="mt-6 sm:mt-8">
                      <label htmlFor="walletAddress" className="block text-sm font-medium text-gray-700">
                        钱包地址
                      </label>
                      <div className="mt-2 sm:mt-3 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          id="walletAddress"
                          placeholder="0x..."
                          value={newWalletAddress}
                          onChange={(e) => setNewWalletAddress(e.target.value)}
                          className="pl-10 block w-full h-10 sm:h-12 rounded-lg border-gray-300 bg-gray-50 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div className="mt-6 sm:mt-8">
                      <label htmlFor="walletLabel" className="block text-sm font-medium text-gray-700">
                        钱包标签
                      </label>
                      <div className="mt-2 sm:mt-3 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          id="walletLabel"
                          placeholder="如：交易钱包"
                          value={newWalletLabel}
                          onChange={(e) => setNewWalletLabel(e.target.value)}
                          className="pl-10 block w-full h-10 sm:h-12 rounded-lg border-gray-300 bg-gray-50 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </div>
                      <p className="mt-2 sm:mt-3 text-sm text-gray-500">
                        为钱包添加一个便于识别的标签
                      </p>
                    </div>

                    <div className="mt-8 sm:mt-10">
                      <button
                        onClick={handleStartVerification}
                        disabled={isLoading || !newWalletAddress || !newWalletLabel}
                        className="w-full flex justify-center items-center px-4 py-2.5 sm:py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                      >
                        {isLoading ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            验证中...
                          </div>
                        ) : (
                          '开始验证'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {verificationStep === 'verify' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 01-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">请使用子钱包扫码签名</h3>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>签名消息：</p>
                            <pre className="mt-1 whitespace-pre-wrap font-mono text-xs bg-blue-100 p-2 rounded">
                              {signatureMessage}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    {qrCodeUrl && (
                      <div className="flex justify-center">
                        <QRCodeSVG
                          value={qrCodeUrl}
                          size={256}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                    )}
                  </div>
                )}

                {verificationStep === 'success' && (
                  <div className="bg-green-50 border border-green-100 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">
                          验证成功！
                        </h3>
                        <div className="mt-2 text-sm text-green-700">
                          <p>子钱包 {shortenAddress(successWalletAddress)} 已成功添加。</p>
                        </div>
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setVerificationStep('idle');
                              setSuccessWalletAddress('');
                            }}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            添加另一个钱包
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-red-800">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {verificationStep === 'idle' && (
                  <p className="mt-2 text-xs text-gray-500">
                    提示：请确保该地址为你本人控制的钱包。每个账户最多可以添加2个子钱包。添加过程中需要使用子钱包进行签名验证。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 