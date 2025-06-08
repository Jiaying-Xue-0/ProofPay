export interface WalletConnectSession {
  topic: string;
  namespaces: {
    eip155: {
      accounts: string[];
    };
  };
} 