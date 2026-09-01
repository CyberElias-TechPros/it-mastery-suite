import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCircle, Info, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DataPagination } from '@/components/DataPagination';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  is_read: number | boolean;
  related_ticket_id: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

function iconFor(type: string) {
  switch (type) {
    case 'ticket_resolved':
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case 'ticket_assigned':
    case 'ticket_updated':
    case 'mention':
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    default:
      return <Info className="h-5 w-5 text-blue-600" />;
  }
}

export default function Notifications() {
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter, page],
    queryFn: () => api.getPage<Notification[]>('/notifications', { filter, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: () => api.get<{ total: number; unread: number; read: number }>('/notifications/stats'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: invalidate,
    onError: (error) => toast({ title: 'Could not update', description: errorMessage(error), variant: 'destructive' }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => {
      invalidate();
      toast({ title: 'All notifications marked as read' });
    },
    onError: (error) => toast({ title: 'Could not update', description: errorMessage(error), variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/notifications/${id}`),
    onSuccess: invalidate,
    onError: (error) => toast({ title: 'Could not delete', description: errorMessage(error), variant: 'destructive' }),
  });

  const clearRead = useMutation({
    mutationFn: () => api.del('/notifications', { onlyRead: 'true' }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Read notifications cleared' });
    },
    onError: (error) => toast({ title: 'Could not clear', description: errorMessage(error), variant: 'destructive' }),
  });

  const notifications = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with system alerts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || !stats?.unread}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
          <Button variant="outline" onClick={() => clearRead.mutate()} disabled={clearRead.isPending || !stats?.read}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear read
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Total', value: stats?.total ?? 0, icon: Bell },
          { label: 'Unread', value: stats?.unread ?? 0, icon: Bell },
          { label: 'Read', value: stats?.read ?? 0, icon: CheckCircle },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            {(['all', 'unread', 'read'] as const).map((value) => (
              <Button
                key={value}
                variant={filter === value ? 'default' : 'outline'}
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
                className="capitalize"
              >
                {value}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading notifications…</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No notifications</h3>
              <p className="text-muted-foreground">Notifications will appear here.</p>
            </div>
          ) : (
            <>
              <div className="divide-y">
                {notifications.map((notification) => {
                  const unread = !notification.is_read;
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 transition-colors hover:bg-muted/50 ${unread ? 'border-l-4 border-l-primary bg-muted/30' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-1 flex-shrink-0">{iconFor(notification.type)}</div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium">{notification.title}</h4>
                          {notification.message ? (
                            <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-center gap-3">
                            <span className="text-xs text-muted-foreground">{formatDateTime(notification.created_at)}</span>
                            {notification.related_ticket_id ? (
                              <Link
                                to={`/tickets/${notification.related_ticket_id}`}
                                className="text-xs text-primary hover:underline"
                              >
                                Open ticket
                              </Link>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {unread ? (
                            <Button size="sm" variant="outline" onClick={() => markRead.mutate(notification.id)}>
                              Mark read
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove.mutate(notification.id)}
                            aria-label="Delete notification"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <DataPagination meta={data?.meta} page={page} onPageChange={setPage} noun="notifications" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
