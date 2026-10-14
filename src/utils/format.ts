export function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(amount || 0));
}
export function formatCompactKES(amount: number): string {
  const n = Number(amount || 0);
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return formatKES(n);
}
export function formatDate(value?: string | null): string {
  if (!value) return 'Not scheduled';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-KE', { day:'numeric', month:'short', year:'numeric' }).format(date);
}
export function titleCase(value: string): string { return value.replaceAll('_',' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
export function progressColor(value: number): string { return value >= 100 ? 'complete' : value >= 40 ? 'steady' : 'early'; }
