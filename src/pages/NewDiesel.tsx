import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator, Fuel, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api, errorMessage } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/format';

interface Branch {
  id: string;
  name: string;
}

const NO_BRANCH = 'none';
const today = () => new Date().toISOString().slice(0, 10);

/** Hours between two HH:MM values, wrapping past midnight. */
function hoursBetween(start: string, stop: string): number {
  if (!start || !stop) return 0;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [stopHour, stopMinute] = stop.split(':').map(Number);
  if ([startHour, startMinute, stopHour, stopMinute].some(Number.isNaN)) return 0;
  let minutes = stopHour * 60 + stopMinute - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return Number((minutes / 60).toFixed(2));
}

export default function NewDiesel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    branchId: NO_BRANCH,
    generatorId: '',
    date: today(),
    openingStock: '',
    receivedStock: '0',
    closingStock: '',
    startTime: '',
    stopTime: '',
    costPerLiter: '',
    notes: '',
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-lookup'],
    queryFn: () => api.get<Branch[]>('/branches'),
  });

  // Consumption is derived, never typed in, so the books always balance.
  const derived = useMemo(() => {
    const opening = Number(formData.openingStock) || 0;
    const received = Number(formData.receivedStock) || 0;
    const closing = Number(formData.closingStock) || 0;
    const consumed = Number((opening + received - closing).toFixed(2));
    const runningHours = hoursBetween(formData.startTime, formData.stopTime);
    const costPerLiter = Number(formData.costPerLiter) || 0;
    return { consumed, runningHours, totalCost: Number((consumed * costPerLiter).toFixed(2)) };
  }, [formData]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/diesel', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diesel-logs'] });
      queryClient.invalidateQueries({ queryKey: ['diesel-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Diesel log recorded' });
      navigate('/diesel');
    },
    onError: (error) => toast({ title: 'Could not save the log', description: errorMessage(error), variant: 'destructive' }),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (derived.consumed < 0) {
      toast({
        title: 'Check the readings',
        description: 'Closing stock cannot exceed opening stock plus fuel received.',
        variant: 'destructive',
      });
      return;
    }
    mutation.mutate({
      date: formData.date,
      branchId: formData.branchId === NO_BRANCH ? undefined : formData.branchId,
      generatorId: formData.generatorId || undefined,
      openingStock: Number(formData.openingStock),
      receivedStock: Number(formData.receivedStock || 0),
      consumedStock: derived.consumed,
      closingStock: Number(formData.closingStock),
      runningHours: derived.runningHours || undefined,
      costPerLiter: formData.costPerLiter ? Number(formData.costPerLiter) : undefined,
      notes: formData.notes || undefined,
    });
  };

  const setField = (field: keyof typeof formData) => (value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/diesel">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to diesel logs
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New diesel log</h1>
          <p className="text-muted-foreground">Record a generator refuelling and run</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Readings
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                max={today()}
                value={formData.date}
                onChange={(event) => setField('date')(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select value={formData.branchId} onValueChange={setField('branchId')}>
                <SelectTrigger id="branch">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRANCH}>Not specified</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="generator">Generator ID</Label>
              <Input
                id="generator"
                value={formData.generatorId}
                placeholder="GEN-01"
                onChange={(event) => setField('generatorId')(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost per litre</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.costPerLiter}
                onChange={(event) => setField('costPerLiter')(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opening">Opening stock (L) *</Label>
              <Input
                id="opening"
                type="number"
                min="0"
                step="0.01"
                value={formData.openingStock}
                onChange={(event) => setField('openingStock')(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="received">Fuel received (L)</Label>
              <Input
                id="received"
                type="number"
                min="0"
                step="0.01"
                value={formData.receivedStock}
                onChange={(event) => setField('receivedStock')(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closing">Closing stock (L) *</Label>
              <Input
                id="closing"
                type="number"
                min="0"
                step="0.01"
                value={formData.closingStock}
                onChange={(event) => setField('closingStock')(event.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start time</Label>
                <Input id="start" type="time" value={formData.startTime} onChange={(event) => setField('startTime')(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stop">Stop time</Label>
                <Input id="stop" type="time" value={formData.stopTime} onChange={(event) => setField('stopTime')(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={formData.notes} onChange={(event) => setField('notes')(event.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculated
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Consumed</span>
              <span className={`font-medium ${derived.consumed < 0 ? 'text-destructive' : ''}`}>
                {formatNumber(derived.consumed, 2)} L
              </span>
            </div>
            <div className="flex justify-between">
              <span>Running hours</span>
              <span className="font-medium">{formatNumber(derived.runningHours, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total cost</span>
              <span className="font-medium">{formatCurrency(derived.totalCost)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Consumption is calculated as opening + received − closing, so the ledger always balances.
            </p>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {mutation.isPending ? 'Saving…' : 'Save log'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
