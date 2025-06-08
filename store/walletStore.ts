import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ethers } from 'ethers';

export interface Wallet {
  address: string;
  label: string;
  verified: boolean;
  parentWallet: string;
}

interface WalletState {
  mainWallet: string | null; // 用户最初连接的主钱包
  currentConnectedWallet: string | null; // 当前连接的钱包
  availableWallets: Wallet[];
  setMainWallet: (address: string | null) => void;
  setCurrentConnectedWallet: (address: string | null) => void;
  addWallet: (wallet: Wallet) => void;
  removeWallet: (address: string) => void;
  clearWallets: () => void;
  verifyWalletOwnership: (address: string, provider: any) => Promise<boolean>;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      mainWallet: null,
      currentConnectedWallet: null,
      availableWallets: [],
      
      setMainWallet: (address) => {
        set({ mainWallet: address });
      },

      setCurrentConnectedWallet: (address) => {
        set({ currentConnectedWallet: address });
      },

      addWallet: (wallet) =>
        set((state) => ({
          availableWallets: [...state.availableWallets, wallet],
        })),

      removeWallet: (address) =>
        set((state) => ({
          availableWallets: state.availableWallets.filter((w) => w.address !== address),
          // 如果删除的是当前连接的钱包，切换回主钱包
          currentConnectedWallet: state.currentConnectedWallet === address ? state.mainWallet : state.currentConnectedWallet,
        })),

      clearWallets: () =>
        set((state) => ({
          availableWallets: [],
          currentConnectedWallet: state.mainWallet, // 清除时切换回主钱包
        })),

      verifyWalletOwnership: async (address: string, provider: any) => {
        try {
          const message = `Confirm ownership of wallet: ${address} on ProofPay at ${new Date().toISOString()}`;
          const signature = await provider.request({
            method: 'personal_sign',
            params: [address, message],
          });

          const recoveredAddress = ethers.utils.verifyMessage(message, signature);
          return recoveredAddress.toLowerCase() === address.toLowerCase();
        } catch (error) {
          console.error('Wallet verification failed:', error);
          return false;
        }
      },
    }),
    {
      name: 'wallet-storage',
    }
  )
); 