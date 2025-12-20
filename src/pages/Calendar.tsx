import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  MapPin,
  Bell
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar-events", currentDate, view],
    queryFn: async () => {
      let startDate: Date;
      let endDate: Date;

      if (view === "month") {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
      } else if (view === "week") {
        startDate = startOfWeek(currentDate);
        endDate = endOfWeek(currentDate);
      } else {
        startDate = new Date(currentDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999);
      }

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_date", startDate.toISOString())
        .lte("end_date", endDate.toISOString())
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: assetReminders } = useQuery({
    queryKey: ["asset-reminders"],
    queryFn: async () => {
      // Get assets with upcoming warranty expiry (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data, error } = await supabase
        .from("assets")
        .select("id, name, warranty_expiry, asset_tag")
        .lte("warranty_expiry", thirtyDaysFromNow.toISOString())
        .gte("warranty_expiry", new Date().toISOString());

      if (error) throw error;
      return data || [];
    },
  });

  const { data: vendorReminders } = useQuery({
    queryKey: ["vendor-reminders"],
    queryFn: async () => {
      // Get vendors with contracts expiring soon
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, contract_end_date")
        .lte("contract_end_date", thirtyDaysFromNow.toISOString())
        .gte("contract_end_date", new Date().toISOString());

      if (error) throw error;
      return data || [];
    },
  });

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev =>
      direction === "next" ? addMonths(prev, 1) : subMonths(prev, 1)
    );
  };

  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  };

  const getEventsForDate = (date: Date) => {
    return events?.filter(event =>
      isSameDay(new Date(event.start_date), date)
    ) || [];
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case "maintenance":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "meeting":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "reminder":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "deadline":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const renderMonthView = () => {
    const days = getDaysInMonth();

    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Header */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="p-2 text-center font-medium text-sm text-muted-foreground">
            {day}
          </div>
        ))}

        {/* Days */}
        {days.map(day => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={`
                min-h-[120px] p-2 border cursor-pointer hover:bg-muted/50
                ${isCurrentMonth ? "bg-background" : "bg-muted/20"}
                ${isToday ? "bg-primary/5 border-primary" : "border-border"}
              `}
              onClick={() => setSelectedDate(day)}
            >
              <div className={`text-sm font-medium mb-1 ${isCurrentMonth ? "" : "text-muted-foreground"}`}>
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className={`text-xs p-1 rounded border ${getEventTypeColor(event.event_type)} truncate`}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">Schedule and manage events</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
            </DialogHeader>
            <EventForm onSuccess={() => setIsCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Reminders Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Asset Warranty Reminders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assetReminders && assetReminders.length > 0 ? (
              <div className="space-y-2">
                {assetReminders.map(asset => (
                  <div key={asset.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Warranty expires: {format(new Date(asset.warranty_expiry), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant="outline">{asset.asset_tag}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No upcoming warranty expirations</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Vendor Contract Reminders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vendorReminders && vendorReminders.length > 0 ? (
              <div className="space-y-2">
                {vendorReminders.map(vendor => (
                  <div key={vendor.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{vendor.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Contract expires: {format(new Date(vendor.contract_end_date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant="outline">Contract</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No upcoming contract expirations</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl font-semibold">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Select value={view} onValueChange={(value: any) => setView(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="day">Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">Loading calendar...</div>
          ) : (
            renderMonthView()
          )}
        </CardContent>
      </Card>

      {/* Selected Date Events */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>
              Events for {format(selectedDate, "MMMM d, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getEventsForDate(selectedDate).length > 0 ? (
              <div className="space-y-3">
                {getEventsForDate(selectedDate).map(event => (
                  <div key={event.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium">{event.title}</h3>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(new Date(event.start_date), "h:mm a")} - {format(new Date(event.end_date), "h:mm a")}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {event.location}
                            </div>
                          )}
                          {event.attendees && event.attendees.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {event.attendees.length} attendees
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge className={getEventTypeColor(event.event_type)}>
                        {event.event_type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No events scheduled for this date</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EventForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    event_type: "meeting" as "meeting" | "maintenance" | "deadline" | "other",
    location: "",
  });
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from("calendar_events")
        .insert([{
          ...formData,
          created_by: user?.id || '',
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event created successfully",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date & Time *</Label>
          <Input
            id="start_date"
            type="datetime-local"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">End Date & Time *</Label>
          <Input
            id="end_date"
            type="datetime-local"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="event_type">Event Type</Label>
          <Select value={formData.event_type} onValueChange={(value: "meeting" | "maintenance" | "deadline" | "other") => setFormData({ ...formData, event_type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="reminder">Reminder</SelectItem>
              <SelectItem value="deadline">Deadline</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="e.g., Conference Room A"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">Create Event</Button>
      </div>
    </form>
  );
}