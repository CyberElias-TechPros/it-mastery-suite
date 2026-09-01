import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import MarkdownEditor from '@/components/MarkdownEditor';
import ArticleTemplates from '@/components/ArticleTemplates';
import { api, errorMessage } from '@/lib/api';

const KB_CATEGORIES = [
  'Getting Started',
  'Hardware',
  'Software',
  'Network',
  'Security',
  'Troubleshooting',
  'Best Practices',
  'Policies',
  'Training',
  'Other',
];

const NONE = 'none';

export default function NewKBArticle() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(NONE);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

  const createArticle = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<{ id: string }>('/knowledge-base', payload),
    onSuccess: (article) => {
      toast({ title: 'Article created' });
      navigate(`/knowledge-base/${article.id}`);
    },
    onError: (error) => toast({ title: 'Could not create the article', description: errorMessage(error), variant: 'destructive' }),
  });

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || tags.includes(value) || tags.length >= 20) return;
    setTags((current) => [...current, value]);
    setTagInput('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 4) {
      toast({ title: 'Title too short', description: 'Use at least 4 characters.', variant: 'destructive' });
      return;
    }
    if (content.trim().length < 20) {
      toast({ title: 'Content too short', description: 'Articles need at least 20 characters.', variant: 'destructive' });
      return;
    }
    createArticle.mutate({
      title: title.trim(),
      content: content.trim(),
      category: category === NONE ? null : category,
      tags,
      isFeatured: isAdmin ? isFeatured : false,
      isPublished,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge-base')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New article</h1>
          <p className="text-muted-foreground">Document a procedure so the next person does not have to ask</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
                <CardDescription>Markdown is supported. Start from a template if you prefer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="How to reset a workstation password"
                    required
                    minLength={4}
                    maxLength={200}
                  />
                </div>

                <Tabs defaultValue="write">
                  <TabsList>
                    <TabsTrigger value="write">Write</TabsTrigger>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                  </TabsList>
                  <TabsContent value="write" className="space-y-2">
                    <Label htmlFor="content">Article body</Label>
                    <MarkdownEditor
                      value={content}
                      onChange={setContent}
                      placeholder="Write your article using Markdown…"
                      height={420}
                    />
                  </TabsContent>
                  <TabsContent value="templates">
                    <ArticleTemplates
                      onSelectTemplate={(template) => {
                        setTitle(template.title);
                        setContent(template.content);
                        setCategory(KB_CATEGORIES.includes(template.category) ? template.category : NONE);
                        setTags(template.tags.slice(0, 20));
                        toast({ title: 'Template applied', description: 'Edit the placeholders before publishing.' });
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Uncategorised</SelectItem>
                      {KB_CATEGORIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      id="tags"
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Add a tag"
                      maxLength={40}
                    />
                    <Button type="button" variant="outline" onClick={addTag}>
                      Add
                    </Button>
                  </div>
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            aria-label={`Remove tag ${tag}`}
                            onClick={() => setTags((current) => current.filter((item) => item !== tag))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="published"
                    checked={isPublished}
                    onCheckedChange={(checked) => setIsPublished(checked === true)}
                  />
                  <Label htmlFor="published" className="font-normal">
                    Publish immediately
                  </Label>
                </div>

                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <Checkbox id="featured" checked={isFeatured} onCheckedChange={(checked) => setIsFeatured(checked === true)} />
                    <Label htmlFor="featured" className="font-normal">
                      Feature on the knowledge base home
                    </Label>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={createArticle.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {createArticle.isPending ? 'Saving…' : 'Save article'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/knowledge-base')}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
