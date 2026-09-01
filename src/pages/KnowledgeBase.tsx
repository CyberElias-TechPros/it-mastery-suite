import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Eye, MessageSquare, Plus, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataPagination } from '@/components/DataPagination';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { api, type PageMeta } from '@/lib/api';
import { formatNumber, formatRelative } from '@/lib/format';

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

interface CategoryRow {
  category: string;
  total: number;
}

interface KbStats {
  total_articles: number;
  total_views: number;
  featured: number;
}

const ALL = 'all';

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-muted-foreground">Not rated yet</span>;
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3 w-3 ${star <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            <Link to={`/knowledge-base/${article.id}`} className="hover:underline">
              {article.title}
            </Link>
          </CardTitle>
          <div className="flex shrink-0 gap-1">
            {article.is_featured ? <Badge>Featured</Badge> : null}
            {!article.is_published ? <Badge variant="outline">Draft</Badge> : null}
          </div>
        </div>
        <CardDescription>
          {article.category ?? 'Uncategorised'} · updated {formatRelative(article.updated_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {article.content.replace(/[#*`>_-]/g, '').slice(0, 200)}
        </p>
        {article.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {article.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatNumber(article.view_count)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {formatNumber(article.comment_count)}
            </span>
          </span>
          <Stars rating={article.rating} />
        </div>
        <p className="text-xs text-muted-foreground">By {article.author_name ?? 'Unknown'}</p>
      </CardContent>
    </Card>
  );
}

export default function KnowledgeBase() {
  const { isStaff } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState<'updated_at' | 'view_count' | 'title'>('updated_at');
  const [page, setPage] = useState(1);
  const search = useDebounce(searchTerm, 300);

  useEffect(() => setPage(1), [search, category, sort]);

  const { data, isLoading } = useQuery({
    queryKey: ['kb-articles', search, category, sort, page],
    queryFn: () =>
      api.getPage<Article[]>('/knowledge-base', {
        page,
        pageSize: 12,
        search: search || undefined,
        category: category === ALL ? undefined : category,
        sort,
        direction: sort === 'title' ? 'asc' : 'desc',
      }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['kb-categories'],
    queryFn: () => api.get<CategoryRow[]>('/knowledge-base/categories'),
  });

  const { data: stats } = useQuery({ queryKey: ['kb-stats'], queryFn: () => api.get<KbStats>('/knowledge-base/stats') });

  const { data: featured } = useQuery({
    queryKey: ['kb-featured'],
    queryFn: () => api.getPage<Article[]>('/knowledge-base', { featured: 'true', pageSize: 3 }),
  });

  const articles = data?.data ?? [];
  const meta: PageMeta | undefined = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Knowledge base</h1>
          <p className="text-muted-foreground">IT documentation, procedures and how-tos</p>
        </div>
        {isStaff ? (
          <Button asChild>
            <Link to="/knowledge-base/new">
              <Plus className="mr-2 h-4 w-4" />
              New article
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published articles</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.total_articles)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.total_views)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Featured</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.featured)}</div>
          </CardContent>
        </Card>
      </div>

      {featured && featured.data.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Featured</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {featured.data.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-8"
            aria-label="Search articles"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((row) => (
              <SelectItem key={row.category} value={row.category}>
                {row.category} ({row.total})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
          <SelectTrigger className="w-44" aria-label="Sort articles">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at">Recently updated</SelectItem>
            <SelectItem value="view_count">Most viewed</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="p-8 text-center text-muted-foreground">Loading articles…</p>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">No articles match your filters.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      <DataPagination meta={meta} page={page} onPageChange={setPage} noun="articles" />
    </div>
  );
}
