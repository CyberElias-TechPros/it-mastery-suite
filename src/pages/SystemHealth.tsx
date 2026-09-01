import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataPagination } from '@/components/DataPagination';
import { api } from '@/lib/api';
import { formatDateTime, formatRelative, humanise } from '@/lib/format';

type HealthStatus = 'healthy' | 'warning' | 'critical';

interface Metric {
  metric_name: string;
  metric_value: string;
  status: HealthStatus;
  recorded_at: string;
}

interface HealthResponse {
  status: HealthStatus;
  checkedAt: string;
  environment: string;
  metrics: Metric[];
  alerts: (Metric & { id: string })[];
}

interface ActivityRow {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  ip_address: string | null;
  details: unknown;
  created_at: string;
}

const STATUS_META: Record<HealthStatus, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
  healthy: { variant: 'default', label: 'Healthy' },
  warning: { variant: 'secondary', label: 'Degraded' },
  critical: { variant: 'destructive', label: 'Critical' },
};

export default function SystemHealth() {
  const [hours, setHours] = useState('24');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  useEffect(() => setPage(1), [action]);

  const {
    data: health,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.get<HealthResponse>('/system/health'),
    refetchInterval: 60_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['system-metrics', hours],
    queryFn: () => api.get<Metric[]>('/system/metrics', { hours }),
  });

  const { data: activity } = useQuery({
    queryKey: ['system-activity', page, action],
    queryFn: () => api.getPage<ActivityRow[]>('/system/activity', { page, pageSize: 25, action: action || undefined }),
  });

  const overall = health?.status ?? 'healthy';
  const OverallIcon = overall === 'healthy' ? CheckCircle : overall === 'warning' ? AlertTriangle : ShieldAlert;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">System health</h1>
          <p className="text-muted-foreground">
            Live probes against D1, KV and R2{health ? ` · ${health.environment} environment` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <OverallIcon className="h-5 w-5" />
              <CardTitle className="text-base">Overall status</CardTitle>
            </div>
            <Badge variant={STATUS_META[overall].variant}>{STATUS_META[overall].label}</Badge>
          </div>
          <CardDescription>{health ? `Checked ${formatRelative(health.checkedAt)}` : 'Checking…'}</CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <p className="p-8 text-center text-muted-foreground">Running health checks…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(health?.metrics ?? []).map((metric) => (
            <Card key={metric.metric_name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.metric_name}</CardTitle>
                <Badge variant={STATUS_META[metric.status].variant}>{STATUS_META[metric.status].label}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.metric_value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Recorded metrics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({health?.alerts.length ?? 0})</TabsTrigger>
          <TabsTrigger value="activity">Audit trail</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-3">
          <div className="flex items-center gap-3">
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger className="w-44" aria-label="History window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="72">Last 3 days</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Samples are written every 15 minutes by the scheduled worker ({history.length} points).
            </p>
          </div>
          <Card>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">
                  No samples recorded in this window yet. The cron trigger writes the first batch within 15 minutes of deploy.
                </p>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recorded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...history].reverse().map((metric, index) => (
                        <TableRow key={`${metric.metric_name}-${metric.recorded_at}-${index}`}>
                          <TableCell>{metric.metric_name}</TableCell>
                          <TableCell>{metric.metric_value}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_META[metric.status].variant}>{STATUS_META[metric.status].label}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(metric.recorded_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardContent className="space-y-2 p-4">
              {(health?.alerts.length ?? 0) === 0 ? (
                <p className="p-6 text-center text-muted-foreground">No warnings or critical samples recorded.</p>
              ) : (
                health?.alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <p className="font-medium">{alert.metric_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.metric_value} · {formatDateTime(alert.recorded_at)}
                      </p>
                    </div>
                    <Badge variant={STATUS_META[alert.status].variant}>{STATUS_META[alert.status].label}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-3">
          <div className="flex items-center gap-3">
            <Select value={action || 'all'} onValueChange={(value) => setAction(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-64" aria-label="Filter by action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="auth.login">Sign-ins</SelectItem>
                <SelectItem value="auth.login_failed">Failed sign-ins</SelectItem>
                <SelectItem value="ticket.created">Tickets created</SelectItem>
                <SelectItem value="user.updated">Users updated</SelectItem>
                <SelectItem value="expense.decided">Expense decisions</SelectItem>
              </SelectContent>
            </Select>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(activity?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No activity recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activity?.data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{humanise(row.action)}</TableCell>
                        <TableCell>{row.user_name ?? row.user_email ?? 'System'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.resource_type ? humanise(row.resource_type) : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.ip_address ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(row.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <DataPagination meta={activity?.meta} page={page} onPageChange={setPage} noun="events" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
