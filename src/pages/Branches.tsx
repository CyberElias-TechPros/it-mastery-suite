import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, DollarSign, MapPin, Package, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { api, errorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface Branch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  budget: number | null;
  manager_id: string | null;
  manager_name: string | null;
  user_count: number;
  department_count: number;
  asset_count: number;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
  branch_id: string | null;
  branch_name: string | null;
  manager_id: string | null;
  manager_name: string | null;
  budget: number | null;
  user_count: number;
}

interface Person {
  id: string;
  full_name: string | null;
}

const NONE = 'none';

export default function Branches() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [branchDialog, setBranchDialog] = useState<{ mode: 'create' | 'edit'; branch?: Branch } | null>(null);
  const [departmentDialog, setDepartmentDialog] = useState<{ mode: 'create' | 'edit'; department?: Department } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'branch' | 'department'; id: string; name: string } | null>(null);

  const { data: branches = [], isLoading } = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/departments') });
  const { data: managers = [] } = useQuery({ queryKey: ['assignable-users'], queryFn: () => api.get<Person[]>('/users/assignable') });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['branches'] });
    queryClient.invalidateQueries({ queryKey: ['branches-lookup'] });
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    queryClient.invalidateQueries({ queryKey: ['departments-lookup'] });
  };

  const saveBranch = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id ? api.put(`/branches/${id}`, payload) : api.post('/branches', payload),
    onSuccess: () => {
      invalidate();
      setBranchDialog(null);
      toast({ title: 'Branch saved' });
    },
    onError: (error) => toast({ title: 'Could not save the branch', description: errorMessage(error), variant: 'destructive' }),
  });

  const saveDepartment = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id ? api.put(`/departments/${id}`, payload) : api.post('/departments', payload),
    onSuccess: () => {
      invalidate();
      setDepartmentDialog(null);
      toast({ title: 'Department saved' });
    },
    onError: (error) => toast({ title: 'Could not save the department', description: errorMessage(error), variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: ({ kind, id }: { kind: 'branch' | 'department'; id: string }) =>
      api.del(kind === 'branch' ? `/branches/${id}` : `/departments/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ title: 'Removed' });
    },
    onError: (error) => toast({ title: 'Could not remove', description: errorMessage(error), variant: 'destructive' }),
  });

  const term = searchTerm.trim().toLowerCase();
  const visibleBranches = term
    ? branches.filter((branch) =>
        [branch.name, branch.code, branch.city, branch.country].some((value) => value?.toLowerCase().includes(term)),
      )
    : branches;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Organisation</h1>
          <p className="text-muted-foreground">Branches, departments and their allocations</p>
        </div>
      </div>

      <Tabs defaultValue="branches">
        <TabsList>
          <TabsTrigger value="branches">Branches ({branches.length})</TabsTrigger>
          <TabsTrigger value="departments">Departments ({departments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search branches"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
                aria-label="Search branches"
              />
            </div>
            {isAdmin ? (
              <Button onClick={() => setBranchDialog({ mode: 'create' })}>
                <Plus className="mr-2 h-4 w-4" />
                Add branch
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <p className="p-8 text-center text-muted-foreground">Loading branches…</p>
          ) : visibleBranches.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">No branches yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleBranches.map((branch) => (
                <Card key={branch.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Building className="h-4 w-4" />
                          {branch.name}
                        </CardTitle>
                        {branch.code ? <CardDescription>{branch.code}</CardDescription> : null}
                      </div>
                      {isAdmin ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setBranchDialog({ mode: 'edit', branch })}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${branch.name}`}
                            onClick={() => setDeleting({ kind: 'branch', id: branch.id, name: branch.name })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {branch.city || branch.country ? (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[branch.city, branch.country].filter(Boolean).join(', ')}
                      </p>
                    ) : null}
                    {branch.phone ? (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {branch.phone}
                      </p>
                    ) : null}
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      Budget {formatCurrency(branch.budget)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        <Users className="mr-1 h-3 w-3" />
                        {branch.user_count} people
                      </Badge>
                      <Badge variant="outline">
                        <Building className="mr-1 h-3 w-3" />
                        {branch.department_count} departments
                      </Badge>
                      <Badge variant="outline">
                        <Package className="mr-1 h-3 w-3" />
                        {branch.asset_count} assets
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Manager: {branch.manager_name ?? 'Not assigned'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <div className="flex justify-end">
            {isAdmin ? (
              <Button onClick={() => setDepartmentDialog({ mode: 'create' })}>
                <Plus className="mr-2 h-4 w-4" />
                Add department
              </Button>
            ) : null}
          </div>
          {departments.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">No departments yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {departments.map((department) => (
                <Card key={department.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{department.name}</CardTitle>
                        <CardDescription>{department.branch_name ?? 'No branch'}</CardDescription>
                      </div>
                      {isAdmin ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDepartmentDialog({ mode: 'edit', department })}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${department.name}`}
                            onClick={() => setDeleting({ kind: 'department', id: department.id, name: department.name })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {department.code ? <p className="text-muted-foreground">{department.code}</p> : null}
                    <p className="text-muted-foreground">Budget {formatCurrency(department.budget)}</p>
                    <Badge variant="outline">
                      <Users className="mr-1 h-3 w-3" />
                      {department.user_count} people
                    </Badge>
                    <p className="text-xs text-muted-foreground">Manager: {department.manager_name ?? 'Not assigned'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Branch dialog */}
      <Dialog open={Boolean(branchDialog)} onOpenChange={(open) => !open && setBranchDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{branchDialog?.mode === 'edit' ? 'Edit branch' : 'Add branch'}</DialogTitle>
            <DialogDescription>Branch budgets drive the utilisation figures on the Budgets page.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              saveBranch.mutate({
                id: branchDialog?.branch?.id,
                payload: {
                  name: String(form.get('name')),
                  code: String(form.get('code') ?? '') || null,
                  address: String(form.get('address') ?? '') || null,
                  city: String(form.get('city') ?? '') || null,
                  country: String(form.get('country') ?? '') || null,
                  phone: String(form.get('phone') ?? '') || null,
                  budget: form.get('budget') ? Number(form.get('budget')) : 0,
                  managerId: form.get('managerId') === NONE ? null : String(form.get('managerId')),
                },
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="branch-name">Name</Label>
                <Input id="branch-name" name="name" defaultValue={branchDialog?.branch?.name ?? ''} required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-code">Code</Label>
                <Input id="branch-code" name="code" defaultValue={branchDialog?.branch?.code ?? ''} pattern="[A-Za-z0-9_\-]*" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="branch-address">Address</Label>
                <Input id="branch-address" name="address" defaultValue={branchDialog?.branch?.address ?? ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-city">City</Label>
                <Input id="branch-city" name="city" defaultValue={branchDialog?.branch?.city ?? ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-country">Country</Label>
                <Input id="branch-country" name="country" defaultValue={branchDialog?.branch?.country ?? ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-phone">Phone</Label>
                <Input id="branch-phone" name="phone" defaultValue={branchDialog?.branch?.phone ?? ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-budget">Annual budget</Label>
                <Input
                  id="branch-budget"
                  name="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={branchDialog?.branch?.budget ?? 0}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="branch-manager">Manager</Label>
                <Select name="managerId" defaultValue={branchDialog?.branch?.manager_id ?? NONE}>
                  <SelectTrigger id="branch-manager">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not assigned</SelectItem>
                    {managers.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.full_name ?? 'Unnamed'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBranchDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveBranch.isPending}>
                Save branch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Department dialog */}
      <Dialog open={Boolean(departmentDialog)} onOpenChange={(open) => !open && setDepartmentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{departmentDialog?.mode === 'edit' ? 'Edit department' : 'Add department'}</DialogTitle>
            <DialogDescription>Departments can carry their own budget for finer reporting.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              saveDepartment.mutate({
                id: departmentDialog?.department?.id,
                payload: {
                  name: String(form.get('name')),
                  code: String(form.get('code') ?? '') || null,
                  branchId: form.get('branchId') === NONE ? null : String(form.get('branchId')),
                  managerId: form.get('managerId') === NONE ? null : String(form.get('managerId')),
                  budget: form.get('budget') ? Number(form.get('budget')) : 0,
                },
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="dept-name">Name</Label>
              <Input id="dept-name" name="name" defaultValue={departmentDialog?.department?.name ?? ''} required minLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-code">Code</Label>
              <Input id="dept-code" name="code" defaultValue={departmentDialog?.department?.code ?? ''} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dept-branch">Branch</Label>
                <Select name="branchId" defaultValue={departmentDialog?.department?.branch_id ?? NONE}>
                  <SelectTrigger id="dept-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not assigned</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-budget">Annual budget</Label>
                <Input
                  id="dept-budget"
                  name="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={departmentDialog?.department?.budget ?? 0}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="dept-manager">Manager</Label>
                <Select name="managerId" defaultValue={departmentDialog?.department?.manager_id ?? NONE}>
                  <SelectTrigger id="dept-manager">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not assigned</SelectItem>
                    {managers.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.full_name ?? 'Unnamed'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDepartmentDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveDepartment.isPending}>
                Save department
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Records that still have people, assets or departments attached cannot be removed until those are reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && removeMutation.mutate({ kind: deleting.kind, id: deleting.id })}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
