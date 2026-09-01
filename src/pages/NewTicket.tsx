import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const ticketSchema = z.object({
  title: z.string().trim().min(5, { message: 'Title must be at least 5 characters' }).max(200),
  description: z.string().trim().min(10, { message: 'Description must be at least 10 characters' }).max(10_000),
  category: z.enum(['it_support', 'software', 'hardware', 'network', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});

interface AssignableUser {
  id: string;
  full_name: string | null;
  role: string;
}

export default function NewTicket() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'it_support',
    priority: 'medium',
    assignedTo: 'unassigned',
  });
  const { isStaff } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: assignees = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: () => api.get<AssignableUser[]>('/users/assignable'),
    enabled: isStaff,
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<{ id: string; ticket_number: string }>('/tickets', payload),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Ticket created', description: `${ticket.ticket_number} has been raised.` });
      navigate(`/tickets/${ticket.id}`);
    },
    onError: (error) => toast({ title: 'Could not create ticket', description: errorMessage(error), variant: 'destructive' }),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = ticketSchema.safeParse(formData);
    if (!validation.success) {
      toast({ title: 'Validation error', description: validation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    mutation.mutate({
      ...validation.data,
      assignedTo: isStaff && formData.assignedTo !== 'unassigned' ? formData.assignedTo : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" aria-label="Back to tickets">
          <Link to="/tickets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New ticket</h1>
          <p className="text-muted-foreground">Create a new support ticket</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="What happened, what you expected, and any error messages"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                rows={6}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="it_support">IT support</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="hardware">Hardware</SelectItem>
                    <SelectItem value="network">Network</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low — response within 72h</SelectItem>
                    <SelectItem value="medium">Medium — response within 24h</SelectItem>
                    <SelectItem value="high">High — response within 8h</SelectItem>
                    <SelectItem value="critical">Critical — response within 4h</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isStaff ? (
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assign to</Label>
                <Select value={formData.assignedTo} onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}>
                  <SelectTrigger id="assignedTo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Leave unassigned</SelectItem>
                    {assignees.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.full_name ?? 'Unnamed'} ({person.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <p className="text-sm text-muted-foreground">
              You can attach screenshots and logs from the ticket page once it has been created.
            </p>

            <div className="flex gap-4">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create ticket'
                )}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/tickets">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
