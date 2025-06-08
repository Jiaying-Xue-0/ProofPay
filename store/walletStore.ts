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
  mainWallet: string | null;
  currentConnectedWallet: string | null;
  availableWallets: Wallet[];
  isSwitchingWallet: boolean;
  switchingToAddress: string | null;
  setMainWallet: (address: string | null) => void;
  setCurrentConnectedWallet: (address: string | null) => void;
  addWallet: (wallet: Wallet) => void;
  removeWallet: (address: string) => void;
  clearWallets: () => void;
  resetAllWalletData: () => void;
  isSubWallet: (address: string) => boolean;
  verifyWalletOwnership: (address: string, provider: any) => Promise<boolean>;
  setSwitchingWallet: (isSwitching: boolean, targetAddress: string | null) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      mainWallet: null,
      currentConnectedWallet: null,
      availableWallets: [],
      isSwitchingWallet: false,
      switchingToAddress: null,
      
      setMainWallet: (address) => {
        // 如果是子钱包，不设置为主钱包
        const state = get();
        const isSubWallet = state.availableWallets.some(
          w => w.address.toLowerCase() === address?.toLowerCase()
        );
        
        if (!isSubWallet) {
          // 如果当前主钱包不是子钱包的父钱包，就更新主钱包
          const currentMainIsParent = state.availableWallets.some(
            w => w.parentWallet.toLowerCase() === state.mainWallet?.toLowerCase()
          );
          
          if (!currentMainIsParent) {
            set({ mainWallet: address });
          }
        }
      },

      setCurrentConnectedWallet: (address) => {
        const state = get();
        set({ currentConnectedWallet: address });
        
        // 如果连接的钱包不是子钱包，并且当前主钱包不是任何子钱包的父钱包
        // 那么将当前连接的钱包设置为主钱包
        const isSubWallet = state.availableWallets.some(
          w => w.address.toLowerCase() === address?.toLowerCase()
        );
        const currentMainIsParent = state.availableWallets.some(
          w => w.parentWallet.toLowerCase() === state.mainWallet?.toLowerCase()
        );
        
        if (!isSubWallet && !currentMainIsParent) {
          set({ mainWallet: address });
        }
      },

      addWallet: (wallet) =>
        set((state) => ({
          availableWallets: [...state.availableWallets, wallet],
        })),

      removeWallet: (address) =>
        set((state) => {
          const newState = {
            availableWallets: state.availableWallets.filter((w) => w.address !== address),
            currentConnectedWallet: state.currentConnectedWallet === address ? state.mainWallet : state.currentConnectedWallet,
          };
          
          // 如果移除的钱包是子钱包，检查是否还有其他子钱包
          // 如果没有其他子钱包了，并且当前连接的钱包不是原主钱包，则将当前连接的钱包设置为主钱包
          const hasOtherSubWallets = newState.availableWallets.some(
            w => w.parentWallet.toLowerCase() === state.mainWallet?.toLowerCase()
          );
          
          if (!hasOtherSubWallets && state.currentConnectedWallet && 
              state.currentConnectedWallet.toLowerCase() !== state.mainWallet?.toLowerCase()) {
            return {
              ...newState,
              mainWallet: state.currentConnectedWallet,
            };
          }
          
          return newState;
        }),

      clearWallets: () =>
        set((state) => ({
          availableWallets: [],
          currentConnectedWallet: state.mainWallet,
        })),

      resetAllWalletData: () =>
        set(() => ({
          mainWallet: null,
          currentConnectedWallet: null,
          availableWallets: [],
        })),

      isSubWallet: (address) => {
        const state = get();
        return state.availableWallets.some(
          w => w.address.toLowerCase() === address?.toLowerCase()
        );
      },

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

      setSwitchingWallet: (isSwitching, targetAddress) =>
        set({ isSwitchingWallet: isSwitching, switchingToAddress: targetAddress }),
    }),
    {
      name: 'wallet-storage',
    }
  )
); 