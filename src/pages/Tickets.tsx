import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DataPagination } from '@/components/DataPagination';
import { useDebounce } from '@/hooks/use-debounce';
import { api, errorMessage } from '@/lib/api';
import { formatDate, humanise, priorityVariant } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';

interface TicketRow {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  sla_due_date: string | null;
  created_by_name: string | null;
  assigned_to_name: string | null;
}

const PAGE_SIZE = 20;

export default function Tickets() {
  const { isStaff } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [page, setPage] = useState(1);
  const search = useDebounce(searchTerm);

  // Any filter change invalidates the current page number.
  useEffect(() => setPage(1), [search, statusFilter, priorityFilter, assignmentFilter]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', search, statusFilter, priorityFilter, assignmentFilter, page],
    queryFn: () =>
      api.getPage<TicketRow[]>('/tickets', {
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        assignedTo: assignmentFilter === 'all' ? undefined : assignmentFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const tickets = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">
            {isStaff ? 'Every support ticket across the organisation' : 'Tickets you raised or were assigned'}
          </p>
        </div>
        <Button asChild>
          <Link to="/tickets/new">
            <Plus className="mr-2 h-4 w-4" />
            New ticket
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title, number or description"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
                aria-label="Search tickets"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger aria-label="Filter by priority">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
              <SelectTrigger aria-label="Filter by assignment">
                <SelectValue placeholder="Filter by assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                <SelectItem value="me">Assigned to me</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load tickets</AlertTitle>
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading tickets…</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No tickets match these filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created by</TableHead>
                      <TableHead>Assigned to</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => {
                      const overdue =
                        ticket.sla_due_date &&
                        ['open', 'in_progress'].includes(ticket.status) &&
                        new Date(ticket.sla_due_date) < new Date();
                      return (
                        <TableRow key={ticket.id}>
                          <TableCell>
                            <Link to={`/tickets/${ticket.id}`} className="font-medium text-primary hover:underline">
                              {ticket.ticket_number}
                            </Link>
                          </TableCell>
                          <TableCell className="font-medium">
                            {ticket.title}
                            {overdue ? (
                              <Badge variant="destructive" className="ml-2">
                                Overdue
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant={priorityVariant(ticket.priority)}>{humanise(ticket.priority)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{humanise(ticket.status)}</Badge>
                          </TableCell>
                          <TableCell>{ticket.created_by_name ?? 'Unknown'}</TableCell>
                          <TableCell>
                            {ticket.assigned_to_name ?? <span className="text-muted-foreground">Unassigned</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(ticket.created_at)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={data?.meta} page={page} onPageChange={setPage} noun="tickets" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
