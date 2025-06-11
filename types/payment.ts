import { ethers } from 'ethers';

export interface ChainOption {
  id: string;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface TokenOption {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
}

// 支持的链配置
export const SUPPORTED_CHAINS: ChainOption[] = [
  {
    id: '1',
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
    blockExplorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  {
    id: '137',
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
    blockExplorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  {
    id: '80001',
    name: 'Mumbai Testnet',
    rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/your-api-key',
    blockExplorerUrl: 'https://mumbai.polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  {
    id: '5',
    name: 'Goerli Testnet',
    rpcUrl: 'https://eth-goerli.g.alchemy.com/v2/your-api-key',
    blockExplorerUrl: 'https://goerli.etherscan.io',
    nativeCurrency: {
      name: 'Goerli ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
];

// 支持的代币列表
export const SUPPORTED_TOKENS: TokenOption[] = [
  {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
    chainId: 1,
    logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    address: '0x0000000000000000000000000000000000000000',
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
    chainId: 137,
    logoURI: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  },
  {
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    chainId: 1,
    logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether-logo.png',
  },
  {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    chainId: 1,
    logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
  },
];

// 自定义代币存储
const CUSTOM_TOKENS_KEY = 'custom_tokens';

// 添加自定义代币
export const addCustomToken = (token: Omit<TokenOption, 'logoURI'>) => {
  try {
    const storedTokens = localStorage.getItem(CUSTOM_TOKENS_KEY);
    const customTokens: TokenOption[] = storedTokens ? JSON.parse(storedTokens) : [];
    
    // 检查是否已存在
    const exists = customTokens.some(
      (t) => t.address.toLowerCase() === token.address.toLowerCase() && t.chainId === token.chainId
    );
    
    if (!exists) {
      customTokens.push(token);
      localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(customTokens));
      
      // 更新 SUPPORTED_TOKENS
      SUPPORTED_TOKENS.push(token);
    }
  } catch (error) {
    console.error('Error adding custom token:', error);
  }
};

// 获取自定义代币
export const getCustomTokens = (): TokenOption[] => {
  try {
    const storedTokens = localStorage.getItem(CUSTOM_TOKENS_KEY);
    return storedTokens ? JSON.parse(storedTokens) : [];
  } catch (error) {
    console.error('Error getting custom tokens:', error);
    return [];
  }
};

// 初始化时加载自定义代币
const loadCustomTokens = () => {
  const customTokens = getCustomTokens();
  customTokens.forEach((token) => {
    if (!SUPPORTED_TOKENS.some((t) => t.address === token.address && t.chainId === token.chainId)) {
      SUPPORTED_TOKENS.push(token);
    }
  });
};

loadCustomTokens(); 