import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  BarChart3,
  Download,
  Save,
  Play,
  Plus,
  Filter,
  Calendar,
  Users,
  Package,
  DollarSign,
  Fuel,
  Building,
  Settings,
  Eye
} from "lucide-react";
import { format } from "date-fns";

interface ReportField {
  id: string;
  name: string;
  type: string;
  module: string;
  table: string;
}

interface ReportFilter {
  field: string;
  operator: string;
  value: string;
}

export default function Reports() {
  const [selectedFields, setSelectedFields] = useState<ReportField[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [reportName, setReportName] = useState("");
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const { data: savedReports } = useQuery({
    queryKey: ["saved-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const availableFields: ReportField[] = [
    // Tickets
    { id: "ticket_number", name: "Ticket Number", type: "string", module: "Tickets", table: "tickets" },
    { id: "ticket_title", name: "Ticket Title", type: "string", module: "Tickets", table: "tickets" },
    { id: "ticket_status", name: "Status", type: "string", module: "Tickets", table: "tickets" },
    { id: "ticket_priority", name: "Priority", type: "string", module: "Tickets", table: "tickets" },
    { id: "ticket_category", name: "Category", type: "string", module: "Tickets", table: "tickets" },
    { id: "created_by_name", name: "Created By", type: "string", module: "Tickets", table: "profiles" },
    { id: "assigned_to_name", name: "Assigned To", type: "string", module: "Tickets", table: "profiles" },
    { id: "ticket_created_at", name: "Created Date", type: "date", module: "Tickets", table: "tickets" },

    // Assets
    { id: "asset_tag", name: "Asset Tag", type: "string", module: "Assets", table: "assets" },
    { id: "asset_name", name: "Asset Name", type: "string", module: "Assets", table: "assets" },
    { id: "asset_type", name: "Asset Type", type: "string", module: "Assets", table: "assets" },
    { id: "asset_status", name: "Asset Status", type: "string", module: "Assets", table: "assets" },
    { id: "purchase_price", name: "Purchase Price", type: "number", module: "Assets", table: "assets" },
    { id: "warranty_expiry", name: "Warranty Expiry", type: "date", module: "Assets", table: "assets" },
    { id: "assigned_to_name", name: "Assigned To", type: "string", module: "Assets", table: "profiles" },

    // Expenses
    { id: "expense_title", name: "Expense Title", type: "string", module: "Expenses", table: "expenses" },
    { id: "expense_amount", name: "Amount", type: "number", module: "Expenses", table: "expenses" },
    { id: "expense_category", name: "Category", type: "string", module: "Expenses", table: "expenses" },
    { id: "expense_date", name: "Expense Date", type: "date", module: "Expenses", table: "expenses" },
    { id: "recorded_by_name", name: "Recorded By", type: "string", module: "Expenses", table: "profiles" },
    { id: "approved_by_name", name: "Approved By", type: "string", module: "Expenses", table: "profiles" },

    // Diesel Logs
    { id: "generator_id", name: "Generator ID", type: "string", module: "Diesel", table: "diesel_logs" },
    { id: "diesel_date", name: "Date", type: "date", module: "Diesel", table: "diesel_logs" },
    { id: "consumed_stock", name: "Consumed (L)", type: "number", module: "Diesel", table: "diesel_logs" },
    { id: "running_hours", name: "Running Hours", type: "number", module: "Diesel", table: "diesel_logs" },
    { id: "total_cost", name: "Total Cost", type: "number", module: "Diesel", table: "diesel_logs" },

    // Users
    { id: "user_name", name: "Full Name", type: "string", module: "Users", table: "profiles" },
    { id: "user_email", name: "Email", type: "string", module: "Users", table: "profiles" },
    { id: "user_role", name: "Role", type: "string", module: "Users", table: "profiles" },
    { id: "branch_name", name: "Branch", type: "string", module: "Users", table: "branches" },
    { id: "department_name", name: "Department", type: "string", module: "Users", table: "departments" },
  ];

  const addField = (field: ReportField) => {
    if (!selectedFields.find(f => f.id === field.id)) {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const removeField = (fieldId: string) => {
    setSelectedFields(selectedFields.filter(f => f.id !== fieldId));
  };

  const addFilter = () => {
    setFilters([...filters, { field: "", operator: "equals", value: "" }]);
  };

  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const generateReport = async () => {
    if (selectedFields.length === 0) return;

    // This is a simplified version - in a real implementation,
    // you'd build complex SQL queries based on the selected fields and filters
    try {
      // For demo purposes, let's generate a sample report
      const sampleData = [
        {
          ticket_number: "TKT-000001",
          ticket_title: "Network connectivity issue",
          ticket_status: "resolved",
          ticket_priority: "high",
          asset_name: "Dell Laptop LT001",
          expense_amount: 250.00,
          user_name: "John Doe",
          branch_name: "Main Office"
        },
        {
          ticket_number: "TKT-000002",
          ticket_title: "Software installation",
          ticket_status: "in_progress",
          ticket_priority: "medium",
          asset_name: "HP Desktop DT002",
          expense_amount: 150.00,
          user_name: "Jane Smith",
          branch_name: "Branch Office"
        }
      ];

      setPreviewData(sampleData);
    } catch (error) {
      console.error("Error generating report:", error);
    }
  };

  const saveReport = async () => {
    if (!reportName.trim()) return;

    try {
      const { error } = await supabase
        .from("custom_reports")
        .insert({
          name: reportName,
          description: `Custom report with ${selectedFields.length} fields`,
          config: {
            fields: selectedFields,
            filters: filters
          } as any,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      setReportName("");
      setIsBuilderOpen(false);
      // Refresh saved reports
    } catch (error) {
      console.error("Error saving report:", error);
    }
  };

  const exportReport = (format: string) => {
    // In a real implementation, this would generate and download the file
    console.log(`Exporting report as ${format}`);
  };

  const getModuleIcon = (module: string) => {
    switch (module) {
      case "Tickets": return <FileText className="h-4 w-4" />;
      case "Assets": return <Package className="h-4 w-4" />;
      case "Expenses": return <DollarSign className="h-4 w-4" />;
      case "Diesel": return <Fuel className="h-4 w-4" />;
      case "Users": return <Users className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Report Builder</h1>
          <p className="text-muted-foreground">Create custom reports with drag & drop fields and advanced filtering</p>
        </div>
        <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report Builder</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="fields" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="fields">Select Fields</TabsTrigger>
                <TabsTrigger value="filters">Apply Filters</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="save">Save Report</TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="space-y-4">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Available Fields */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Available Fields</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {availableFields.map((field) => (
                          <div
                            key={field.id}
                            className="flex items-center justify-between p-2 border rounded hover:bg-muted cursor-pointer"
                            onClick={() => addField(field)}
                          >
                            <div className="flex items-center gap-2">
                              {getModuleIcon(field.module)}
                              <span className="text-sm">{field.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {field.module}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Selected Fields */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Selected Fields ({selectedFields.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 min-h-96">
                        {selectedFields.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">
                            No fields selected. Click on fields from the left to add them.
                          </p>
                        ) : (
                          selectedFields.map((field) => (
                            <div
                              key={field.id}
                              className="flex items-center justify-between p-2 border rounded bg-muted"
                            >
                              <div className="flex items-center gap-2">
                                {getModuleIcon(field.module)}
                                <span className="text-sm">{field.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {field.module}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeField(field.id)}
                              >
                                ×
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="filters" className="space-y-4">
                <div className="space-y-4">
                  {filters.map((filter, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label>Field</Label>
                        <Select
                          value={filter.field}
                          onValueChange={(value) => updateFilter(index, { field: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedFields.map((field) => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label>Operator</Label>
                        <Select
                          value={filter.operator}
                          onValueChange={(value) => updateFilter(index, { operator: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="greater_than">Greater Than</SelectItem>
                            <SelectItem value="less_than">Less Than</SelectItem>
                            <SelectItem value="between">Between</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label>Value</Label>
                        <Input
                          value={filter.value}
                          onChange={(e) => updateFilter(index, { value: e.target.value })}
                          placeholder="Enter value"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFilter(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button onClick={addFilter} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Filter
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Report Preview</h3>
                  <Button onClick={generateReport} disabled={selectedFields.length === 0}>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Preview
                  </Button>
                </div>

                {previewData.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            {selectedFields.map((field) => (
                              <th key={field.id} className="px-4 py-2 text-left text-sm font-medium">
                                {field.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, index) => (
                            <tr key={index} className="border-t">
                              {selectedFields.map((field) => (
                                <td key={field.id} className="px-4 py-2 text-sm">
                                  {row[field.id] || "-"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Click "Generate Preview" to see sample data
                  </div>
                )}
              </TabsContent>

              <TabsContent value="save" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="report-name">Report Name</Label>
                    <Input
                      id="report-name"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="Enter report name"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveReport} disabled={!reportName.trim()}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Report
                    </Button>
                    <Button variant="outline" onClick={() => exportReport("pdf")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export as PDF
                    </Button>
                    <Button variant="outline" onClick={() => exportReport("csv")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export as CSV
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Saved Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedReports?.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No saved reports yet. Create your first custom report above.
              </div>
            ) : (
              savedReports?.map((report: any) => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      {report.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {report.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                      <span>Created {format(new Date(report.created_at), "MMM d, yyyy")}</span>
                      {report.last_run_at && (
                        <span>Last run {format(new Date(report.last_run_at), "MMM d, yyyy")}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}