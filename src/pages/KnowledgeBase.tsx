import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, BookOpen, Star, MessageSquare, Eye, Clock, User } from "lucide-react";
import { format } from "date-fns";

export default function KnowledgeBase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_at");

  const { data: articles, isLoading } = useQuery({
    queryKey: ["kb-articles", searchTerm, categoryFilter, sortBy],
    queryFn: async () => {
      let query = supabase
        .from("kb_articles")
        .select(`
          *,
          author_profile:profiles!kb_articles_author_id_fkey(full_name, avatar_url)
        `)
        .eq("is_published", true)
        .order(sortBy === "view_count" ? "view_count" : "updated_at", {
          ascending: sortBy === "title" ? true : false
        });

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      if (searchTerm) {
        query = query.or(
          `title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["kb-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kb_articles")
        .select("category")
        .not("category", "is", null);

      if (error) throw error;

      // Get unique categories
      const uniqueCategories = [...new Set(data.map(item => item.category))];
      return uniqueCategories.filter(Boolean);
    },
  });

  const { data: featuredArticles } = useQuery({
    queryKey: ["featured-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kb_articles")
        .select(`
          *,
          author_profile:profiles!kb_articles_author_id_fkey(full_name, avatar_url)
        `)
        .eq("is_featured", true)
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      return data || [];
    },
  });

  const getUniqueCategories = () => {
    return categories || [];
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-1">({rating})</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">IT documentation and procedures</p>
        </div>
        <Link to="/knowledge-base/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Article
          </Button>
        </Link>
      </div>

      {/* Featured Articles */}
      {featuredArticles && featuredArticles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Featured Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {featuredArticles.map((article: any) => (
                <Link key={article.id} to={`/knowledge-base/${article.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <h3 className="font-semibold line-clamp-2">{article.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {article.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Eye className="h-3 w-3" />
                          {article.view_count || 0} views
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>All Articles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {getUniqueCategories().map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">Recently Updated</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
                <SelectItem value="view_count">Most Viewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Articles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                  <div className="flex gap-2">
                    <div className="h-5 bg-muted rounded w-16"></div>
                    <div className="h-5 bg-muted rounded w-12"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : !articles || articles.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No articles found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || categoryFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Create your first knowledge base article to get started"}
                </p>
                {!searchTerm && categoryFilter === "all" && (
                  <Link to="/knowledge-base/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Article
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          articles.map((article: any) => (
            <Link key={article.id} to={`/knowledge-base/${article.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold line-clamp-2 flex-1">{article.title}</h3>
                      {article.is_featured && (
                        <Star className="h-4 w-4 text-yellow-500 flex-shrink-0 ml-2" />
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {article.content.replace(/<[^>]*>/g, '').substring(0, 120)}...
                    </p>

                    {article.category && (
                      <Badge variant="outline" className="text-xs">
                        {article.category}
                      </Badge>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.view_count || 0}
                        </div>
                        {article.rating && renderStars(article.rating)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(article.updated_at), "MMM d")}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {article.author_profile?.full_name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {article.author_profile?.full_name || "Unknown"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}