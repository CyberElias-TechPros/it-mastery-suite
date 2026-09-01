import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, DollarSign, Plus, Search, XCircle } from 'lucide-react';
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
import { formatCurrency, formatDate, humanise, statusVariant } from '@/lib/format';

interface Expense {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  expense_date: string;
  category: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  vendor_name: string | null;
  branch_name: string | null;
  department_name: string | null;
  submitted_by: string;
  submitted_by_name: string | null;
  approved_by_name: string | null;
}

interface ExpenseStats {
  total_expenses: number;
  total_amount: number;
  approved_amount: number;
  pending_amount: number;
  pending_approval: number;
  month_to_date: number;
  by_category: { category: string; amount: number }[];
}

const PAGE_SIZE = 20;
const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777'];

/** Returns the first day of the selected period, or undefined for "all time". */
function periodStart(period: string): string | undefined {
  const now = new Date();
  switch (period) {
    case 'this_month':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    case 'last_month':
      return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    case 'this_quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().slice(0, 10);
    case 'this_year':
      return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    default:
      return undefined;
  }
}

export default function Expenses() {
  const { isAdmin, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const search = useDebounce(searchTerm);

  useEffect(() => setPage(1), [search, statusFilter, periodFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', search, statusFilter, periodFilter, page],
    queryFn: () =>
      api.getPage<Expense[]>('/expenses', {
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        from: periodStart(periodFilter),
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({ queryKey: ['expense-stats'], queryFn: () => api.get<ExpenseStats>('/expenses/stats') });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const decisionMutation = useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      api.post(`/expenses/${id}/decision`, { decision, reason }),
    onSuccess: () => {
      invalidate();
      setRejecting(null);
      toast({ title: 'Decision recorded' });
    },
    onError: (error) => toast({ title: 'Could not record the decision', description: errorMessage(error), variant: 'destructive' }),
  });

  const expenses = data?.data ?? [];
  const categoryData = (stats?.by_category ?? []).map((row) => ({ name: humanise(row.category), value: Number(row.amount) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Review and approve spending across the organisation' : 'Track the expenses you submitted'}
          </p>
        </div>
        <Button asChild>
          <Link to="/expenses/new">
            <Plus className="mr-2 h-4 w-4" />
            New expense
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Month to date', value: formatCurrency(stats?.month_to_date) },
          { label: 'Approved', value: formatCurrency(stats?.approved_amount) },
          { label: 'Pending', value: formatCurrency(stats?.pending_amount) },
          { label: 'Awaiting decision', value: (stats?.pending_approval ?? 0).toLocaleString() },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {categoryData.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Spend by category</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Category share</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={100} label>
                    {categoryData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title or description"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
                aria-label="Search expenses"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger aria-label="Filter by period">
                <SelectValue placeholder="Filter by period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Since last month</SelectItem>
                <SelectItem value="this_quarter">This quarter</SelectItem>
                <SelectItem value="this_year">This year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading expenses…</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No expenses match these filters.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted by</TableHead>
                      {isAdmin ? <TableHead className="text-right">Decision</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => {
                      const canDecide = isAdmin && expense.status === 'pending' && expense.submitted_by !== profile?.id;
                      return (
                        <TableRow key={expense.id}>
                          <TableCell>
                            <p className="font-medium">{expense.title}</p>
                            {expense.vendor_name ? (
                              <p className="text-sm text-muted-foreground">{expense.vendor_name}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(expense.amount)}</TableCell>
                          <TableCell>{expense.category ? humanise(expense.category) : '—'}</TableCell>
                          <TableCell>{formatDate(expense.expense_date)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(expense.status)}>{humanise(expense.status)}</Badge>
                            {expense.rejection_reason ? (
                              <p className="mt-1 text-xs text-muted-foreground">{expense.rejection_reason}</p>
                            ) : null}
                          </TableCell>
                          <TableCell>{expense.submitted_by_name ?? '—'}</TableCell>
                          {isAdmin ? (
                            <TableCell className="text-right">
                              {canDecide ? (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => decisionMutation.mutate({ id: expense.id, decision: 'approved' })}
                                    disabled={decisionMutation.isPending}
                                  >
                                    <CheckCircle2 className="mr-1 h-4 w-4" />
                                    Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejecting(expense)}>
                                    <XCircle className="mr-1 h-4 w-4" />
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {expense.approved_by_name ? `by ${expense.approved_by_name}` : '—'}
                                </span>
                              )}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={data?.meta} page={page} onPageChange={setPage} noun="expenses" />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.title}</DialogTitle>
            <DialogDescription>A reason is required so the submitter knows what to correct.</DialogDescription>
          </DialogHeader>
          {rejecting ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                decisionMutation.mutate({
                  id: rejecting.id,
                  decision: 'rejected',
                  reason: String(form.get('reason')),
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Reason</Label>
                <Textarea id="reject-reason" name="reason" rows={3} required minLength={3} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={decisionMutation.isPending}>
                  Reject expense
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
