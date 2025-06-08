import React from 'react';
import { shortenAddress } from '../utils/address';

interface WalletSwitchingOverlayProps {
  targetAddress: string;
}

export function WalletSwitchingOverlay({ targetAddress }: WalletSwitchingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>
      <div className="relative max-w-md w-full mx-4 p-8 bg-white rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-indigo-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">
            正在切换钱包
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            请在 MetaMask 中选择地址：
          </p>
          <div className="bg-gray-50 rounded-lg px-6 py-3 font-mono text-sm text-gray-700">
            {shortenAddress(targetAddress)}
          </div>
          <p className="mt-6 text-sm text-gray-500">
            请确认切换请求并等待操作完成...
          </p>
        </div>
      </div>
    </div>
  );
} 