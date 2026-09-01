import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatCurrency,
  formatDate,
  formatNumber,
  humanise,
  priorityVariant,
  statusVariant,
} from '@/lib/format';

describe('format helpers', () => {
  it('formats currency and copes with strings and nulls', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency('99')).toBe('$99.00');
    expect(formatCurrency(null)).toBe('$0.00');
    expect(formatCurrency('not-a-number')).toBe('$0.00');
  });

  it('formats numbers with thousands separators', () => {
    expect(formatNumber(15000)).toBe('15,000');
    expect(formatNumber(undefined)).toBe('0');
  });

  it('renders an em dash for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('nonsense')).toBe('—');
    expect(formatDate('2026-01-15T00:00:00.000Z')).toContain('2026');
  });

  it('scales byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('humanises enum values from the API', () => {
    expect(humanise('in_progress')).toBe('In progress');
    expect(humanise('ticket_assigned')).toBe('Ticket assigned');
    expect(humanise(null)).toBe('—');
  });

  it('maps priorities and statuses to badge variants', () => {
    expect(priorityVariant('critical')).toBe('destructive');
    expect(priorityVariant('medium')).toBe('default');
    expect(priorityVariant('low')).toBe('secondary');
    expect(statusVariant('approved')).toBe('default');
    expect(statusVariant('rejected')).toBe('destructive');
  });
});
