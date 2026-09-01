import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now } from '../lib/db';
import { audit } from '../lib/audit';
import { created, ok } from '../lib/response';
import { parseQuery } from '../lib/validation';
import { isStaff, requireAuth } from '../middleware/auth';
import type { AppEnv, AuthUser, Env } from '../types';

export const uploadRoutes = new Hono<AppEnv>();
uploadRoutes.use('*', requireAuth());

/**
 * Files live in R2, metadata lives in D1. Downloads are streamed through the
 * worker so that every read is authorised — the bucket itself stays private.
 */

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

const RESOURCE_TYPES = ['ticket', 'asset', 'expense', 'kb_article', 'user', 'purchase_order'] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

/** Confirms the caller may attach to / read attachments of the target record. */
async function assertResourceAccess(env: Env, user: AuthUser, type: ResourceType, id: string): Promise<void> {
  switch (type) {
    case 'ticket': {
      const row = await env.DB.prepare(`SELECT created_by, assigned_to FROM tickets WHERE id = ?`)
        .bind(id)
        .first<{ created_by: string; assigned_to: string | null }>();
      if (!row) throw ApiError.notFound('Ticket');
      if (!isStaff(user.role) && row.created_by !== user.id && row.assigned_to !== user.id) throw ApiError.forbidden();
      return;
    }
    case 'expense': {
      const row = await env.DB.prepare(`SELECT submitted_by FROM expenses WHERE id = ?`)
        .bind(id)
        .first<{ submitted_by: string }>();
      if (!row) throw ApiError.notFound('Expense');
      if (!isStaff(user.role) && row.submitted_by !== user.id) throw ApiError.forbidden();
      return;
    }
    case 'asset':
    case 'purchase_order':
    case 'kb_article': {
      if (!isStaff(user.role)) throw ApiError.forbidden();
      return;
    }
    case 'user': {
      if (user.id !== id && user.role !== 'admin') throw ApiError.forbidden();
      return;
    }
    default:
      throw ApiError.badRequest('Unsupported resource type');
  }
}

function sanitiseName(name: string): string {
  return name
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim() || 'file';
}

uploadRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  const maxBytes = Number.parseInt(c.env.MAX_UPLOAD_BYTES ?? '', 10) || 10 * 1024 * 1024;

  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw ApiError.unsupportedMedia('Upload must be sent as multipart/form-data');
  }
  const declaredLength = Number.parseInt(c.req.header('content-length') ?? '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes + 4096) {
    throw ApiError.tooLarge(`Files must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller`);
  }

  const form = await c.req.formData();
  const file = form.get('file') as unknown as File | null;
  const resourceType = String(form.get('resourceType') ?? '') as ResourceType;
  const resourceId = String(form.get('resourceId') ?? '');

  if (!file || typeof file === 'string' || typeof (file as Blob).stream !== 'function') {
    throw ApiError.badRequest('No file was supplied');
  }
  if (!RESOURCE_TYPES.includes(resourceType)) throw ApiError.badRequest('Unknown resource type');
  if (!resourceId) throw ApiError.badRequest('A resource id is required');
  if (file.size === 0) throw ApiError.badRequest('The file is empty');
  if (file.size > maxBytes) throw ApiError.tooLarge(`Files must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller`);
  if (!ALLOWED_MIME.has(file.type)) {
    throw ApiError.unsupportedMedia(`${file.type || 'This file type'} is not allowed`);
  }

  await assertResourceAccess(c.env, user, resourceType, resourceId);

  // The stored key never contains user-controlled path segments.
  const id = newId();
  const extension = EXTENSION_BY_MIME[file.type] ?? 'bin';
  const key = `${resourceType}/${resourceId}/${id}.${extension}`;
  const fileName = sanitiseName(file.name);

  await c.env.UPLOADS.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      // Force download rather than inline rendering — kills stored-XSS via SVG/HTML.
      contentDisposition: `attachment; filename="${fileName}"`,
    },
    customMetadata: { uploadedBy: user.id, resourceType, resourceId },
  });

  await c.env.DB.prepare(
    `INSERT INTO attachments (id, file_name, object_key, file_size, mime_type, resource_type, resource_id, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, fileName, key, file.size, file.type, resourceType, resourceId, user.id, now())
    .run();

  await audit(c, 'attachment.uploaded', resourceType, resourceId, { attachmentId: id, size: file.size });

  return created(c, {
    id,
    file_name: fileName,
    file_size: file.size,
    mime_type: file.type,
    resource_type: resourceType,
    resource_id: resourceId,
    uploaded_by: user.id,
    created_at: now(),
  });
});

uploadRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const q = parseQuery(
    c,
    z.object({ resourceType: z.enum(RESOURCE_TYPES), resourceId: z.string().min(1).max(64) }),
  );
  await assertResourceAccess(c.env, user, q.resourceType, q.resourceId);

  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.file_name, a.file_size, a.mime_type, a.resource_type, a.resource_id, a.created_at,
            u.full_name AS uploaded_by_name
     FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
     WHERE a.resource_type = ? AND a.resource_id = ? AND a.deleted_at IS NULL
     ORDER BY a.created_at DESC`,
  )
    .bind(q.resourceType, q.resourceId)
    .all();
  return ok(c, results ?? []);
});

uploadRoutes.get('/:id/download', async (c) => {
  const user = c.get('user')!;
  const row = await c.env.DB.prepare(`SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL`)
    .bind(c.req.param('id'))
    .first<{
      id: string;
      object_key: string;
      file_name: string;
      mime_type: string | null;
      resource_type: ResourceType;
      resource_id: string;
    }>();
  if (!row) throw ApiError.notFound('Attachment');
  await assertResourceAccess(c.env, user, row.resource_type, row.resource_id);

  const object = await c.env.UPLOADS.get(row.object_key);
  if (!object) throw ApiError.notFound('File');

  return new Response(object.body, {
    headers: {
      'content-type': row.mime_type ?? 'application/octet-stream',
      'content-disposition': `attachment; filename="${row.file_name}"`,
      'content-length': String(object.size),
      'cache-control': 'private, max-age=60',
      'x-content-type-options': 'nosniff',
    },
  });
});

uploadRoutes.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const row = await c.env.DB.prepare(`SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL`)
    .bind(c.req.param('id'))
    .first<{ id: string; object_key: string; uploaded_by: string | null; resource_type: string; resource_id: string }>();
  if (!row) throw ApiError.notFound('Attachment');
  if (row.uploaded_by !== user.id && user.role !== 'admin') throw ApiError.forbidden();

  await c.env.UPLOADS.delete(row.object_key).catch(() => undefined);
  await c.env.DB.prepare(`UPDATE attachments SET deleted_at = ? WHERE id = ?`).bind(now(), row.id).run();
  await audit(c, 'attachment.deleted', row.resource_type, row.resource_id, { attachmentId: row.id });
  return ok(c, { success: true });
});
