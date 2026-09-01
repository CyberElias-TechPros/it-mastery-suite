import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Fuel, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { useAuth } from '@/contexts/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';

interface DieselLog {
  id: string;
  date: string;
  generator_id: string | null;
  opening_stock: number;
  received_stock: number;
  consumed_stock: number;
  closing_stock: number;
  running_hours: number | null;
  cost_per_liter: number | null;
  total_cost: number | null;
  branch_name: string | null;
  recorded_by_name: string | null;
}

interface DieselStats {
  totalConsumption: number;
  totalHours: number;
  totalCost: number;
  entries: number;
  avgPerHour: number;
}

const PAGE_SIZE = 20;

export default function Diesel() {
  const { isStaff, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<DieselLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['diesel-logs', page],
    queryFn: () => api.getPage<DieselLog[]>('/diesel', { page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({ queryKey: ['diesel-stats'], queryFn: () => api.get<DieselStats>('/diesel/stats') });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/diesel/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diesel-logs'] });
      queryClient.invalidateQueries({ queryKey: ['diesel-stats'] });
      setDeleting(null);
      toast({ title: 'Log deleted' });
    },
    onError: (error) => toast({ title: 'Delete failed', description: errorMessage(error), variant: 'destructive' }),
  });

  const logs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Diesel consumption</h1>
          <p className="text-muted-foreground">Monitor generator fuel usage</p>
        </div>
        {isStaff ? (
          <Button asChild>
            <Link to="/diesel/new">
              <Plus className="mr-2 h-4 w-4" />
              Add log
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consumption (last 30 logs)</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.totalConsumption, 1)} L</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average per hour</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.avgPerHour, 2)} L/hr</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running hours</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.totalHours, 1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fuel cost</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalCost)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading logs…</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No diesel logs recorded yet.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Generator</TableHead>
                      <TableHead>Opening</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Consumed</TableHead>
                      <TableHead>Closing</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Recorded by</TableHead>
                      {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDate(log.date)}</TableCell>
                        <TableCell>{log.branch_name ?? '—'}</TableCell>
                        <TableCell>{log.generator_id ?? '—'}</TableCell>
                        <TableCell>{formatNumber(log.opening_stock, 1)} L</TableCell>
                        <TableCell>{formatNumber(log.received_stock, 1)} L</TableCell>
                        <TableCell>{formatNumber(log.consumed_stock, 1)} L</TableCell>
                        <TableCell>{formatNumber(log.closing_stock, 1)} L</TableCell>
                        <TableCell>{log.total_cost != null ? formatCurrency(log.total_cost) : '—'}</TableCell>
                        <TableCell>{log.recorded_by_name ?? '—'}</TableCell>
                        {isAdmin ? (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setDeleting(log)} aria-label="Delete log">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={data?.meta} page={page} onPageChange={setPage} noun="logs" />
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the log for {deleting ? formatDate(deleting.date) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the fuel entry and its cost figures.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
