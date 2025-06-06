export function generateDocumentId(type: 'invoice' | 'receipt'): string {
  const prefix = type === 'invoice' ? 'INV' : 'RCP';
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${dateStr}-${randomNum}`;
} 