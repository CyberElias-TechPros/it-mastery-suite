import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api, errorMessage } from '@/lib/api';

const SERVICE_TYPES = ['Hardware', 'Software', 'Networking', 'Maintenance', 'Consulting', 'Facilities', 'Other'];
const NO_RATING = 'none';

export default function NewVendor() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    serviceType: SERVICE_TYPES[0],
    rating: NO_RATING,
    contractStartDate: '',
    contractEndDate: '',
    contractValue: '',
    paymentTerms: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/vendors', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-service-types'] });
      toast({ title: 'Vendor created' });
      navigate('/vendors');
    },
    onError: (error) => toast({ title: 'Could not save the vendor', description: errorMessage(error), variant: 'destructive' }),
  });

  const setField = (field: keyof typeof formData) => (value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (formData.contractEndDate && formData.contractStartDate && formData.contractEndDate < formData.contractStartDate) {
      toast({
        title: 'Check the contract dates',
        description: 'The end date cannot be before the start date.',
        variant: 'destructive',
      });
      return;
    }
    mutation.mutate({
      name: formData.name.trim(),
      contactPerson: formData.contactPerson || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      website: formData.website || undefined,
      serviceType: formData.serviceType || undefined,
      rating: formData.rating === NO_RATING ? undefined : Number(formData.rating),
      contractStartDate: formData.contractStartDate || undefined,
      contractEndDate: formData.contractEndDate || undefined,
      contractValue: formData.contractValue ? Number(formData.contractValue) : undefined,
      paymentTerms: formData.paymentTerms || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/vendors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to vendors
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New vendor</h1>
          <p className="text-muted-foreground">Register a supplier and its contract</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Vendor details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Vendor name *</Label>
              <Input id="name" value={formData.name} onChange={(event) => setField('name')(event.target.value)} required minLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceType">Service type</Label>
              <Select value={formData.serviceType} onValueChange={setField('serviceType')}>
                <SelectTrigger id="serviceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(event) => setField('contactPerson')(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(event) => setField('email')(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={formData.phone} onChange={(event) => setField('phone')(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={formData.website}
                onChange={(event) => setField('website')(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={formData.address} onChange={(event) => setField('address')(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rating">Rating</Label>
              <Select value={formData.rating} onValueChange={setField('rating')}>
                <SelectTrigger id="rating">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_RATING}>Not rated</SelectItem>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} star{value > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractValue">Contract value</Label>
              <Input
                id="contractValue"
                type="number"
                min="0"
                step="0.01"
                value={formData.contractValue}
                onChange={(event) => setField('contractValue')(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractStartDate">Contract start</Label>
              <Input
                id="contractStartDate"
                type="date"
                value={formData.contractStartDate}
                onChange={(event) => setField('contractStartDate')(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractEndDate">Contract end</Label>
              <Input
                id="contractEndDate"
                type="date"
                value={formData.contractEndDate}
                onChange={(event) => setField('contractEndDate')(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="paymentTerms">Payment terms</Label>
              <Input
                id="paymentTerms"
                placeholder="Net 30"
                value={formData.paymentTerms}
                onChange={(event) => setField('paymentTerms')(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={formData.notes} onChange={(event) => setField('notes')(event.target.value)} />
            </div>
            <div className="flex gap-3 md:col-span-2">
              <Button type="submit" disabled={mutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {mutation.isPending ? 'Saving…' : 'Save vendor'}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/vendors">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
