import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, DollarSign, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileUpload } from '@/components/FileUpload';
import { AttachmentList } from '@/components/AttachmentList';
import { api, errorMessage } from '@/lib/api';

interface Option {
  id: string;
  name: string;
}

const NONE = 'none';
const CATEGORIES = [
  'Repairs',
  'Purchases',
  'Licenses',
  'Renewals',
  'Maintenance',
  'Diesel',
  'Travel',
  'Training',
  'Software',
  'Hardware',
  'Other',
];

export default function NewExpense() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // The expense must exist before a receipt can be attached to it.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    category: CATEGORIES[0],
    expenseDate: new Date().toISOString().slice(0, 10),
    vendorId: NONE,
    branchId: NONE,
    departmentId: NONE,
    notes: '',
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors-lookup'],
    queryFn: () => api.getPage<Option[]>('/vendors', { pageSize: 100 }),
  });
  const { data: branches = [] } = useQuery({ queryKey: ['branches-lookup'], queryFn: () => api.get<Option[]>('/branches') });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: () => api.get<Option[]>('/departments'),
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<{ id: string }>('/expenses', payload),
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
      setCreatedId(expense.id);
      toast({ title: 'Expense submitted', description: 'Attach a receipt below, or go back to the list.' });
    },
    onError: (error) => toast({ title: 'Could not submit the expense', description: errorMessage(error), variant: 'destructive' }),
  });

  const setField = (field: keyof typeof formData) => (value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (formData.expenseDate > new Date().toISOString().slice(0, 10)) {
      toast({ title: 'Check the date', description: 'The expense date cannot be in the future.', variant: 'destructive' });
      return;
    }
    mutation.mutate({
      title: formData.title.trim(),
      description: formData.description || undefined,
      amount: Number(formData.amount),
      expenseDate: formData.expenseDate,
      category: formData.category,
      vendorId: formData.vendorId === NONE ? undefined : formData.vendorId,
      branchId: formData.branchId === NONE ? undefined : formData.branchId,
      departmentId: formData.departmentId === NONE ? undefined : formData.departmentId,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/expenses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to expenses
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New expense</h1>
          <p className="text-muted-foreground">Submit spending for approval</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Expense details
            </CardTitle>
            <CardDescription>Submitted expenses start as pending until an administrator decides.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(event) => setField('title')(event.target.value)}
                required
                minLength={3}
                disabled={Boolean(createdId)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(event) => setField('amount')(event.target.value)}
                required
                disabled={Boolean(createdId)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expenseDate">Expense date *</Label>
              <Input
                id="expenseDate"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={formData.expenseDate}
                onChange={(event) => setField('expenseDate')(event.target.value)}
                required
                disabled={Boolean(createdId)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={setField('category')} disabled={Boolean(createdId)}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Select value={formData.vendorId} onValueChange={setField('vendorId')} disabled={Boolean(createdId)}>
                <SelectTrigger id="vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No vendor</SelectItem>
                  {(vendors?.data ?? []).map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select value={formData.branchId} onValueChange={setField('branchId')} disabled={Boolean(createdId)}>
                <SelectTrigger id="branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={formData.departmentId} onValueChange={setField('departmentId')} disabled={Boolean(createdId)}>
                <SelectTrigger id="department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(event) => setField('description')(event.target.value)}
                disabled={Boolean(createdId)}
              />
            </div>
            <div className="flex gap-3 md:col-span-2">
              <Button type="submit" disabled={mutation.isPending || Boolean(createdId)}>
                <Save className="mr-2 h-4 w-4" />
                {mutation.isPending ? 'Submitting…' : 'Submit expense'}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/expenses">{createdId ? 'Done' : 'Cancel'}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {createdId ? (
        <Card>
          <CardHeader>
            <CardTitle>Receipt</CardTitle>
            <CardDescription>Attach a photo or PDF of the receipt so approvers can verify the claim.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AttachmentList resourceType="expense" resourceId={createdId} />
            <FileUpload
              resourceType="expense"
              resourceId={createdId}
              onFileUploaded={() => queryClient.invalidateQueries({ queryKey: ['attachments', 'expense', createdId] })}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
