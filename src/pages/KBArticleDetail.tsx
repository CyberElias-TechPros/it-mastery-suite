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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Star,
  MessageSquare,
  ThumbsUp,
  Eye,
  Calendar,
  User,
  Send,
  Edit,
  Tag
} from "lucide-react";
import { format } from "date-fns";

export default function KBArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [userRating, setUserRating] = useState<number | null>(null);

  const { data: article, isLoading } = useQuery({
    queryKey: ["kb-article", id],
    queryFn: async () => {
      // First, increment view count
      await supabase.rpc('increment_view_count', { article_id: id });

      // Then fetch article with author info
      const { data, error } = await supabase
        .from("kb_articles")
        .select(`
          *,
          author_profile:profiles!kb_articles_author_id_fkey(full_name, avatar_url)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["kb-comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kb_comments")
        .select(`
          *,
          user_profile:profiles!kb_comments_user_id_fkey(full_name, avatar_url)
        `)
        .eq("article_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: userRatingData } = useQuery({
    queryKey: ["user-rating", id, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("kb_ratings")
        .select("rating")
        .eq("article_id", id)
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data;
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (commentData: any) => {
      const { data, error } = await supabase
        .from("kb_comments")
        .insert(commentData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-comments", id] });
      setNewComment("");
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

  const rateArticleMutation = useMutation({
    mutationFn: async (rating: number) => {
      const { data, error } = await supabase
        .from("kb_ratings")
        .upsert({
          article_id: id,
          user_id: user?.id,
          rating: rating,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-article", id] });
      queryClient.invalidateQueries({ queryKey: ["user-rating", id, user?.id] });
      toast({
        title: "Success",
        description: "Rating submitted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit rating",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (userRatingData) {
      setUserRating(userRatingData.rating);
    }
  }, [userRatingData]);

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    addCommentMutation.mutate({
      article_id: id,
      user_id: user?.id,
      comment: newComment,
    });
  };

  const handleRating = (rating: number) => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to rate articles",
        variant: "destructive",
      });
      return;
    }

    setUserRating(rating);
    rateArticleMutation.mutate(rating);
  };

  const renderStars = (rating: number | null, interactive = false) => {
    if (!rating && !interactive) return null;

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              interactive
                ? star <= (userRating || 0)
                  ? "fill-yellow-400 text-yellow-400 cursor-pointer hover:scale-110"
                  : "text-gray-300 cursor-pointer hover:text-yellow-400 hover:scale-110"
                : star <= (rating || 0)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            } transition-transform`}
            onClick={interactive ? () => handleRating(star) : undefined}
          />
        ))}
        {rating && !interactive && (
          <span className="text-sm text-muted-foreground ml-1">({rating})</span>
        )}
      </div>
    );
  };

  const formatContent = (content: string) => {
    // Basic markdown-like formatting
    return content
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mb-4 mt-6 first:mt-0">{line.substring(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mb-3 mt-5">{line.substring(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-medium mb-2 mt-4">{line.substring(4)}</h3>;
        }

        // Bold and italic
        let formattedLine = line
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');

        // Lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={index} className="ml-4" dangerouslySetInnerHTML={{ __html: formattedLine.substring(2) }} />;
        }

        // Empty lines
        if (line.trim() === '') {
          return <br key={index} />;
        }

        // Regular paragraphs
        return <p key={index} className="mb-3" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
      });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading article...</div>;
  }

  if (!article) {
    return <div className="flex justify-center p-8">Article not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/knowledge-base">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Knowledge Base
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold">{article.title}</h1>
            {article.is_featured && (
              <Badge className="bg-yellow-100 text-yellow-800">
                <Star className="mr-1 h-3 w-3" />
                Featured
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {article.author_profile?.full_name || "Unknown"}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(article.updated_at), "MMM d, yyyy")}
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {article.view_count || 0} views
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {comments?.length || 0} comments
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Main Content */}
        <div className="md:col-span-3 space-y-6">
          {/* Article Content */}
          <Card>
            <CardContent className="p-6">
              <div className="prose prose-sm max-w-none">
                {formatContent(article.content)}
              </div>

              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {article.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rating Section */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-2">Rate this article</h3>
                  <p className="text-sm text-muted-foreground">
                    Help others find the most useful content
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {renderStars(article.rating)}
                  <div className="text-sm text-muted-foreground">
                    {article.rating ? `${article.rating}/5` : "No ratings yet"}
                  </div>
                </div>
              </div>
              <Separator className="my-4" />
              <div>
                <Label className="text-sm font-medium mb-2 block">Your Rating</Label>
                {renderStars(userRating, true)}
                {userRating && (
                  <p className="text-xs text-muted-foreground mt-1">
                    You rated this article {userRating} star{userRating !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
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
                <Label htmlFor="comment">Add a Comment</Label>
                <div className="flex gap-2">
                  <Textarea
                    id="comment"
                    placeholder="Share your thoughts about this article..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addCommentMutation.isPending}
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
          {/* Article Info */}
          <Card>
            <CardHeader>
              <CardTitle>Article Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Category</Label>
                <p className="text-sm">{article.category || "Uncategorized"}</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={article.is_published ? "default" : "secondary"}>
                    {article.is_published ? "Published" : "Draft"}
                  </Badge>
                  {article.is_featured && (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      Featured
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Last Updated</Label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(article.updated_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">Author</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {article.author_profile?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{article.author_profile?.full_name || "Unknown"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <ThumbsUp className="mr-2 h-4 w-4" />
                Helpful
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Edit className="mr-2 h-4 w-4" />
                Suggest Edit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}