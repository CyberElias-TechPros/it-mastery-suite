import type { Role } from '../types';

export interface UserRow {
  id: string;
  email: string;
  email_lower: string;
  password_hash: string;
  full_name: string | null;
  role: Role;
  phone: string | null;
  department: string | null;
  department_id: string | null;
  branch_id: string | null;
  avatar_url: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  phone: string | null;
  department: string | null;
  department_id: string | null;
  branch_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Projection that strips password hashes and internal columns. */
export function publicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    phone: row.phone,
    department: row.department,
    department_id: row.department_id,
    branch_id: row.branch_id,
    avatar_url: row.avatar_url,
    is_active: row.is_active === 1,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Columns safe to select for user listings and joins. */
export const USER_PUBLIC_COLUMNS = `id, email, full_name, role, phone, department, department_id, branch_id, avatar_url, is_active, last_login_at, created_at, updated_at`;
