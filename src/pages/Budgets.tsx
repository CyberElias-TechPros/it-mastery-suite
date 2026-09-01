import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building, CheckCircle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface BudgetRow {
  id: string;
  name: string;
  budget: number;
  spent: number;
  remaining: number;
  utilization: number;
  branch_name?: string | null;
}

interface BudgetResponse {
  year: number;
  branches: BudgetRow[];
  departments: BudgetRow[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

function budgetStatus(utilization: number) {
  if (utilization >= 100) return { label: 'Over budget', variant: 'destructive' as const, icon: AlertTriangle };
  if (utilization >= 80) return { label: 'Watch', variant: 'secondary' as const, icon: AlertTriangle };
  return { label: 'On track', variant: 'default' as const, icon: CheckCircle };
}

function BudgetCard({ row }: { row: BudgetRow }) {
  const status = budgetStatus(row.utilization);
  const StatusIcon = status.icon;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{row.name}</CardTitle>
            {row.branch_name ? <CardDescription>{row.branch_name}</CardDescription> : null}
          </div>
          <Badge variant={status.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={Math.min(row.utilization, 100)} className="h-2" />
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Budget</dt>
            <dd className="font-medium">{formatCurrency(row.budget)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Spent</dt>
            <dd className="font-medium">{formatCurrency(row.spent)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Remaining</dt>
            <dd className={`font-medium ${row.remaining < 0 ? 'text-destructive' : ''}`}>{formatCurrency(row.remaining)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">{row.utilization}% of the annual allocation used.</p>
      </CardContent>
    </Card>
  );
}

export default function Budgets() {
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const { data, isLoading } = useQuery({
    queryKey: ['budgets', year],
    queryFn: () => api.get<BudgetResponse>('/budgets', { year }),
  });

  const branches = (data?.branches ?? []).filter((row) => row.budget > 0);
  const departments = (data?.departments ?? []).filter((row) => row.budget > 0);
  const totalBudget = branches.reduce((sum, row) => sum + row.budget, 0);
  const totalSpent = branches.reduce((sum, row) => sum + row.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">Approved spending measured against annual allocations</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="year">Financial year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="year" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total branch budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget - totalSpent)}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="p-8 text-center text-muted-foreground">Loading budgets…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Branches</h2>
            {branches.length === 0 ? (
              <p className="text-muted-foreground">No branch has an allocation for {year} yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {branches.map((row) => (
                  <BudgetCard key={row.id} row={row} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Departments</h2>
            {departments.length === 0 ? (
              <p className="text-muted-foreground">No department has an allocation for {year} yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {departments.map((row) => (
                  <BudgetCard key={row.id} row={row} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
