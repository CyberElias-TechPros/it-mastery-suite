import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataPagination } from '@/components/DataPagination';

const meta = { page: 2, pageSize: 10, total: 34, totalPages: 4 };

describe('DataPagination', () => {
  it('renders nothing when there are no records', () => {
    const { container } = render(<DataPagination meta={{ page: 1, pageSize: 10, total: 0, totalPages: 0 }} page={1} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('summarises the visible range', () => {
    render(<DataPagination meta={meta} page={2} onPageChange={() => {}} noun="tickets" />);
    expect(screen.getByText(/11/)).toBeInTheDocument();
    expect(screen.getByText(/34/)).toBeInTheDocument();
    expect(screen.getByText(/tickets/i)).toBeInTheDocument();
  });

  it('moves between pages and stops at the boundaries', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(<DataPagination meta={meta} page={2} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    rerender(<DataPagination meta={{ ...meta, page: 4 }} page={4} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });
});
