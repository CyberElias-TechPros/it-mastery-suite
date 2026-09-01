import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@/lib/api';

interface DataPaginationProps {
  meta?: PageMeta;
  page: number;
  onPageChange: (page: number) => void;
  /** Plural noun used in the summary line, e.g. "tickets". */
  noun?: string;
}

/** Shared "showing x–y of z" footer used by every list screen. */
export function DataPagination({ meta, page, onPageChange, noun = 'records' }: DataPaginationProps) {
  const total = meta?.total ?? 0;
  const pageSize = meta?.pageSize ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  if (!total) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
