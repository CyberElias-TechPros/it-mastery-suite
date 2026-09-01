import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Fuel,
  Package,
  Ticket,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { formatCurrency, formatNumber, formatRelative, humanise, priorityVariant, statusDotClass } from '@/lib/format';

interface DashboardPayload {
  tickets: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    highPriority: number;
    overdue: number;
    slaCompliance: number;
  };
  assets: { total: number; active: number; maintenance: number; retired: number; warrantyExpiring: number };
  finance: { monthToDate: number; pendingAmount: number; pendingCount: number };
  diesel: { latestConsumption: number; latestCost: number; latestDate: string | null };
  operations: { todayEvents: number; expiringContracts: number; kbViews: number; unreadNotifications: number };
  recentTickets: {
    id: string;
    ticket_number: string;
    title: string;
    status: string;
    priority: string;
    created_at: string;
    created_by_name: string | null;
  }[];
  generatedAt: string;
}

export default function Dashboard() {
  const { profile } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    // A single aggregated endpoint replaces the seven client-side queries.
    queryFn: () => api.get<DashboardPayload>('/dashboard'),
    staleTime: 30_000,
  });

  const statCards = data
    ? [
        { title: 'Open tickets', value: formatNumber(data.tickets.open), caption: `${formatNumber(data.tickets.total)} total`, icon: Ticket, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950' },
        { title: 'In progress', value: formatNumber(data.tickets.inProgress), caption: `${formatNumber(data.tickets.resolved)} resolved`, icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-950' },
        { title: 'Overdue tickets', value: formatNumber(data.tickets.overdue), caption: 'past their SLA target', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950' },
        { title: 'High priority', value: formatNumber(data.tickets.highPriority), caption: 'open high or critical', icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950' },
        { title: 'Active assets', value: formatNumber(data.assets.active), caption: `${formatNumber(data.assets.total)} tracked`, icon: Package, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950' },
        { title: 'In maintenance', value: formatNumber(data.assets.maintenance), caption: `${formatNumber(data.assets.warrantyExpiring)} warranties expiring`, icon: Wrench, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950' },
        { title: 'Spend this month', value: formatCurrency(data.finance.monthToDate), caption: 'approved and pending', icon: DollarSign, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950' },
        { title: 'Pending approvals', value: formatNumber(data.finance.pendingCount), caption: formatCurrency(data.finance.pendingAmount), icon: AlertCircle, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950' },
        { title: 'Latest diesel usage', value: `${formatNumber(data.diesel.latestConsumption, 2)} L`, caption: data.diesel.latestDate ? `logged ${formatRelative(data.diesel.latestDate)}` : 'no logs yet', icon: Fuel, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950' },
        { title: "Today's events", value: formatNumber(data.operations.todayEvents), caption: 'on the shared calendar', icon: Calendar, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950' },
        { title: 'Expiring contracts', value: formatNumber(data.operations.expiringContracts), caption: 'within 30 days', icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950' },
        { title: 'Knowledge base views', value: formatNumber(data.operations.kbViews), caption: 'across published articles', icon: BookOpen, color: 'text-teal-600', bgColor: 'bg-teal-50 dark:bg-teal-950' },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-9 w-9 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Dashboard unavailable</AlertTitle>
        <AlertDescription>{errorMessage(error, 'The dashboard could not be loaded.')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {profile?.full_name || 'there'}!</p>
        </div>
        <Button asChild>
          <Link to="/tickets/new">
            <Ticket className="mr-2 h-4 w-4" />
            New ticket
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.caption}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              SLA compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tickets within target</span>
                <span className="font-medium">{data.tickets.slaCompliance}%</span>
              </div>
              <Progress value={data.tickets.slaCompliance} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {formatNumber(data.tickets.overdue)} of {formatNumber(data.tickets.total)} tickets are past their SLA target.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Where to look next
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Unread notifications</span>
              <Badge variant={data.operations.unreadNotifications ? 'default' : 'secondary'}>
                {formatNumber(data.operations.unreadNotifications)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Expenses awaiting a decision</span>
              <Badge variant={data.finance.pendingCount ? 'default' : 'secondary'}>
                {formatNumber(data.finance.pendingCount)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Warranties expiring in 30 days</span>
              <Badge variant={data.assets.warrantyExpiring ? 'default' : 'secondary'}>
                {formatNumber(data.assets.warrantyExpiring)}
              </Badge>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">Updated {formatRelative(data.generatedAt)}.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent tickets</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/tickets">
                View all
                <TrendingUp className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentTickets.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No tickets yet. Create your first ticket to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentTickets.map((ticket) => (
                <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="block">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(ticket.status)}`} />
                      <div>
                        <p className="font-medium">{ticket.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {ticket.ticket_number} • {ticket.created_by_name ?? 'Unknown'} • {formatRelative(ticket.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={priorityVariant(ticket.priority)}>{humanise(ticket.priority)}</Badge>
                      <Badge variant="outline">{humanise(ticket.status)}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
