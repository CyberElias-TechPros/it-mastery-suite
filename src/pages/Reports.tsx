import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileBarChart, Play, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api, errorMessage, getAccessToken, API_BASE_URL } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface DatasetField {
  id: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
}

interface Dataset {
  id: string;
  label: string;
  fields: DatasetField[];
}

type Operator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';

interface Filter {
  field: string;
  operator: Operator;
  value: string;
}

interface ReportConfig {
  dataset: string;
  fields: string[];
  filters: { field: string; operator: Operator; value: string }[];
  sort?: { field: string; direction: 'asc' | 'desc' };
  limit: number;
}

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  config: string;
  created_by: string;
  created_by_name: string | null;
  last_run_at: string | null;
  created_at: string;
}

interface RunResult {
  columns: { id: string; label: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

const OPERATORS: { id: Operator; label: string }[] = [
  { id: 'eq', label: 'equals' },
  { id: 'neq', label: 'does not equal' },
  { id: 'contains', label: 'contains' },
  { id: 'gt', label: 'greater than' },
  { id: 'gte', label: 'at least' },
  { id: 'lt', label: 'less than' },
  { id: 'lte', label: 'at most' },
];

const NONE = 'none';

export default function Reports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dataset, setDataset] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sortField, setSortField] = useState(NONE);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState(200);
  const [result, setResult] = useState<RunResult | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  const { data: datasets = [] } = useQuery({
    queryKey: ['report-datasets'],
    queryFn: () => api.get<Dataset[]>('/reports/datasets'),
  });

  const { data: saved = [] } = useQuery({ queryKey: ['reports'], queryFn: () => api.get<SavedReport[]>('/reports') });

  const activeDataset = useMemo(() => datasets.find((item) => item.id === dataset), [datasets, dataset]);

  useEffect(() => {
    if (!dataset && datasets.length) setDataset(datasets[0].id);
  }, [datasets, dataset]);

  useEffect(() => {
    // Reset the builder whenever the dataset changes: fields are dataset-specific.
    if (!activeDataset) return;
    setFields(activeDataset.fields.slice(0, 5).map((field) => field.id));
    setFilters([]);
    setSortField(NONE);
    setResult(null);
  }, [activeDataset?.id]);

  const buildConfig = (): ReportConfig => ({
    dataset,
    fields,
    filters: filters.filter((filter) => filter.field && filter.value !== ''),
    ...(sortField !== NONE ? { sort: { field: sortField, direction: sortDirection } } : {}),
    limit,
  });

  const runReport = useMutation({
    mutationFn: () => api.post<RunResult>('/reports/run', buildConfig()),
    onSuccess: (data) => setResult(data),
    onError: (error) => toast({ title: 'The report failed to run', description: errorMessage(error), variant: 'destructive' }),
  });

  const saveReport = useMutation({
    mutationFn: (payload: { name: string; description: string | null }) =>
      api.post('/reports', { ...payload, config: buildConfig() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setSaveOpen(false);
      toast({ title: 'Report saved' });
    },
    onError: (error) => toast({ title: 'Could not save the report', description: errorMessage(error), variant: 'destructive' }),
  });

  const deleteReport = useMutation({
    mutationFn: (id: string) => api.del(`/reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({ title: 'Report deleted' });
    },
    onError: (error) => toast({ title: 'Could not delete the report', description: errorMessage(error), variant: 'destructive' }),
  });

  const runSaved = useMutation({
    mutationFn: (id: string) => api.get<RunResult>(`/reports/${id}/run`),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) => toast({ title: 'The report failed to run', description: errorMessage(error), variant: 'destructive' }),
  });

  /** CSV export streams a file, so it bypasses the JSON envelope helper. */
  const exportCsv = async (report: SavedReport) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/${report.id}/run?format=csv`, {
        headers: getAccessToken() ? { authorization: `Bearer ${getAccessToken()}` } : undefined,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('The export could not be generated');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Export failed', description: errorMessage(error), variant: 'destructive' });
    }
  };

  const toggleField = (id: string, checked: boolean) =>
    setFields((current) => (checked ? [...current, id] : current.filter((field) => field !== id)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Build, save and export reports across the datasets you can access</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Report builder</CardTitle>
            <CardDescription>Pick a dataset, choose columns and add filters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataset">Dataset</Label>
              <Select value={dataset} onValueChange={setDataset}>
                <SelectTrigger id="dataset">
                  <SelectValue placeholder="Choose a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeDataset ? (
              <div className="space-y-2">
                <Label>Columns</Label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                  {activeDataset.fields.map((field) => (
                    <label key={field.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={fields.includes(field.id)}
                        onCheckedChange={(checked) => toggleField(field.id, checked === true)}
                      />
                      {field.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{fields.length} of 20 columns selected</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Filters</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!activeDataset || filters.length >= 10}
                  onClick={() =>
                    setFilters((current) => [
                      ...current,
                      { field: activeDataset?.fields[0]?.id ?? '', operator: 'eq', value: '' },
                    ])
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              {filters.map((filter, index) => (
                <div key={index} className="space-y-2 rounded-md border p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Filter {index + 1}</span>
                    <button
                      type="button"
                      aria-label={`Remove filter ${index + 1}`}
                      onClick={() => setFilters((current) => current.filter((_, i) => i !== index))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <Select
                    value={filter.field}
                    onValueChange={(value) =>
                      setFilters((current) => current.map((item, i) => (i === index ? { ...item, field: value } : item)))
                    }
                  >
                    <SelectTrigger aria-label="Filter field">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDataset?.fields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filter.operator}
                    onValueChange={(value) =>
                      setFilters((current) =>
                        current.map((item, i) => (i === index ? { ...item, operator: value as Operator } : item)),
                      )
                    }
                  >
                    <SelectTrigger aria-label="Filter operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((operator) => (
                        <SelectItem key={operator.id} value={operator.id}>
                          {operator.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={filter.value}
                    placeholder="Value"
                    onChange={(event) =>
                      setFilters((current) =>
                        current.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sort-field">Sort by</Label>
                <Select value={sortField} onValueChange={setSortField}>
                  <SelectTrigger id="sort-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Default order</SelectItem>
                    {activeDataset?.fields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort-direction">Direction</Label>
                <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as 'asc' | 'desc')}>
                  <SelectTrigger id="sort-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="limit">Row limit</Label>
                <Input
                  id="limit"
                  type="number"
                  min={1}
                  max={1000}
                  value={limit}
                  onChange={(event) => setLimit(Math.min(1000, Math.max(1, Number(event.target.value) || 1)))}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => runReport.mutate()}
                disabled={!dataset || fields.length === 0 || runReport.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {runReport.isPending ? 'Running…' : 'Run'}
              </Button>
              <Button variant="outline" onClick={() => setSaveOpen(true)} disabled={!dataset || fields.length === 0}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Results</CardTitle>
              <CardDescription>{result ? `${result.rowCount} rows` : 'Run a report to see results'}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {result && result.rows.length > 0 ? (
                <div className="max-h-[520px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {result.columns.map((column) => (
                          <TableHead key={column.id}>{column.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.map((row, index) => (
                        <TableRow key={index}>
                          {result.columns.map((column) => (
                            <TableCell key={column.id}>
                              {row[column.id] === null || row[column.id] === undefined ? '—' : String(row[column.id])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="p-10 text-center text-muted-foreground">
                  {result ? 'No rows matched the filters.' : 'Nothing to show yet.'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileBarChart className="h-4 w-4" />
                Saved reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {saved.length === 0 ? (
                <p className="text-sm text-muted-foreground">You have not saved any reports yet.</p>
              ) : (
                saved.map((report) => (
                  <div key={report.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {report.description ? `${report.description} · ` : ''}
                        {report.last_run_at ? `last run ${formatDateTime(report.last_run_at)}` : 'never run'}
                      </p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        by {report.created_by_name ?? 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => runSaved.mutate(report.id)}>
                        <Play className="mr-1 h-3 w-3" />
                        Run
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportCsv(report)}>
                        <Download className="mr-1 h-3 w-3" />
                        CSV
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${report.name}`} onClick={() => deleteReport.mutate(report.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save report</DialogTitle>
            <DialogDescription>Saved reports keep their filters and can be exported as CSV later.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              saveReport.mutate({
                name: String(form.get('name')),
                description: String(form.get('description') ?? '') || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="report-name">Name</Label>
              <Input id="report-name" name="name" required minLength={3} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-description">Description</Label>
              <Textarea id="report-description" name="description" rows={3} maxLength={500} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveReport.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
