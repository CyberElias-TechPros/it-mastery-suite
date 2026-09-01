import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Globe, Mail, Phone, Plus, Search, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { DataPagination } from '@/components/DataPagination';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';

interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  service_type: string | null;
  rating: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
}

const PAGE_SIZE = 20;

function contractStatus(endDate: string | null) {
  if (!endDate) return { label: 'No contract', variant: 'secondary' as const };
  const end = new Date(endDate);
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  if (end < now) return { label: 'Expired', variant: 'destructive' as const };
  if (end <= soon) return { label: 'Expiring soon', variant: 'default' as const };
  return { label: 'Active', variant: 'outline' as const };
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-sm text-muted-foreground">Not rated</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`}
        />
      ))}
      <span className="ml-1 text-sm text-muted-foreground">({rating})</span>
    </div>
  );
}

export default function Vendors() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const search = useDebounce(searchTerm);

  useEffect(() => setPage(1), [search, serviceFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', search, serviceFilter, page],
    queryFn: () =>
      api.getPage<Vendor[]>('/vendors', {
        search,
        serviceType: serviceFilter === 'all' ? undefined : serviceFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ['vendor-service-types'],
    queryFn: () => api.get<string[]>('/vendors/service-types'),
  });

  const { data: expiring } = useQuery({
    queryKey: ['vendors-expiring'],
    queryFn: () => api.getPage<Vendor[]>('/vendors', { expiringWithinDays: 30, pageSize: 5 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setDeleting(null);
      toast({ title: 'Vendor removed' });
    },
    onError: (error) => toast({ title: 'Could not remove vendor', description: errorMessage(error), variant: 'destructive' }),
  });

  const vendors = data?.data ?? [];
  const expiringContracts = expiring?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Vendors</h1>
          <p className="text-muted-foreground">Manage vendor relationships and contracts</p>
        </div>
        {isAdmin ? (
          <Button asChild>
            <Link to="/vendors/new">
              <Plus className="mr-2 h-4 w-4" />
              Add vendor
            </Link>
          </Button>
        ) : null}
      </div>

      {expiringContracts.length > 0 ? (
        <Card className="border-orange-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-5 w-5" />
              Contracts expiring within 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {expiringContracts.map((vendor) => (
                <li key={vendor.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span className="font-medium">{vendor.name}</span>
                  <span className="text-muted-foreground">expires {formatDate(vendor.contract_end_date)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, contact or email"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
                aria-label="Search vendors"
              />
            </div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger aria-label="Filter by service type">
                <SelectValue placeholder="Filter by service type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All service types</SelectItem>
                {serviceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
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
            <div className="p-8 text-center text-muted-foreground">Loading vendors…</div>
          ) : vendors.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No vendors match these filters.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Contract</TableHead>
                      <TableHead>Value</TableHead>
                      {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map((vendor) => {
                      const status = contractStatus(vendor.contract_end_date);
                      return (
                        <TableRow key={vendor.id}>
                          <TableCell>
                            <p className="font-medium">{vendor.name}</p>
                            {vendor.contact_person ? (
                              <p className="text-sm text-muted-foreground">{vendor.contact_person}</p>
                            ) : null}
                          </TableCell>
                          <TableCell>{vendor.service_type ?? '—'}</TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              {vendor.email ? (
                                <a href={`mailto:${vendor.email}`} className="flex items-center gap-1 hover:underline">
                                  <Mail className="h-3 w-3" />
                                  {vendor.email}
                                </a>
                              ) : null}
                              {vendor.phone ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {vendor.phone}
                                </span>
                              ) : null}
                              {vendor.website ? (
                                <a
                                  href={vendor.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 hover:underline"
                                >
                                  <Globe className="h-3 w-3" />
                                  Website
                                </a>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Stars rating={vendor.rating} />
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                            {vendor.contract_end_date ? (
                              <p className="mt-1 text-xs text-muted-foreground">until {formatDate(vendor.contract_end_date)}</p>
                            ) : null}
                          </TableCell>
                          <TableCell>{vendor.contract_value != null ? formatCurrency(vendor.contract_value) : '—'}</TableCell>
                          {isAdmin ? (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => setDeleting(vendor)} aria-label="Remove vendor">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={data?.meta} page={page} onPageChange={setPage} noun="vendors" />
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Vendors referenced by a purchase order cannot be removed; cancel or reassign those orders first.
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
