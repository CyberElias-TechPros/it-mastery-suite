import type { Context } from 'hono';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  RATE_LIMIT: KVNamespace;
  UPLOADS: R2Bucket;

  /** Secrets */
  JWT_SECRET: string;
  /** Optional secrets — transactional email (password resets, alerts). */
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;

  /** Vars */
  ENVIRONMENT: 'development' | 'preview' | 'production' | string;
  ALLOWED_ORIGINS: string;
  ACCESS_TOKEN_TTL_SECONDS: string;
  REFRESH_TOKEN_TTL_SECONDS: string;
  MAX_UPLOAD_BYTES: string;
  BOOTSTRAP_ADMIN: string;
  /** Public URL of the frontend, used to build links inside emails. */
  APP_URL?: string;
}

export type Role = 'admin' | 'technician' | 'employee';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  full_name: string | null;
}

export interface Variables {
  requestId: string;
  user?: AuthUser;
}

export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export type AppEnv = { Bindings: Env; Variables: Variables };
