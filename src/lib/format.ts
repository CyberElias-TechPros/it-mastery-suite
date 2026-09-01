/** Small presentation helpers shared by every page. */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | string | null | undefined): string {
  const amount = typeof value === 'string' ? Number(value) : value ?? 0;
  return currencyFormatter.format(Number.isFinite(amount as number) ? (amount as number) : 0);
}

export function formatNumber(value: number | string | null | undefined, fractionDigits = 0): string {
  const amount = typeof value === 'string' ? Number(value) : value ?? 0;
  return (Number.isFinite(amount as number) ? (amount as number) : 0).toLocaleString('en-US', {
    maximumFractionDigits: fractionDigits,
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "3 hours ago" / "in 2 days" style relative time. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) return formatter.format(Math.round(diffSeconds / seconds), unit);
  }
  return formatter.format(diffSeconds, 'second');
}

export function formatBytes(bytes: number | null | undefined): string {
  const value = bytes ?? 0;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

/** Turns `in_progress` into `In progress`. */
export function humanise(value: string | null | undefined): string {
  if (!value) return '—';
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export function priorityVariant(priority: string): BadgeVariant {
  switch (priority) {
    case 'critical':
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    default:
      return 'secondary';
  }
}

export function statusDotClass(status: string): string {
  switch (status) {
    case 'open':
      return 'bg-blue-500';
    case 'in_progress':
      return 'bg-yellow-500';
    case 'resolved':
      return 'bg-green-500';
    case 'closed':
      return 'bg-muted-foreground';
    default:
      return 'bg-secondary';
  }
}

export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'approved':
    case 'resolved':
    case 'received':
    case 'active':
    case 'healthy':
      return 'default';
    case 'rejected':
    case 'cancelled':
    case 'critical':
      return 'destructive';
    default:
      return 'secondary';
  }
}
