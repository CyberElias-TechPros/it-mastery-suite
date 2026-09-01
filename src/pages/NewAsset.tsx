import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api, errorMessage } from '@/lib/api';

interface Option {
  id: string;
  name: string;
}

interface AssignableUser {
  id: string;
  full_name: string | null;
}

const NONE = 'none';

const CATEGORIES = ['laptop', 'desktop', 'server', 'printer', 'network', 'mobile', 'other'];

export default function NewAsset() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    assetTag: '',
    name: '',
    category: 'laptop',
    model: '',
    serialNumber: '',
    status: 'active',
    purchaseDate: '',
    purchaseCost: '',
    warrantyExpiry: '',
    location: '',
    departmentId: NONE,
    branchId: NONE,
    assignedTo: NONE,
    description: '',
    notes: '',
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: () => api.get<Option[]>('/departments'),
  });
  const { data: branches = [] } = useQuery({ queryKey: ['branches-lookup'], queryFn: () => api.get<Option[]>('/branches') });
  const { data: people = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: () => api.get<AssignableUser[]>('/users/assignable'),
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/assets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
      toast({ title: 'Asset registered' });
      navigate('/assets');
    },
    onError: (error) => toast({ title: 'Could not save the asset', description: errorMessage(error), variant: 'destructive' }),
  });

  const setField = (field: keyof typeof formData) => (value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (formData.warrantyExpiry && formData.purchaseDate && formData.warrantyExpiry < formData.purchaseDate) {
      toast({
        title: 'Check the dates',
        description: 'Warranty expiry cannot be before the purchase date.',
        variant: 'destructive',
      });
      return;
    }
    mutation.mutate({
      assetTag: formData.assetTag.trim(),
      name: formData.name.trim(),
      category: formData.category,
      model: formData.model || undefined,
      serialNumber: formData.serialNumber || undefined,
      status: formData.status,
      purchaseDate: formData.purchaseDate || undefined,
      purchaseCost: formData.purchaseCost ? Number(formData.purchaseCost) : undefined,
      warrantyExpiry: formData.warrantyExpiry || undefined,
      location: formData.location || undefined,
      departmentId: formData.departmentId === NONE ? undefined : formData.departmentId,
      branchId: formData.branchId === NONE ? undefined : formData.branchId,
      assignedTo: formData.assignedTo === NONE ? undefined : formData.assignedTo,
      description: formData.description || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/assets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to assets
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New asset</h1>
          <p className="text-muted-foreground">Add equipment to the register</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Asset details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assetTag">Asset tag *</Label>
              <Input
                id="assetTag"
                placeholder="AST-0001"
                value={formData.assetTag}
                onChange={(event) => setField('assetTag')(event.target.value)}
                pattern="[A-Za-z0-9._\-]+"
                title="Letters, numbers, dots, underscores and dashes only"
                required
              />
              <p className="text-xs text-muted-foreground">Must be unique across the register.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={formData.name} onChange={(event) => setField('name')(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={setField('category')}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category} className="capitalize">
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={setField('status')}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" value={formData.model} onChange={(event) => setField('model')(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial">Serial number</Label>
              <Input id="serial" value={formData.serialNumber} onChange={(event) => setField('serialNumber')(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase date</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={formData.purchaseDate}
                onChange={(event) => setField('purchaseDate')(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseCost">Purchase cost</Label>
              <Input
                id="purchaseCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.purchaseCost}
                onChange={(event) => setField('purchaseCost')(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warranty">Warranty expiry</Label>
              <Input
                id="warranty"
                type="date"
                value={formData.warrantyExpiry}
                onChange={(event) => setField('warrantyExpiry')(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={formData.location} onChange={(event) => setField('location')(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select value={formData.branchId} onValueChange={setField('branchId')}>
                <SelectTrigger id="branch">
                  <SelectValue placeholder="Select a branch" />
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
              <Select value={formData.departmentId} onValueChange={setField('departmentId')}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select a department" />
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
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned to</Label>
              <Select value={formData.assignedTo} onValueChange={setField('assignedTo')}>
                <SelectTrigger id="assignedTo">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.full_name ?? 'Unnamed'}
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
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={formData.notes} onChange={(event) => setField('notes')(event.target.value)} />
            </div>
            <div className="flex gap-3 md:col-span-2">
              <Button type="submit" disabled={mutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {mutation.isPending ? 'Saving…' : 'Save asset'}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/assets">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
