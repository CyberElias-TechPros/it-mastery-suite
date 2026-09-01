import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { Bell, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, humanise } from '@/lib/format';

type EventType = 'maintenance' | 'meeting' | 'deadline' | 'other';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  event_type: EventType;
  all_day: boolean;
  location: string | null;
  attendees: string[];
  created_by: string;
  created_by_name: string | null;
  related_ticket_number: string | null;
  reminder_minutes: number;
}

const EVENT_TYPES: EventType[] = ['maintenance', 'meeting', 'deadline', 'other'];
const ALL = 'all';

const TYPE_CLASS: Record<EventType, string> = {
  maintenance: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  meeting: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
  deadline: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
  other: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
};

/** `datetime-local` value (local wall clock) → ISO-8601 with offset, which the API requires. */
function toIso(value: string) {
  return value ? new Date(value).toISOString() : '';
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function Calendar() {
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cursor, setCursor] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [onlyMine, setOnlyMine] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart.getTime(), gridEnd.getTime()]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events', gridStart.toISOString(), gridEnd.toISOString(), typeFilter, onlyMine],
    queryFn: () =>
      api.get<CalendarEvent[]>('/calendar', {
        start: gridStart.toISOString(),
        end: gridEnd.toISOString(),
        eventType: typeFilter === ALL ? undefined : typeFilter,
        mine: onlyMine ? 'true' : undefined,
      }),
  });

  const { data: people = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: () => api.get<{ id: string; full_name: string | null }[]>('/users/assignable'),
  });

  const saveEvent = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id ? api.put(`/calendar/${id}`, payload) : api.post('/calendar', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setDialogOpen(false);
      setEditing(null);
      toast({ title: 'Event saved' });
    },
    onError: (error) => toast({ title: 'Could not save the event', description: errorMessage(error), variant: 'destructive' }),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => api.del(`/calendar/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: 'Event deleted' });
    },
    onError: (error) => toast({ title: 'Could not delete the event', description: errorMessage(error), variant: 'destructive' }),
  });

  const eventsForDay = (day: Date) =>
    events.filter((event) => {
      const start = parseISO(event.start_date);
      const end = parseISO(event.end_date);
      return (start <= day && end >= day) || isSameDay(start, day) || isSameDay(end, day);
    });

  const selectedEvents = eventsForDay(selectedDate);
  const upcoming = [...events]
    .filter((event) => parseISO(event.end_date) >= new Date())
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5);

  const canManage = (event: CalendarEvent) => isAdmin || event.created_by === profile?.id;

  const openCreate = (date?: Date) => {
    setEditing(null);
    if (date) setSelectedDate(date);
    setDialogOpen(true);
  };

  const defaults = editing
    ? {
        title: editing.title,
        description: editing.description ?? '',
        startDate: toLocalInput(editing.start_date),
        endDate: toLocalInput(editing.end_date),
        eventType: editing.event_type,
        allDay: editing.all_day,
        location: editing.location ?? '',
        attendees: editing.attendees,
        reminderMinutes: editing.reminder_minutes,
      }
    : {
        title: '',
        description: '',
        startDate: toLocalInput(new Date(selectedDate.getTime()).toISOString()).slice(0, 11) + '09:00',
        endDate: toLocalInput(new Date(selectedDate.getTime()).toISOString()).slice(0, 11) + '10:00',
        eventType: 'other' as EventType,
        allDay: false,
        location: '',
        attendees: [] as string[],
        reminderMinutes: 15,
      };

  const [attendees, setAttendees] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">Maintenance windows, meetings and deadlines</p>
        </div>
        <Button
          onClick={() => {
            setAttendees([]);
            openCreate(selectedDate);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New event
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center font-medium">{format(cursor, 'MMMM yyyy')}</span>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by event type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {EVENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {humanise(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyMine} onCheckedChange={(checked) => setOnlyMine(checked === true)} />
          Only my events
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-muted-foreground">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-border">
              {days.map((day) => {
                const dayEvents = eventsForDay(day);
                const isCurrentMonth = isSameMonth(day, cursor);
                const isSelected = isSameDay(day, selectedDate);
                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[92px] bg-background p-1.5 text-left align-top transition-colors hover:bg-accent ${
                      isCurrentMonth ? '' : 'text-muted-foreground/50'
                    } ${isSelected ? 'ring-2 ring-inset ring-primary' : ''}`}
                  >
                    <span className={`text-xs font-medium ${isSameDay(day, new Date()) ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <span
                          key={event.id}
                          className={`block truncate rounded px-1 py-0.5 text-[10px] ${TYPE_CLASS[event.event_type]}`}
                        >
                          {event.title}
                        </span>
                      ))}
                      {dayEvents.length > 2 ? (
                        <span className="block text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
            {isLoading ? <p className="pt-3 text-center text-sm text-muted-foreground">Loading events…</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{format(selectedDate, 'EEEE d MMMM yyyy')}</CardTitle>
              <CardDescription>
                {selectedEvents.length} {selectedEvents.length === 1 ? 'event' : 'events'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
              ) : (
                selectedEvents.map((event) => (
                  <div key={event.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <Badge variant="outline" className="mt-1">
                          {humanise(event.event_type)}
                        </Badge>
                      </div>
                      {canManage(event) ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(event);
                              setAttendees(event.attendees);
                              setDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${event.title}`}
                            onClick={() => deleteEvent.mutate(event.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {event.description ? <p className="mt-2 text-sm text-muted-foreground">{event.description}</p> : null}
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.all_day ? 'All day' : `${formatDateTime(event.start_date)} → ${formatDateTime(event.end_date)}`}
                      </p>
                      {event.location ? (
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </p>
                      ) : null}
                      {event.attendees.length > 0 ? (
                        <p className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {event.attendees.length} attendees
                        </p>
                      ) : null}
                      {event.related_ticket_number ? <p>Ticket {event.related_ticket_number}</p> : null}
                      <p className="flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        Reminder {event.reminder_minutes} min before
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarIcon className="h-4 w-4" />
                Coming up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events this month.</p>
              ) : (
                upcoming.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="block w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
                    onClick={() => setSelectedDate(parseISO(event.start_date))}
                  >
                    <span className="font-medium">{event.title}</span>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(event.start_date)}</span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit event' : 'New event'}</DialogTitle>
            <DialogDescription>Attendees receive a notification and a reminder before the event starts.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const startDate = toIso(String(form.get('startDate')));
              const endDate = toIso(String(form.get('endDate')));
              if (new Date(endDate) <= new Date(startDate)) {
                toast({ title: 'Invalid dates', description: 'The event must end after it starts.', variant: 'destructive' });
                return;
              }
              saveEvent.mutate({
                id: editing?.id,
                payload: {
                  title: String(form.get('title')),
                  description: String(form.get('description') ?? '') || null,
                  startDate,
                  endDate,
                  eventType: String(form.get('eventType')),
                  allDay: form.get('allDay') === 'on',
                  location: String(form.get('location') ?? '') || null,
                  attendees,
                  reminderMinutes: Number(form.get('reminderMinutes') ?? 15),
                },
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input id="event-title" name="title" defaultValue={defaults.title} required minLength={3} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea id="event-description" name="description" defaultValue={defaults.description} rows={3} maxLength={2000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-start">Starts</Label>
                <Input id="event-start" name="startDate" type="datetime-local" defaultValue={defaults.startDate} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end">Ends</Label>
                <Input id="event-end" name="endDate" type="datetime-local" defaultValue={defaults.endDate} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-type">Type</Label>
                <Select name="eventType" defaultValue={defaults.eventType}>
                  <SelectTrigger id="event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {humanise(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-reminder">Reminder (minutes before)</Label>
                <Input
                  id="event-reminder"
                  name="reminderMinutes"
                  type="number"
                  min="0"
                  max="10080"
                  defaultValue={defaults.reminderMinutes}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="event-location">Location</Label>
                <Input id="event-location" name="location" defaultValue={defaults.location} maxLength={200} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allDay" defaultChecked={defaults.allDay} className="h-4 w-4" />
              All-day event
            </label>
            <div className="space-y-2">
              <Label>Attendees</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {people.map((person) => (
                  <label key={person.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={attendees.includes(person.id)}
                      onCheckedChange={(checked) =>
                        setAttendees((current) =>
                          checked === true ? [...current, person.id] : current.filter((item) => item !== person.id),
                        )
                      }
                    />
                    {person.full_name ?? 'Unnamed'}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveEvent.isPending}>
                Save event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
