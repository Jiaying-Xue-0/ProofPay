import { create } from 'zustand';
import { ethers } from 'ethers';
import { db } from '../services/db';

export interface Wallet {
  address: string;
  label: string;
  parentWallet?: string;
}

interface WalletState {
  mainWallet: string | null;
  currentConnectedWallet: string | null;
  availableWallets: Wallet[];
  isSwitchingWallet: boolean;
  switchingToAddress: string | null;
  isInitializing: boolean;
  setMainWallet: (address: string) => Promise<void>;
  setCurrentConnectedWallet: (address: string | null) => void;
  addWallet: (wallet: Wallet) => Promise<void>;
  removeWallet: (address: string) => Promise<void>;
  clearWallets: () => Promise<void>;
  resetAllWalletData: () => Promise<void>;
  isSubWallet: (address: string) => boolean;
  verifyWalletOwnership: (address: string, provider: any) => Promise<boolean>;
  setSwitchingWallet: (isSwitching: boolean, targetAddress: string | null) => void;
  setIsInitializing: (isInitializing: boolean) => void;
  initializeWallet: (address: string) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  mainWallet: null,
  currentConnectedWallet: null,
  availableWallets: [],
  isSwitchingWallet: false,
  switchingToAddress: null,
  isInitializing: false,

  setIsInitializing: (isInitializing: boolean) => {
    set({ isInitializing });
  },

  initializeWallet: async (address: string) => {
    const normalizedAddress = address.toLowerCase();
    
    try {
      set({ isInitializing: true });

      // 1. 首先检查这个地址是否是子钱包
      const subWalletData = await db.getSubWallet(normalizedAddress);
      
      if (subWalletData) {
        // 如果是子钱包，获取其主钱包数据
        const mainWalletData = await db.getMainWallet(subWalletData.parent_wallet);
        if (!mainWalletData) {
          throw new Error('Cannot find main wallet data');
        }

        // 设置主钱包和当前连接的钱包
        set({
          mainWallet: mainWalletData.address.toLowerCase(),
          currentConnectedWallet: normalizedAddress,
        });

        // 加载所有子钱包数据
        const subWallets = await db.getSubWallets(mainWalletData.address);
        const wallets = subWallets.map(w => ({
          address: w.address.toLowerCase(),
          label: w.label || '',
          parentWallet: mainWalletData.address.toLowerCase()
        }));
        
        set({ availableWallets: wallets });
        return;
      }

      // 2. 如果不是子钱包，检查是否是主钱包
      const mainWalletData = await db.getMainWallet(normalizedAddress);
      
      if (mainWalletData) {
        // 如果是已存在的主钱包
        set({
          mainWallet: normalizedAddress,
          currentConnectedWallet: normalizedAddress,
        });

        // 加载子钱包数据
        const subWallets = await db.getSubWallets(normalizedAddress);
        const wallets = subWallets.map(w => ({
          address: w.address.toLowerCase(),
          label: w.label || '',
          parentWallet: normalizedAddress
        }));
        
        set({ availableWallets: wallets });
      } else {
        // 如果是全新的钱包，将其设置为主钱包
        await db.saveWallet({
          address: normalizedAddress,
          label: '主钱包',
          is_main: true
        });
        
        set({
          mainWallet: normalizedAddress,
          currentConnectedWallet: normalizedAddress,
          availableWallets: []
        });
      }
    } catch (error) {
      console.error('Error initializing wallet:', error);
      // 如果发生错误，至少保持基本功能
      set({
        mainWallet: normalizedAddress,
        currentConnectedWallet: normalizedAddress,
        availableWallets: []
      });
    } finally {
      set({ isInitializing: false });
    }
  },

  setMainWallet: async (address: string) => {
    const normalizedAddress = address.toLowerCase();
    // 立即更新UI
    set({ mainWallet: normalizedAddress });
    
    try {
      // 异步保存到数据库
      await db.saveWallet({
        address: normalizedAddress,
        label: '主钱包',
        is_main: true
      });
    } catch (error) {
      console.error('Error setting main wallet:', error);
    }
  },

  setCurrentConnectedWallet: (address: string | null) => {
    set({ currentConnectedWallet: address?.toLowerCase() ?? null });
  },

  addWallet: async (wallet: Wallet) => {
    try {
      const state = get();
      const normalizedAddress = wallet.address.toLowerCase();
      const normalizedParentWallet = wallet.parentWallet?.toLowerCase();

      // 检查是否已存在相同地址的钱包
      const exists = state.availableWallets.some(w => w.address.toLowerCase() === normalizedAddress);
      if (exists) {
        console.log('Wallet already exists:', normalizedAddress);
        return;
      }

      // 检查是否达到子钱包数量限制
      if (state.availableWallets.length >= 2) {
        throw new Error('最多只能添加2个子钱包');
      }

      // 保存到数据库
      await db.saveWallet({
        address: normalizedAddress,
        label: wallet.label,
        parent_wallet: normalizedParentWallet,
        is_main: false
      });

      // 更新状态
      set({
        availableWallets: [
          ...state.availableWallets,
          {
            address: normalizedAddress,
            label: wallet.label,
            parentWallet: normalizedParentWallet,
          },
        ],
      });
    } catch (error) {
      console.error('Error adding wallet:', error);
      throw error;
    }
  },

  removeWallet: async (address: string) => {
    const normalizedAddress = address.toLowerCase();
    
    // 立即从 UI 中移除钱包
    set(state => ({
      availableWallets: state.availableWallets.filter(w => w.address.toLowerCase() !== normalizedAddress)
    }));

    try {
      // 异步执行数据库操作
      await db.removeWallet(normalizedAddress);
    } catch (error) {
      console.error('Error removing wallet:', error);
      
      // 如果数据库操作失败，恢复之前的状态
      const state = get();
      const mainWalletAddress = state.mainWallet?.toLowerCase();
      if (mainWalletAddress) {
        const subWallets = await db.getSubWallets(mainWalletAddress);
        const wallets = subWallets.map(w => ({
          address: w.address.toLowerCase(),
          label: w.label || '',
          parentWallet: mainWalletAddress
        }));
        set({ availableWallets: wallets });
      }
    }
  },

  clearWallets: async () => {
    try {
      set({ availableWallets: [] });
    } catch (error) {
      console.error('Error clearing wallets:', error);
      throw error;
    }
  },

  resetAllWalletData: async () => {
    try {
      const state = get();
      if (state.mainWallet) {
        await db.removeWallet(state.mainWallet.toLowerCase());
      }
      for (const wallet of state.availableWallets) {
        await db.removeWallet(wallet.address.toLowerCase());
      }

      set({
        mainWallet: null,
        currentConnectedWallet: null,
        availableWallets: [],
      });
    } catch (error) {
      console.error('Error resetting wallet data:', error);
      throw error;
    }
  },

  isSubWallet: (address: string) => {
    const state = get();
    return state.availableWallets.some(w => w.address.toLowerCase() === address.toLowerCase());
  },

  verifyWalletOwnership: async (address: string, provider: any) => {
    try {
      const message = `ProofPay 验证：我证明我拥有地址 ${address.toLowerCase()}
时间戳：${new Date().toISOString()}`;

      const signer = provider.getSigner();
      const signature = await signer.signMessage(message);

      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Error verifying wallet ownership:', error);
      return false;
    }
  },

  setSwitchingWallet: (isSwitching: boolean, targetAddress: string | null) => {
    set({
      isSwitchingWallet: isSwitching,
      switchingToAddress: targetAddress?.toLowerCase() ?? null,
    });
  },
})); 