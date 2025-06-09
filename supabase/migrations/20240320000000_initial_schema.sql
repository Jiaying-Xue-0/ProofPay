-- Create invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  description TEXT NOT NULL,
  amount TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  date BIGINT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  additional_notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  signature_status TEXT NOT NULL CHECK (signature_status IN ('pending', 'signed', 'mismatch', 'unverifiable')),
  signed_by TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  signature TEXT,
  signed_message TEXT,
  created_at BIGINT NOT NULL,
  block_number INTEGER,
  wallet_address TEXT NOT NULL,
  CONSTRAINT unique_document_id UNIQUE (document_id)
);

-- Create wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address TEXT NOT NULL,
  parent_wallet TEXT,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT unique_address UNIQUE (address),
  CONSTRAINT valid_parent_wallet FOREIGN KEY (parent_wallet) REFERENCES wallets(address)
);

-- Create indexes
CREATE INDEX idx_invoices_wallet_address ON invoices(wallet_address);
CREATE INDEX idx_invoices_document_id ON invoices(document_id);
CREATE INDEX idx_invoices_transaction_hash ON invoices(transaction_hash);
CREATE INDEX idx_wallets_address ON wallets(address);
CREATE INDEX idx_wallets_parent_wallet ON wallets(parent_wallet); 