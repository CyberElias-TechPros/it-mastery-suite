import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  Send,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileUpload } from '@/components/FileUpload';
import { AttachmentList } from '@/components/AttachmentList';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, humanise, priorityVariant } from '@/lib/format';

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  sla_due_date: string | null;
  created_by: string;
  assigned_to: string | null;
  created_by_name: string | null;
  assigned_to_name: string | null;
}

interface Comment {
  id: string;
  comment: string;
  is_internal: number | boolean;
  created_at: string;
  user_name: string | null;
}

interface AssignableUser {
  id: string;
  full_name: string | null;
  role: string;
}

const UNASSIGNED = 'unassigned';

export default function TicketDetail() {
  const { id = '' } = useParams();
  const { profile, isStaff } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState(UNASSIGNED);
  const [resolution, setResolution] = useState('');

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get<Ticket>(`/tickets/${id}`),
    enabled: Boolean(id),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => api.get<Comment[]>(`/tickets/${id}/comments`),
    enabled: Boolean(id),
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: () => api.get<AssignableUser[]>('/users/assignable'),
    enabled: isStaff,
  });

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setAssignee(ticket.assigned_to ?? UNASSIGNED);
    setResolution(ticket.resolution ?? '');
  }, [ticket]);

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => api.put<Ticket>(`/tickets/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Ticket updated' });
    },
    onError: (mutationError) =>
      toast({ title: 'Update failed', description: errorMessage(mutationError), variant: 'destructive' }),
  });

  const commentMutation = useMutation({
    mutationFn: (payload: { comment: string; isInternal: boolean }) => api.post(`/tickets/${id}/comments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', id] });
      setNewComment('');
      setIsInternal(false);
      toast({ title: 'Comment added' });
    },
    onError: (mutationError) =>
      toast({ title: 'Could not add comment', description: errorMessage(mutationError), variant: 'destructive' }),
  });

  if (isLoading) return <div className="flex justify-center p-8 text-muted-foreground">Loading ticket…</div>;

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ticket unavailable</AlertTitle>
          <AlertDescription>{errorMessage(error, 'This ticket does not exist or you cannot access it.')}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link to="/tickets">Back to tickets</Link>
        </Button>
      </div>
    );
  }

  const isRequester = ticket.created_by === profile?.id;
  const canManage = isStaff;
  const isClosed = ticket.status === 'closed';
  const overdue = ticket.sla_due_date && ['open', 'in_progress'].includes(ticket.status) && new Date(ticket.sla_due_date) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/tickets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to tickets
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">Ticket {ticket.ticket_number}</h1>
            <Badge variant="outline">{humanise(ticket.status)}</Badge>
            {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
          </div>
          <p className="text-muted-foreground">{ticket.title}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {ticket.resolution ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{ticket.resolution}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Attachments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AttachmentList resourceType="ticket" resourceId={id} />
              <FileUpload
                onFileUploaded={() => queryClient.invalidateQueries({ queryKey: ['attachments', 'ticket', id] })}
                resourceType="ticket"
                resourceId={id}
                multiple
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{comment.user_name?.charAt(0)?.toUpperCase() ?? 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{comment.user_name ?? 'Unknown'}</span>
                          {comment.is_internal ? (
                            <Badge variant="outline" className="text-xs">
                              Internal
                            </Badge>
                          ) : null}
                          <span className="text-xs text-muted-foreground">{formatDateTime(comment.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{comment.comment}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              {isClosed ? (
                <p className="text-sm text-muted-foreground">
                  This ticket is closed. Reopen it to continue the conversation.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="comment">Add a comment</Label>
                    {canManage ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={isInternal}
                          onCheckedChange={(checked) => setIsInternal(checked === true)}
                          aria-label="Internal note"
                        />
                        Internal note
                      </label>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      id="comment"
                      placeholder="Share an update…"
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                      rows={3}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => commentMutation.mutate({ comment: newComment.trim(), isInternal })}
                      disabled={!newComment.trim() || commentMutation.isPending}
                      size="sm"
                      className="self-end"
                      aria-label="Send comment"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                {canManage || isRequester ? (
                  <div className="flex gap-2">
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="status" className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ status })}
                      disabled={updateMutation.isPending || status === ticket.status}
                      aria-label="Save status"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Badge variant="outline">{humanise(ticket.status)}</Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                {canManage ? (
                  <div className="flex gap-2">
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger id="priority" className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ priority })}
                      disabled={updateMutation.isPending || priority === ticket.priority}
                      aria-label="Save priority"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Badge variant={priorityVariant(ticket.priority)}>{humanise(ticket.priority)}</Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Badge variant="outline">{humanise(ticket.category)}</Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignee">Assigned to</Label>
                {canManage ? (
                  <div className="flex gap-2">
                    <Select value={assignee} onValueChange={setAssignee}>
                      <SelectTrigger id="assignee" className="flex-1">
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {assignees.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.full_name ?? 'Unnamed'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ assignedTo: assignee === UNASSIGNED ? null : assignee })}
                      disabled={updateMutation.isPending || assignee === (ticket.assigned_to ?? UNASSIGNED)}
                      aria-label="Save assignee"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm">{ticket.assigned_to_name ?? 'Unassigned'}</p>
                )}
              </div>

              {canManage ? (
                <div className="space-y-2">
                  <Label htmlFor="resolution">Resolution notes</Label>
                  <Textarea
                    id="resolution"
                    rows={3}
                    value={resolution}
                    placeholder="How was this resolved?"
                    onChange={(event) => setResolution(event.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateMutation.mutate({ resolution })}
                    disabled={updateMutation.isPending || resolution === (ticket.resolution ?? '')}
                  >
                    Save resolution
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-blue-500" />
                <div>
                  <p className="font-medium">Ticket created</p>
                  <p className="text-xs text-muted-foreground">
                    by {ticket.created_by_name ?? 'Unknown'} on {formatDateTime(ticket.created_at)}
                  </p>
                </div>
              </div>
              {ticket.sla_due_date ? (
                <div className="flex gap-3">
                  <span className={`mt-2 h-2 w-2 rounded-full ${overdue ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="font-medium">SLA target</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(ticket.sla_due_date)}</p>
                  </div>
                </div>
              ) : null}
              {ticket.assigned_to ? (
                <div className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-green-500" />
                  <div>
                    <p className="font-medium">Assigned to {ticket.assigned_to_name ?? 'a technician'}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(ticket.updated_at)}</p>
                  </div>
                </div>
              ) : null}
              {ticket.resolved_at ? (
                <div className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-emerald-600" />
                  <div>
                    <p className="font-medium">Resolved</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(ticket.resolved_at)}</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
