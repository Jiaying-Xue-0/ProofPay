export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
} 