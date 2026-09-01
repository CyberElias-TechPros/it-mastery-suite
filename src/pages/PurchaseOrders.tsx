import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, DollarSign, FileText, Plus, Search, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DataPagination } from '@/components/DataPagination';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { formatCurrency, formatDate, humanise } from '@/lib/format';

interface PurchaseOrder {
  id: string;
  po_number: string;
  title: string;
  description: string | null;
  status: string;
  total_amount: number | null;
  vendor_id: string | null;
  vendor_name: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  approved_by_name: string | null;
  created_at: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface PoStats {
  total: number;
  pending: number;
  approved: number;
  total_value: number;
}

/** Mirrors PO_TRANSITIONS in worker/src/routes/procurement.ts. */
const TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  rejected: ['draft'],
  received: [],
  cancelled: [],
};

const ADMIN_ONLY_TRANSITIONS = new Set(['approved', 'rejected', 'ordered', 'received']);

const STATUS_ICON: Record<string, typeof FileText> = {
  draft: FileText,
  pending: Clock,
  approved: CheckCircle,
  ordered: DollarSign,
  received: CheckCircle,
  rejected: XCircle,
  cancelled: XCircle,
};

const NO_VENDOR = 'none';
const PAGE_SIZE = 20;

export default function PurchaseOrders() {
  const { isAdmin, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const search = useDebounce(searchTerm);

  useEffect(() => setPage(1), [search, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', search, statusFilter, page],
    queryFn: () =>
      api.getPage<PurchaseOrder[]>('/purchase-orders', {
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({ queryKey: ['po-stats'], queryFn: () => api.get<PoStats>('/purchase-orders/stats') });
  const { data: vendors } = useQuery({
    queryKey: ['vendors-lookup'],
    queryFn: () => api.getPage<Vendor[]>('/vendors', { pageSize: 100 }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['po-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/purchase-orders', payload),
    onSuccess: () => {
      invalidate();
      setCreating(false);
      toast({ title: 'Purchase order drafted' });
    },
    onError: (error) => toast({ title: 'Could not create the order', description: errorMessage(error), variant: 'destructive' }),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/purchase-orders/${id}`, { status }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Purchase order updated' });
    },
    onError: (error) => toast({ title: 'Transition rejected', description: errorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/purchase-orders/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Purchase order deleted' });
    },
    onError: (error) => toast({ title: 'Could not delete', description: errorMessage(error), variant: 'destructive' }),
  });

  const orders = data?.data ?? [];

  const allowedTransitions = (order: PurchaseOrder) =>
    (TRANSITIONS[order.status] ?? []).filter((next) => {
      if (ADMIN_ONLY_TRANSITIONS.has(next)) return isAdmin;
      return isAdmin || order.requested_by === profile?.id;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Purchase orders</h1>
          <p className="text-muted-foreground">Manage procurement and approvals</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New order
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total orders', value: (stats?.total ?? 0).toLocaleString(), icon: FileText },
          { label: 'Awaiting approval', value: (stats?.pending ?? 0).toLocaleString(), icon: Clock },
          { label: 'Approved', value: (stats?.approved ?? 0).toLocaleString(), icon: CheckCircle },
          { label: 'Committed value', value: formatCurrency(stats?.total_value), icon: DollarSign },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by number or title"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
                aria-label="Search purchase orders"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.keys(TRANSITIONS).map((status) => (
                  <SelectItem key={status} value={status}>
                    {humanise(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading purchase orders…</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No purchase orders match these filters.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO number</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested by</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const Icon = STATUS_ICON[order.status] ?? FileText;
                      const transitions = allowedTransitions(order);
                      const canDelete = isAdmin && ['draft', 'rejected', 'cancelled'].includes(order.status);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.po_number}</TableCell>
                          <TableCell>{order.title}</TableCell>
                          <TableCell>{order.vendor_name ?? '—'}</TableCell>
                          <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              <Icon className="mr-1 h-3 w-3" />
                              {humanise(order.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{order.requested_by_name ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(order.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              {transitions.map((next) => (
                                <Button
                                  key={next}
                                  size="sm"
                                  variant={next === 'approved' ? 'default' : 'outline'}
                                  disabled={transitionMutation.isPending}
                                  onClick={() => transitionMutation.mutate({ id: order.id, status: next })}
                                >
                                  {humanise(next)}
                                </Button>
                              ))}
                              {canDelete ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(order.id)}
                                  aria-label="Delete purchase order"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={data?.meta} page={page} onPageChange={setPage} noun="orders" />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
            <DialogDescription>Orders start as a draft; submit one for approval when it is ready.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              createMutation.mutate({
                title: String(form.get('title')),
                description: String(form.get('description') ?? '') || undefined,
                vendorId: form.get('vendorId') === NO_VENDOR ? undefined : String(form.get('vendorId')),
                totalAmount: form.get('totalAmount') ? Number(form.get('totalAmount')) : undefined,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="po-title">Title</Label>
              <Input id="po-title" name="title" required minLength={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-vendor">Vendor</Label>
              <Select name="vendorId" defaultValue={NO_VENDOR}>
                <SelectTrigger id="po-vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VENDOR}>Not selected</SelectItem>
                  {(vendors?.data ?? []).map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-amount">Total amount</Label>
              <Input id="po-amount" name="totalAmount" type="number" min="0" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-description">Description</Label>
              <Textarea id="po-description" name="description" rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
