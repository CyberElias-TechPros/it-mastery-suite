import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/FileUpload";
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Paperclip,
  Send,
  Edit,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Tag,
  Download,
  File
} from "lucide-react";
import { format } from "date-fns";

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingPriority, setEditingPriority] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          created_by_profile:profiles!tickets_created_by_fkey(full_name, email, avatar_url),
          assigned_to_profile:profiles!tickets_assigned_to_fkey(full_name, email, avatar_url)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["ticket-comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_comments")
        .select(`
          *,
          user_profile:profiles!ticket_comments_user_id_fkey(full_name, email, avatar_url)
        `)
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: attachments } = useQuery({
    queryKey: ["ticket-attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("resource_type", "ticket")
        .eq("resource_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["admin", "technician"]);

      if (error) throw error;
      return data || [];
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { data, error } = await supabase
        .from("tickets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({
        title: "Success",
        description: "Ticket updated successfully",
      });
      setEditingStatus(false);
      setEditingPriority(false);
      setEditingAssignee(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update ticket",
        variant: "destructive",
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (commentData: any) => {
      const { data, error } = await supabase
        .from("ticket_comments")
        .insert(commentData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", id] });
      setNewComment("");
      setIsInternal(false);
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setPriority(ticket.priority);
      setAssignee(ticket.assigned_to || "");
    }
  }, [ticket]);

  const handleStatusUpdate = () => {
    updateTicketMutation.mutate({ status });
  };

  const handlePriorityUpdate = () => {
    updateTicketMutation.mutate({ priority });
  };

  const handleAssigneeUpdate = () => {
    updateTicketMutation.mutate({ assigned_to: assignee || null });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    addCommentMutation.mutate({
      ticket_id: id,
      user_id: user?.id,
      comment: newComment,
      is_internal: isInternal,
    });
  };

  const handleFileUploaded = (fileData: any) => {
    queryClient.invalidateQueries({ queryKey: ["ticket-attachments", id] });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      default:
        return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "default";
      case "in_progress":
        return "warning";
      case "resolved":
        return "success";
      case "closed":
        return "secondary";
      default:
        return "outline";
    }
  };

  const canEditTicket = () => {
    return profile?.role === "admin" || profile?.role === "technician";
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading ticket...</div>;
  }

  if (!ticket) {
    return <div className="flex justify-center p-8">Ticket not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/tickets">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tickets
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Ticket {ticket.ticket_number}</h1>
            <Badge variant={getStatusColor(ticket.status) as any}>
              {ticket.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-muted-foreground">{ticket.title}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Ticket Description */}
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

          {/* Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Attachments ({attachments?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {attachments && attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment: any) => (
                    <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{attachment.file_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(attachment.file_size || 0)} • Uploaded {format(new Date(attachment.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={attachment.file_path} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <FileUpload
                onFileUploaded={handleFileUploaded}
                resourceType="ticket"
                resourceId={id || ""}
                accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                maxSize={10}
                multiple={true}
              />
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments ({comments?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Comments */}
              <div className="space-y-4">
                {comments?.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {comment.user_profile?.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {comment.user_profile?.full_name}
                        </span>
                        {comment.is_internal && (
                          <Badge variant="outline" className="text-xs">
                            Internal
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm">{comment.comment}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Add Comment */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="comment">Add Comment</Label>
                  {canEditTicket() && (
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded"
                      />
                      Internal Note
                    </label>
                  )}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    id="comment"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    size="sm"
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Details */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                {editingStatus ? (
                  <div className="flex gap-2">
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleStatusUpdate} disabled={updateTicketMutation.isPending}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <Badge variant={getStatusColor(ticket.status) as any}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                    {canEditTicket() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingStatus(true)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                {editingPriority ? (
                  <div className="flex gap-2">
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handlePriorityUpdate} disabled={updateTicketMutation.isPending}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <Badge variant={getPriorityColor(ticket.priority) as any}>
                      {ticket.priority}
                    </Badge>
                    {canEditTicket() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPriority(true)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Badge variant="outline" className="capitalize">
                  {ticket.category.replace("_", " ")}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Assigned To</Label>
                {editingAssignee ? (
                  <div className="flex gap-2">
                    <Select value={assignee} onValueChange={setAssignee}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleAssigneeUpdate} disabled={updateTicketMutation.isPending}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {ticket.assigned_to_profile?.full_name || "Unassigned"}
                    </span>
                    {canEditTicket() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAssignee(true)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Ticket Created</p>
                  <p className="text-xs text-muted-foreground">
                    by {ticket.created_by_profile?.full_name} on {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>

              {ticket.assigned_to && ticket.assigned_to !== ticket.created_by && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Assigned to {ticket.assigned_to_profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ticket.updated_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              )}

              {comments?.map((comment: any) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-2 h-2 bg-gray-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Comment {comment.is_internal ? "(Internal)" : ""} by {comment.user_profile?.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}