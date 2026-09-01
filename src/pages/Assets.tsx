import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Archive, Package, Plus, Search, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DataPagination } from '@/components/DataPagination';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { formatCurrency, formatDate, humanise } from '@/lib/format';

interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  description: string | null;
  category: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_expiry: string | null;
  location: string | null;
  notes: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  department_name: string | null;
  branch_name: string | null;
}

interface AssetStats {
  total: number;
  active: number;
  inactive: number;
  maintenance: number;
  retired: number;
  total_value: number;
  warranty_expiring: number;
}

const STATUS_ICONS: Record<string, typeof Package> = {
  active: Package,
  maintenance: Wrench,
  inactive: Archive,
  retired: Trash2,
};

const PAGE_SIZE = 20;

export default function Assets() {
  const { isStaff, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const search = useDebounce(searchTerm);

  useEffect(() => setPage(1), [search, statusFilter, categoryFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['assets', search, statusFilter, categoryFilter, page],
    queryFn: () =>
      api.getPage<Asset[]>('/assets', {
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({ queryKey: ['asset-stats'], queryFn: () => api.get<AssetStats>('/assets/stats') });
  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => api.get<string[]>('/assets/categories'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
    queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) => api.put(`/assets/${id}`, updates),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast({ title: 'Asset updated' });
    },
    onError: (error) => toast({ title: 'Update failed', description: errorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/assets/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ title: 'Asset retired', description: 'The asset was removed from the active register.' });
    },
    onError: (error) => toast({ title: 'Delete failed', description: errorMessage(error), variant: 'destructive' }),
  });

  const assets = data?.data ?? [];

  const statCards = stats
    ? [
        { label: 'Total assets', value: stats.total.toLocaleString() },
        { label: 'Active', value: stats.active.toLocaleString() },
        { label: 'In maintenance', value: stats.maintenance.toLocaleString() },
        { label: 'Register value', value: formatCurrency(stats.total_value) },
        { label: 'Warranty expiring (30d)', value: stats.warranty_expiring.toLocaleString() },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <p className="text-muted-foreground">Manage IT assets and equipment</p>
        </div>
        {isStaff ? (
          <Button asChild>
            <Link to="/assets/new">
              <Plus className="mr-2 h-4 w-4" />
              Add asset
            </Link>
          </Button>
        ) : null}
      </div>

      {statCards.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {statCards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, tag, serial or model"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
                aria-label="Search assets"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger aria-label="Filter by category">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {humanise(category)}
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
            <div className="p-8 text-center text-muted-foreground">Loading assets…</div>
          ) : assets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No assets match these filters.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset tag</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned to</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Purchased</TableHead>
                      {isStaff ? <TableHead className="text-right">Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => {
                      const StatusIcon = STATUS_ICONS[asset.status] ?? Package;
                      return (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{asset.asset_tag}</TableCell>
                          <TableCell className="font-medium">{asset.name}</TableCell>
                          <TableCell>{asset.category ? humanise(asset.category) : '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {humanise(asset.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{asset.assigned_to_name ?? 'Unassigned'}</TableCell>
                          <TableCell>{asset.department_name ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(asset.purchase_date)}</TableCell>
                          {isStaff ? (
                            <TableCell className="space-x-2 text-right">
                              <Button variant="ghost" size="sm" onClick={() => setEditing(asset)}>
                                Edit
                              </Button>
                              {isAdmin ? (
                                <Button variant="ghost" size="sm" onClick={() => setDeleting(asset)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              ) : null}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={data?.meta} page={page} onPageChange={setPage} noun="assets" />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editing?.asset_tag}</DialogTitle>
            <DialogDescription>Update the status, location and notes for this asset.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                updateMutation.mutate({
                  id: editing.id,
                  updates: {
                    name: String(form.get('name') ?? ''),
                    status: String(form.get('status') ?? editing.status),
                    location: String(form.get('location') ?? '') || null,
                    notes: String(form.get('notes') ?? '') || null,
                  },
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="asset-name">Name</Label>
                <Input id="asset-name" name="name" defaultValue={editing.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-status">Status</Label>
                <Select name="status" defaultValue={editing.status}>
                  <SelectTrigger id="asset-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-location">Location</Label>
                <Input id="asset-location" name="location" defaultValue={editing.location ?? ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-notes">Notes</Label>
                <Textarea id="asset-notes" name="notes" rows={3} defaultValue={editing.notes ?? ''} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.asset_tag}?</AlertDialogTitle>
            <AlertDialogDescription>
              The asset is archived rather than erased, so history and attachments are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
