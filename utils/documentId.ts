export function generateDocumentId(type: 'income' | 'expense'): string {
  const prefix = type === 'income' ? 'INC' : 'EXP';
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${dateStr}-${randomNum}`;
} 