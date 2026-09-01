import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, KeyRound, Plus, Search, Shield, ShieldCheck, Trash2, UserCheck, UserX, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { DataPagination } from '@/components/DataPagination';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface DirectoryUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'technician' | 'employee';
  phone: string | null;
  department: string | null;
  is_active: boolean | number;
  branch_id: string | null;
  department_id: string | null;
  branch_name: string | null;
  department_name: string | null;
  created_at: string;
}

interface UserStats {
  totalUsers: number;
  admins: number;
  technicians: number;
  employees: number;
  assignedUsers: number;
  unassignedUsers: number;
  activeUsers: number;
}

interface Option {
  id: string;
  name: string;
}

const NONE = 'none';
const PAGE_SIZE = 20;

const ROLE_BADGE = {
  admin: { variant: 'destructive' as const, icon: ShieldCheck },
  technician: { variant: 'default' as const, icon: Shield },
  employee: { variant: 'secondary' as const, icon: UserCheck },
};

function initials(name: string | null) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Users() {
  const { isAdmin, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DirectoryUser | null>(null);
  const [resetting, setResetting] = useState<DirectoryUser | null>(null);
  const [deleting, setDeleting] = useState<DirectoryUser | null>(null);
  const search = useDebounce(searchTerm);

  useEffect(() => setPage(1), [search, roleFilter, branchFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter, branchFilter, page],
    queryFn: () =>
      api.getPage<DirectoryUser[]>('/users', {
        search,
        role: roleFilter === 'all' ? undefined : roleFilter,
        branchId: branchFilter === 'all' ? undefined : branchFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({ queryKey: ['user-stats'], queryFn: () => api.get<UserStats>('/users/stats') });
  const { data: branches = [] } = useQuery({ queryKey: ['branches-lookup'], queryFn: () => api.get<Option[]>('/branches') });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: () => api.get<Option[]>('/departments'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['user-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/users', payload),
    onSuccess: () => {
      invalidate();
      setCreating(false);
      toast({ title: 'User created' });
    },
    onError: (error) => toast({ title: 'Could not create user', description: errorMessage(error), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) => api.put(`/users/${id}`, updates),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast({ title: 'User updated' });
    },
    onError: (error) => toast({ title: 'Update failed', description: errorMessage(error), variant: 'destructive' }),
  });

  const passwordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) => api.post(`/users/${id}/password`, { newPassword }),
    onSuccess: () => {
      setResetting(null);
      toast({ title: 'Password reset', description: 'All of their sessions were signed out.' });
    },
    onError: (error) => toast({ title: 'Reset failed', description: errorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/users/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ title: 'User removed', description: 'Their history is preserved for auditing.' });
    },
    onError: (error) => toast({ title: 'Delete failed', description: errorMessage(error), variant: 'destructive' }),
  });

  const users = data?.data ?? [];

  const statCards = [
    { title: 'Total users', value: stats?.totalUsers ?? 0, icon: UsersIcon, caption: 'Registered accounts' },
    { title: 'Admins', value: stats?.admins ?? 0, icon: ShieldCheck, caption: 'System administrators' },
    { title: 'Technicians', value: stats?.technicians ?? 0, icon: Shield, caption: 'IT support staff' },
    { title: 'Employees', value: stats?.employees ?? 0, icon: UserCheck, caption: 'Regular users' },
    { title: 'With a branch', value: stats?.assignedUsers ?? 0, icon: Building, caption: 'Assigned to a location' },
    { title: 'Unassigned', value: stats?.unassignedUsers ?? 0, icon: UserX, caption: 'No branch yet' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">User management</h1>
          <p className="text-muted-foreground">Manage accounts, roles and access</p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add user
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{card.caption}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
                aria-label="Search users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger aria-label="Filter by role">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger aria-label="Filter by branch">
                <SelectValue placeholder="Filter by branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No users match these filters.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const badge = ROLE_BADGE[user.role] ?? ROLE_BADGE.employee;
                      const RoleIcon = badge.icon;
                      const active = Boolean(user.is_active);
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.full_name ?? 'Unnamed user'}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant} className="capitalize">
                              <RoleIcon className="mr-1 h-3 w-3" />
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.branch_name ? (
                              <Badge variant="outline">{user.branch_name}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{user.department_name ?? user.department ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Active' : 'Disabled'}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                          {isAdmin ? (
                            <TableCell className="space-x-1 text-right">
                              <Button variant="ghost" size="sm" onClick={() => setEditing(user)}>
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setResetting(user)} aria-label="Reset password">
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              {user.id !== profile?.id ? (
                                <Button variant="ghost" size="sm" onClick={() => setDeleting(user)} aria-label="Remove user">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              ) : null}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={data?.meta} page={page} onPageChange={setPage} noun="users" />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>They can sign in immediately with the password you set here.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              createMutation.mutate({
                email: String(form.get('email')),
                password: String(form.get('password')),
                fullName: String(form.get('fullName')),
                role: String(form.get('role')),
                phone: String(form.get('phone') ?? '') || undefined,
                branchId: form.get('branchId') === NONE ? undefined : String(form.get('branchId')),
                departmentId: form.get('departmentId') === NONE ? undefined : String(form.get('departmentId')),
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-name">Full name</Label>
              <Input id="new-name" name="fullName" required minLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Temporary password</Label>
              <Input id="new-password" name="password" type="password" required minLength={10} />
              <p className="text-xs text-muted-foreground">At least 10 characters, including letters and numbers.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">Role</Label>
              <Select name="role" defaultValue="employee">
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone">Phone</Label>
              <Input id="new-phone" name="phone" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-branch">Branch</Label>
                <Select name="branchId" defaultValue={NONE}>
                  <SelectTrigger id="new-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-department">Department</Label>
                <Select name="departmentId" defaultValue={NONE}>
                  <SelectTrigger id="new-department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.full_name ?? editing?.email}</DialogTitle>
            <DialogDescription>Role changes sign the user out of every device.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                updateMutation.mutate({
                  id: editing.id,
                  updates: {
                    fullName: String(form.get('fullName')),
                    role: String(form.get('role')),
                    phone: String(form.get('phone') ?? '') || null,
                    branchId: form.get('branchId') === NONE ? null : String(form.get('branchId')),
                    departmentId: form.get('departmentId') === NONE ? null : String(form.get('departmentId')),
                    isActive: form.get('isActive') === 'on',
                  },
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full name</Label>
                <Input id="edit-name" name="fullName" defaultValue={editing.full_name ?? ''} required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select name="role" defaultValue={editing.role}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" name="phone" defaultValue={editing.phone ?? ''} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-branch">Branch</Label>
                  <Select name="branchId" defaultValue={editing.branch_id ?? NONE}>
                    <SelectTrigger id="edit-branch">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Department</Label>
                  <Select name="departmentId" defaultValue={editing.department_id ?? NONE}>
                    <SelectTrigger id="edit-department">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded border p-3">
                <div>
                  <Label htmlFor="edit-active">Account active</Label>
                  <p className="text-xs text-muted-foreground">Disabling revokes their sessions immediately.</p>
                </div>
                <Switch id="edit-active" name="isActive" defaultChecked={Boolean(editing.is_active)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Password reset */}
      <Dialog open={Boolean(resetting)} onOpenChange={(open) => !open && setResetting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetting?.full_name ?? resetting?.email}. They will be signed out everywhere.
            </DialogDescription>
          </DialogHeader>
          {resetting ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                passwordMutation.mutate({ id: resetting.id, newPassword: String(form.get('newPassword')) });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="reset-new-password">New password</Label>
                <Input id="reset-new-password" name="newPassword" type="password" required minLength={10} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetting(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={passwordMutation.isPending}>
                  Reset password
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.full_name ?? deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              The account is deactivated and anonymised for sign-in, but their tickets and audit history remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
