import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Bot, CheckCircle, Plus, Trash2, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { useAuth } from '@/contexts/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, humanise } from '@/lib/format';

const TRIGGERS = [
  'ticket_created',
  'ticket_updated',
  'asset_registered',
  'expense_added',
  'diesel_low',
  'contract_expiring',
  'user_registered',
] as const;

const ACTION_TYPES = ['assign_technician', 'send_notification', 'escalate_ticket', 'update_status', 'create_task'] as const;

const OPERATORS = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'between'] as const;

type Trigger = (typeof TRIGGERS)[number];
type ActionType = (typeof ACTION_TYPES)[number];
type Operator = (typeof OPERATORS)[number];

interface Condition {
  field: string;
  operator: Operator;
  value: string;
  secondValue?: string;
}

interface RuleAction {
  type: ActionType;
  config: Record<string, unknown>;
}

interface Rule {
  id: string;
  name: string;
  description: string | null;
  trigger_event: Trigger;
  conditions: Condition[];
  actions: RuleAction[];
  is_active: boolean;
  created_by_name: string | null;
  execution_count: number;
  created_at: string;
}

interface Execution {
  id: string;
  rule_id: string;
  rule_name: string | null;
  status: 'success' | 'failed' | 'skipped';
  executed_at: string;
  trigger_data: Record<string, unknown>;
  result: unknown;
  error_message: string | null;
}

interface Person {
  id: string;
  full_name: string | null;
}

const ACTION_HINT: Record<ActionType, string> = {
  assign_technician: 'Assigns the ticket to the chosen technician when it is still unassigned.',
  send_notification: 'Sends an in-app notification with the message you provide.',
  escalate_ticket: 'Raises the ticket priority one level and notifies administrators.',
  update_status: 'Moves the ticket to the chosen status.',
  create_task: 'Creates a follow-up calendar task for the record.',
};

const emptyRule = () => ({
  name: '',
  description: '',
  triggerEvent: 'ticket_created' as Trigger,
  conditions: [] as Condition[],
  actions: [{ type: 'send_notification' as ActionType, config: {} as Record<string, unknown> }],
  isActive: true,
});

export default function AutomationRules() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyRule());
  const [deleting, setDeleting] = useState<Rule | null>(null);

  const { data: rules = [], isLoading } = useQuery({ queryKey: ['automation-rules'], queryFn: () => api.get<Rule[]>('/automation') });
  const { data: executions = [] } = useQuery({
    queryKey: ['automation-executions'],
    queryFn: () => api.get<Execution[]>('/automation/executions', { pageSize: 50 }),
  });
  const { data: technicians = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: () => api.get<Person[]>('/users/assignable'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    queryClient.invalidateQueries({ queryKey: ['automation-executions'] });
  };

  const saveRule = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: Record<string, unknown> }) =>
      id ? api.put(`/automation/${id}`, payload) : api.post('/automation', payload),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditingId(null);
      toast({ title: 'Rule saved' });
    },
    onError: (error) => toast({ title: 'Could not save the rule', description: errorMessage(error), variant: 'destructive' }),
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/automation/${id}`, { isActive }),
    onSuccess: () => invalidate(),
    onError: (error) => toast({ title: 'Could not update the rule', description: errorMessage(error), variant: 'destructive' }),
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => api.del(`/automation/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ title: 'Rule deleted' });
    },
    onError: (error) => toast({ title: 'Could not delete the rule', description: errorMessage(error), variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyRule());
    setDialogOpen(true);
  };

  const openEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setDraft({
      name: rule.name,
      description: rule.description ?? '',
      triggerEvent: rule.trigger_event,
      conditions: rule.conditions ?? [],
      actions: rule.actions?.length ? rule.actions : [{ type: 'send_notification', config: {} }],
      isActive: rule.is_active,
    });
    setDialogOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.actions.length === 0) {
      toast({ title: 'Add at least one action', variant: 'destructive' });
      return;
    }
    saveRule.mutate({
      id: editingId,
      payload: {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        triggerEvent: draft.triggerEvent,
        conditions: draft.conditions.filter((condition) => condition.field && condition.value !== ''),
        actions: draft.actions,
        isActive: draft.isActive,
      },
    });
  };

  const activeCount = rules.filter((rule) => rule.is_active).length;
  const successCount = executions.filter((execution) => execution.status === 'success').length;
  const failedCount = executions.filter((execution) => execution.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Automation</h1>
          <p className="text-muted-foreground">Rules that react to events across the service desk</p>
        </div>
        {isAdmin ? (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New rule
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rules</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent successes</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent failures</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="executions">Execution log</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {isLoading ? (
            <p className="p-8 text-center text-muted-foreground">Loading rules…</p>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                No automation rules yet. Rules run automatically when their trigger event fires.
              </CardContent>
            </Card>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <CardDescription>{rule.description ?? 'No description'}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.is_active ? 'default' : 'outline'}>{rule.is_active ? 'Active' : 'Paused'}</Badge>
                      {isAdmin ? (
                        <>
                          <Switch
                            checked={rule.is_active}
                            aria-label={`Toggle ${rule.name}`}
                            onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, isActive: checked })}
                          />
                          <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" aria-label={`Delete ${rule.name}`} onClick={() => setDeleting(rule)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">When</span>
                    <Badge variant="secondary">{humanise(rule.trigger_event)}</Badge>
                    {rule.conditions.length > 0 ? (
                      <>
                        <span className="text-muted-foreground">and</span>
                        {rule.conditions.map((condition, index) => (
                          <Badge key={index} variant="outline">
                            {condition.field} {humanise(condition.operator).toLowerCase()} {String(condition.value)}
                            {condition.operator === 'between' && condition.secondValue ? ` – ${condition.secondValue}` : ''}
                          </Badge>
                        ))}
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Then</span>
                    {rule.actions.map((action, index) => (
                      <Badge key={index}>{humanise(action.type)}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {rule.execution_count} executions · created by {rule.created_by_name ?? 'Unknown'} on{' '}
                    {formatDateTime(rule.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="executions" className="space-y-2">
          {executions.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">No executions recorded yet.</CardContent>
            </Card>
          ) : (
            executions.map((execution) => (
              <Card key={execution.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{execution.rule_name ?? 'Deleted rule'}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(execution.executed_at)}</p>
                    {execution.error_message ? (
                      <p className="text-xs text-destructive">{execution.error_message}</p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      execution.status === 'success' ? 'default' : execution.status === 'failed' ? 'destructive' : 'secondary'
                    }
                  >
                    {humanise(execution.status)}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit rule' : 'New automation rule'}</DialogTitle>
            <DialogDescription>
              Conditions are evaluated against the event payload; every matching rule runs its actions in order.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                required
                minLength={3}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-description">Description</Label>
              <Textarea
                id="rule-description"
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-trigger">Trigger</Label>
              <Select
                value={draft.triggerEvent}
                onValueChange={(value) => setDraft((current) => ({ ...current, triggerEvent: value as Trigger }))}
              >
                <SelectTrigger id="rule-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger} value={trigger}>
                      {humanise(trigger)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Conditions</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={draft.conditions.length >= 10}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      conditions: [...current.conditions, { field: 'priority', operator: 'equals', value: '' }],
                    }))
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add condition
                </Button>
              </div>
              {draft.conditions.map((condition, index) => (
                <div key={index} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <Input
                    aria-label="Condition field"
                    placeholder="Field (e.g. priority)"
                    value={condition.field}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        conditions: current.conditions.map((item, i) =>
                          i === index ? { ...item, field: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Select
                    value={condition.operator}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        conditions: current.conditions.map((item, i) =>
                          i === index ? { ...item, operator: value as Operator } : item,
                        ),
                      }))
                    }
                  >
                    <SelectTrigger aria-label="Condition operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {humanise(operator)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    <Input
                      aria-label="Condition value"
                      placeholder="Value"
                      value={String(condition.value)}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          conditions: current.conditions.map((item, i) =>
                            i === index ? { ...item, value: event.target.value } : item,
                          ),
                        }))
                      }
                    />
                    {condition.operator === 'between' ? (
                      <Input
                        aria-label="Second value"
                        placeholder="and"
                        value={String(condition.secondValue ?? '')}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            conditions: current.conditions.map((item, i) =>
                              i === index ? { ...item, secondValue: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove condition ${index + 1}`}
                    onClick={() =>
                      setDraft((current) => ({ ...current, conditions: current.conditions.filter((_, i) => i !== index) }))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Actions</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={draft.actions.length >= 5}
                  onClick={() =>
                    setDraft((current) => ({ ...current, actions: [...current.actions, { type: 'send_notification', config: {} }] }))
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add action
                </Button>
              </div>
              {draft.actions.map((action, index) => (
                <div key={index} className="space-y-2 rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={action.type}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          actions: current.actions.map((item, i) =>
                            i === index ? { type: value as ActionType, config: {} } : item,
                          ),
                        }))
                      }
                    >
                      <SelectTrigger aria-label="Action type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {humanise(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove action ${index + 1}`}
                      disabled={draft.actions.length === 1}
                      onClick={() =>
                        setDraft((current) => ({ ...current, actions: current.actions.filter((_, i) => i !== index) }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{ACTION_HINT[action.type]}</p>

                  {action.type === 'assign_technician' ? (
                    <Select
                      value={String(action.config.technicianId ?? '')}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          actions: current.actions.map((item, i) =>
                            i === index ? { ...item, config: { ...item.config, technicianId: value } } : item,
                          ),
                        }))
                      }
                    >
                      <SelectTrigger aria-label="Technician">
                        <SelectValue placeholder="Choose a technician" />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.full_name ?? 'Unnamed'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {action.type === 'send_notification' ? (
                    <Input
                      aria-label="Notification message"
                      placeholder="Message sent to the recipient"
                      value={String(action.config.message ?? '')}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          actions: current.actions.map((item, i) =>
                            i === index ? { ...item, config: { ...item.config, message: event.target.value } } : item,
                          ),
                        }))
                      }
                    />
                  ) : null}

                  {action.type === 'update_status' ? (
                    <Select
                      value={String(action.config.status ?? '')}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          actions: current.actions.map((item, i) =>
                            i === index ? { ...item, config: { ...item.config, status: value } } : item,
                          ),
                        }))
                      }
                    >
                      <SelectTrigger aria-label="Target status">
                        <SelectValue placeholder="Choose a status" />
                      </SelectTrigger>
                      <SelectContent>
                        {['open', 'in_progress', 'resolved', 'closed'].map((status) => (
                          <SelectItem key={status} value={status}>
                            {humanise(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {action.type === 'create_task' ? (
                    <Input
                      aria-label="Task title"
                      placeholder="Follow-up task title"
                      value={String(action.config.title ?? '')}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          actions: current.actions.map((item, i) =>
                            i === index ? { ...item, config: { ...item.config, title: event.target.value } } : item,
                          ),
                        }))
                      }
                    />
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="rule-active"
                checked={draft.isActive}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, isActive: checked }))}
              />
              <Label htmlFor="rule-active" className="font-normal">
                Rule is active
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveRule.isPending}>
                Save rule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The rule stops running immediately. Its execution history is removed with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteRule.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
