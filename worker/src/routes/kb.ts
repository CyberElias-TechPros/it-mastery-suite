import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now, parseJsonColumn } from '../lib/db';
import { audit } from '../lib/audit';
import { created, ok, pageMeta } from '../lib/response';
import { likeTerm, optionalText, paginationSchema, parseJson, parseQuery, resolveSort } from '../lib/validation';
import { isStaff, requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

export const kbRoutes = new Hono<AppEnv>();
kbRoutes.use('*', requireAuth());

const SELECT = `
  a.id, a.title, a.content, a.category, a.tags, a.author_id, a.is_featured, a.is_published,
  a.view_count, a.created_at, a.updated_at,
  u.full_name AS author_name,
  (SELECT COUNT(*) FROM kb_comments cc WHERE cc.article_id = a.id) AS comment_count,
  (SELECT ROUND(AVG(r.rating), 2) FROM kb_ratings r WHERE r.article_id = a.id) AS rating,
  (SELECT COUNT(*) FROM kb_ratings r WHERE r.article_id = a.id) AS rating_count
  FROM kb_articles a
  LEFT JOIN users u ON u.id = a.author_id
`;

interface ArticleRow {
  id: string;
  tags: string;
  author_id: string;
  is_featured: number;
  is_published: number;
  [key: string]: unknown;
}

const shape = (row: ArticleRow | null) =>
  row && {
    ...row,
    tags: parseJsonColumn<string[]>(row.tags, []),
    is_featured: row.is_featured === 1,
    is_published: row.is_published === 1,
  };

const listQuery = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  tag: z.string().trim().max(40).optional(),
  featured: z.enum(['true']).optional(),
  includeDrafts: z.enum(['true']).optional(),
  sort: z.enum(['created_at', 'updated_at', 'view_count', 'title']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

kbRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const q = parseQuery(c, listQuery);
  const where = ['a.deleted_at IS NULL'];
  const values: unknown[] = [];

  // Drafts are only visible to their author and to admins.
  if (q.includeDrafts === 'true' && isStaff(user.role)) {
    if (user.role !== 'admin') {
      where.push('(a.is_published = 1 OR a.author_id = ?)');
      values.push(user.id);
    }
  } else {
    where.push('a.is_published = 1');
  }
  if (q.category) {
    where.push('a.category = ?');
    values.push(q.category);
  }
  if (q.featured === 'true') where.push('a.is_featured = 1');
  if (q.tag) {
    where.push("a.tags LIKE ? ESCAPE '\\'");
    values.push(likeTerm(`"${q.tag}"`));
  }
  if (q.search) {
    where.push("(a.title LIKE ? ESCAPE '\\' OR a.content LIKE ? ESCAPE '\\' OR a.tags LIKE ? ESCAPE '\\')");
    const term = likeTerm(q.search);
    values.push(term, term, term);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sort = resolveSort(q.sort, ['created_at', 'updated_at', 'view_count', 'title'], 'created_at');
  const direction = q.direction === 'asc' ? 'ASC' : 'DESC';
  const offset = (q.page - 1) * q.pageSize;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`SELECT ${SELECT} ${whereSql} ORDER BY a.is_featured DESC, a.${sort} ${direction} LIMIT ? OFFSET ?`)
      .bind(...values, q.pageSize, offset)
      .all<ArticleRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM kb_articles a ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);

  return ok(c, (rows.results ?? []).map(shape), pageMeta(q.page, q.pageSize, count?.total ?? 0));
});

kbRoutes.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT category, COUNT(*) AS total FROM kb_articles
     WHERE deleted_at IS NULL AND is_published = 1 AND category IS NOT NULL
     GROUP BY category ORDER BY category`,
  ).all();
  return ok(c, results ?? []);
});

kbRoutes.get('/stats', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total_articles,
            COALESCE(SUM(view_count), 0) AS total_views,
            SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) AS featured
     FROM kb_articles WHERE deleted_at IS NULL AND is_published = 1`,
  ).first();
  return ok(c, row ?? {});
});

kbRoutes.get('/:id', async (c) => {
  const user = c.get('user')!;
  const row = await c.env.DB.prepare(`SELECT ${SELECT} WHERE a.id = ? AND a.deleted_at IS NULL`)
    .bind(c.req.param('id'))
    .first<ArticleRow>();
  if (!row) throw ApiError.notFound('Article');
  if (!row.is_published && row.author_id !== user.id && user.role !== 'admin') throw ApiError.notFound('Article');
  return ok(c, shape(row));
});

/** Separate, non-idempotent endpoint so that GET stays cacheable and safe. */
kbRoutes.post('/:id/view', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  // One counted view per user per article per hour, tracked in KV.
  const key = `kbview:${id}:${user.id}`;
  const seen = await c.env.CACHE.get(key);
  if (!seen) {
    await c.env.DB.prepare(`UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .run();
    await c.env.CACHE.put(key, '1', { expirationTtl: 3600 });
  }
  return ok(c, { counted: !seen });
});

const articleSchema = z.object({
  title: z.string().trim().min(4).max(200),
  content: z.string().trim().min(20, 'Articles need at least 20 characters of content').max(200_000),
  category: optionalText(60),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});

kbRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  if (!isStaff(user.role)) throw ApiError.forbidden('Only support staff can publish knowledge base articles');
  const body = await parseJson(c, articleSchema);

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO kb_articles (id, title, content, category, tags, author_id, is_featured, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.title,
      body.content,
      body.category,
      JSON.stringify([...new Set(body.tags)]),
      user.id,
      // Only administrators may pin an article to the featured shelf.
      user.role === 'admin' && body.isFeatured ? 1 : 0,
      body.isPublished ? 1 : 0,
      ts,
      ts,
    )
    .run();

  await audit(c, 'kb.created', 'kb_article', id, { title: body.title });
  const row = await c.env.DB.prepare(`SELECT ${SELECT} WHERE a.id = ?`).bind(id).first<ArticleRow>();
  return created(c, shape(row));
});

kbRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const body = await parseJson(c, articleSchema.partial());

  const article = await c.env.DB.prepare(`SELECT * FROM kb_articles WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ author_id: string }>();
  if (!article) throw ApiError.notFound('Article');
  if (article.author_id !== user.id && user.role !== 'admin') throw ApiError.forbidden();

  const map: Record<string, unknown> = {
    title: body.title,
    content: body.content,
    category: body.category,
    tags: body.tags ? JSON.stringify([...new Set(body.tags)]) : undefined,
    is_published: body.isPublished === undefined ? undefined : body.isPublished ? 1 : 0,
    is_featured: body.isFeatured === undefined || user.role !== 'admin' ? undefined : body.isFeatured ? 1 : 0,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) throw ApiError.badRequest('No changes supplied');
  map.updated_at = now();
  keys.push('updated_at');

  await c.env.DB.prepare(`UPDATE kb_articles SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => map[k]), id)
    .run();

  await audit(c, 'kb.updated', 'kb_article', id, { fields: keys });
  const row = await c.env.DB.prepare(`SELECT ${SELECT} WHERE a.id = ?`).bind(id).first<ArticleRow>();
  return ok(c, shape(row));
});

kbRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const article = await c.env.DB.prepare(`SELECT author_id FROM kb_articles WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ author_id: string }>();
  if (!article) throw ApiError.notFound('Article');
  if (article.author_id !== user.id && user.role !== 'admin') throw ApiError.forbidden();

  await c.env.DB.prepare(`UPDATE kb_articles SET deleted_at = ?, updated_at = ? WHERE id = ?`).bind(now(), now(), id).run();
  await audit(c, 'kb.deleted', 'kb_article', id);
  return ok(c, { success: true });
});

/* -------------------------------------------------------------------------- */
/* Comments & ratings                                                          */
/* -------------------------------------------------------------------------- */

kbRoutes.get('/:id/comments', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT cm.*, u.full_name AS user_name, u.avatar_url AS user_avatar
     FROM kb_comments cm LEFT JOIN users u ON u.id = cm.user_id
     WHERE cm.article_id = ? ORDER BY cm.created_at DESC`,
  )
    .bind(c.req.param('id'))
    .all();
  return ok(c, results ?? []);
});

kbRoutes.post('/:id/comments', async (c) => {
  const articleId = c.req.param('id');
  const user = c.get('user')!;
  const body = await parseJson(c, z.object({ comment: z.string().trim().min(1).max(4000) }));

  const article = await c.env.DB.prepare(`SELECT id FROM kb_articles WHERE id = ? AND deleted_at IS NULL`)
    .bind(articleId)
    .first();
  if (!article) throw ApiError.notFound('Article');

  const id = newId();
  await c.env.DB.prepare(`INSERT INTO kb_comments (id, article_id, user_id, comment, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, articleId, user.id, body.comment, now())
    .run();
  await audit(c, 'kb.comment_added', 'kb_article', articleId, { commentId: id });

  const row = await c.env.DB.prepare(
    `SELECT cm.*, u.full_name AS user_name, u.avatar_url AS user_avatar
     FROM kb_comments cm LEFT JOIN users u ON u.id = cm.user_id WHERE cm.id = ?`,
  )
    .bind(id)
    .first();
  return created(c, row);
});

kbRoutes.delete('/:id/comments/:commentId', async (c) => {
  const user = c.get('user')!;
  const comment = await c.env.DB.prepare(`SELECT user_id FROM kb_comments WHERE id = ?`)
    .bind(c.req.param('commentId'))
    .first<{ user_id: string }>();
  if (!comment) throw ApiError.notFound('Comment');
  if (comment.user_id !== user.id && user.role !== 'admin') throw ApiError.forbidden();
  await c.env.DB.prepare(`DELETE FROM kb_comments WHERE id = ?`).bind(c.req.param('commentId')).run();
  return ok(c, { success: true });
});

kbRoutes.put('/:id/rating', async (c) => {
  const articleId = c.req.param('id');
  const user = c.get('user')!;
  const body = await parseJson(c, z.object({ rating: z.coerce.number().int().min(1).max(5) }));

  const article = await c.env.DB.prepare(`SELECT id FROM kb_articles WHERE id = ? AND deleted_at IS NULL`)
    .bind(articleId)
    .first();
  if (!article) throw ApiError.notFound('Article');

  await c.env.DB.prepare(
    `INSERT INTO kb_ratings (id, article_id, user_id, rating, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (article_id, user_id) DO UPDATE SET rating = excluded.rating`,
  )
    .bind(newId(), articleId, user.id, body.rating, now())
    .run();

  const summary = await c.env.DB.prepare(
    `SELECT ROUND(AVG(rating), 2) AS rating, COUNT(*) AS rating_count FROM kb_ratings WHERE article_id = ?`,
  )
    .bind(articleId)
    .first();
  return ok(c, { ...summary, userRating: body.rating });
});

kbRoutes.get('/:id/rating', async (c) => {
  const articleId = c.req.param('id');
  const user = c.get('user')!;
  const [summary, mine] = await Promise.all([
    c.env.DB.prepare(`SELECT ROUND(AVG(rating), 2) AS rating, COUNT(*) AS rating_count FROM kb_ratings WHERE article_id = ?`)
      .bind(articleId)
      .first(),
    c.env.DB.prepare(`SELECT rating FROM kb_ratings WHERE article_id = ? AND user_id = ?`)
      .bind(articleId, user.id)
      .first<{ rating: number }>(),
  ]);
  return ok(c, { ...summary, userRating: mine?.rating ?? null });
});
