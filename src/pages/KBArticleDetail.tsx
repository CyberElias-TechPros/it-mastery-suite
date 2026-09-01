import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, MessageSquare, Save, Send, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
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
import MarkdownEditor from '@/components/MarkdownEditor';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';

interface Article {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  author_id: string;
  author_name: string | null;
  is_featured: boolean;
  is_published: boolean;
  view_count: number;
  comment_count: number;
  rating: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  comment: string;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

interface RatingSummary {
  rating: number | null;
  rating_count: number;
  userRating: number | null;
}

function initials(name: string | null | undefined) {
  return (name ?? '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function KBArticleDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', content: '', category: '', tags: '', isPublished: true, isFeatured: false });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: article, isLoading, isError, error } = useQuery({
    queryKey: ['kb-article', id],
    queryFn: () => api.get<Article>(`/knowledge-base/${id}`),
    enabled: Boolean(id),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['kb-comments', id],
    queryFn: () => api.get<Comment[]>(`/knowledge-base/${id}/comments`),
    enabled: Boolean(id),
  });

  const { data: ratingSummary } = useQuery({
    queryKey: ['kb-rating', id],
    queryFn: () => api.get<RatingSummary>(`/knowledge-base/${id}/rating`),
    enabled: Boolean(id),
  });

  // Register a view once per mount; the API throttles to one counted view per user per hour.
  useEffect(() => {
    if (!id) return;
    api.post(`/knowledge-base/${id}/view`, {}).catch(() => undefined);
  }, [id]);

  const canEdit = Boolean(article && profile && (article.author_id === profile.id || isAdmin));

  const addComment = useMutation({
    mutationFn: (value: string) => api.post(`/knowledge-base/${id}/comments`, { comment: value }),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['kb-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['kb-article', id] });
      toast({ title: 'Comment posted' });
    },
    onError: (err) => toast({ title: 'Could not post the comment', description: errorMessage(err), variant: 'destructive' }),
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => api.del(`/knowledge-base/${id}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['kb-article', id] });
    },
    onError: (err) => toast({ title: 'Could not delete the comment', description: errorMessage(err), variant: 'destructive' }),
  });

  const rate = useMutation({
    mutationFn: (rating: number) => api.put(`/knowledge-base/${id}/rating`, { rating }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-rating', id] });
      queryClient.invalidateQueries({ queryKey: ['kb-article', id] });
      toast({ title: 'Thanks for the feedback' });
    },
    onError: (err) => toast({ title: 'Could not save your rating', description: errorMessage(err), variant: 'destructive' }),
  });

  const updateArticle = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put(`/knowledge-base/${id}`, payload),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['kb-article', id] });
      queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
      toast({ title: 'Article updated' });
    },
    onError: (err) => toast({ title: 'Could not update the article', description: errorMessage(err), variant: 'destructive' }),
  });

  const removeArticle = useMutation({
    mutationFn: () => api.del(`/knowledge-base/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
      toast({ title: 'Article deleted' });
      navigate('/knowledge-base');
    },
    onError: (err) => toast({ title: 'Could not delete the article', description: errorMessage(err), variant: 'destructive' }),
  });

  const openEditor = () => {
    if (!article) return;
    setDraft({
      title: article.title,
      content: article.content,
      category: article.category ?? '',
      tags: article.tags.join(', '),
      isPublished: article.is_published,
      isFeatured: article.is_featured,
    });
    setEditing(true);
  };

  if (isLoading) return <p className="p-8 text-center text-muted-foreground">Loading article…</p>;
  if (isError || !article) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="text-muted-foreground">{errorMessage(error) || 'This article is not available.'}</p>
        <Button asChild variant="outline">
          <Link to="/knowledge-base">Back to the knowledge base</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge-base')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {canEdit ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openEditor}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{article.title}</CardTitle>
              <CardDescription>
                {article.category ?? 'Uncategorised'} · by {article.author_name ?? 'Unknown'} · updated{' '}
                {formatRelative(article.updated_at)}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {article.is_featured ? <Badge>Featured</Badge> : null}
              {!article.is_published ? <Badge variant="outline">Draft</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {formatNumber(article.view_count)} views
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {formatNumber(article.comment_count)} comments
            </span>
            <span>Created {formatDateTime(article.created_at)}</span>
          </div>
          {article.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-2">
              {article.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <MarkdownRenderer content={article.content} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Was this article helpful?</CardTitle>
          <CardDescription>
            {ratingSummary?.rating
              ? `${ratingSummary.rating} out of 5 from ${ratingSummary.rating_count} ${
                  ratingSummary.rating_count === 1 ? 'rating' : 'ratings'
                }`
              : 'No ratings yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`Rate ${star} out of 5`}
              onClick={() => rate.mutate(star)}
              disabled={rate.isPending}
              className="rounded p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`h-5 w-5 ${
                  (ratingSummary?.userRating ?? 0) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'
                }`}
              />
            </button>
          ))}
          {ratingSummary?.userRating ? (
            <span className="ml-2 text-sm text-muted-foreground">You rated this {ratingSummary.userRating}/5</span>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comments ({comments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (comment.trim()) addComment.mutate(comment.trim());
            }}
          >
            <Label htmlFor="comment">Add a comment</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Share a correction, a tip, or a follow-up question"
              rows={3}
              maxLength={4000}
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={!comment.trim() || addComment.isPending}>
                <Send className="mr-2 h-4 w-4" />
                Post comment
              </Button>
            </div>
          </form>

          <Separator />

          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-4">
              {comments.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials(item.user_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.user_name ?? 'Unknown'}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatRelative(item.created_at)}</span>
                        {profile && (item.user_id === profile.id || isAdmin) ? (
                          <button
                            type="button"
                            aria-label="Delete comment"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteComment.mutate(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.comment}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit article</DialogTitle>
            <DialogDescription>Changes are visible to everyone with access to this article.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              updateArticle.mutate({
                title: draft.title.trim(),
                content: draft.content.trim(),
                category: draft.category.trim() || null,
                tags: draft.tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 20),
                isPublished: draft.isPublished,
                ...(isAdmin ? { isFeatured: draft.isFeatured } : {}),
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                required
                minLength={4}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <MarkdownEditor
                value={draft.content}
                onChange={(value) => setDraft((current) => ({ ...current, content: value }))}
                height={320}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={draft.category}
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tags">Tags (comma separated)</Label>
                <Input
                  id="edit-tags"
                  value={draft.tags}
                  onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-published"
                  checked={draft.isPublished}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, isPublished: checked === true }))}
                />
                <Label htmlFor="edit-published" className="font-normal">
                  Published
                </Label>
              </div>
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-featured"
                    checked={draft.isFeatured}
                    onCheckedChange={(checked) => setDraft((current) => ({ ...current, isFeatured: checked === true }))}
                  />
                  <Label htmlFor="edit-featured" className="font-normal">
                    Featured
                  </Label>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateArticle.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this article?</AlertDialogTitle>
            <AlertDialogDescription>
              The article is archived rather than erased, but it disappears from the knowledge base immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeArticle.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
