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
import { Switch } from "@/components/ui/switch";
import {
  Zap,
  Plus,
  Play,
  Pause,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Settings,
  ArrowRight,
  Users,
  FileText,
  Package,
  DollarSign,
  Fuel,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  conditions: any[];
  actions: any[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

interface RuleAction {
  type: string;
  config: any;
}

export default function AutomationRules() {
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    trigger_event: "",
    conditions: [] as RuleCondition[],
    actions: [] as RuleAction[],
    is_active: true,
  });
  const { toast } = useToast();

  const { data: rules, refetch } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AutomationRule[];
    },
  });

  const { data: ruleExecutions } = useQuery({
    queryKey: ["rule-executions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_executions" as any)
        .select(`
          *,
          rule:automation_rules(name)
        `)
        .order("executed_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
  });

  const triggerEvents = [
    { value: "ticket_created", label: "Ticket Created", icon: FileText },
    { value: "ticket_updated", label: "Ticket Updated", icon: FileText },
    { value: "asset_registered", label: "Asset Registered", icon: Package },
    { value: "expense_added", label: "Expense Added", icon: DollarSign },
    { value: "diesel_low", label: "Diesel Level Low", icon: Fuel },
    { value: "contract_expiring", label: "Contract Expiring", icon: Calendar },
    { value: "user_registered", label: "User Registered", icon: Users },
  ];

  const conditionFields: Record<string, { value: string; label: string }[]> = {
    ticket_created: [
      { value: "priority", label: "Priority" },
      { value: "category", label: "Category" },
      { value: "title", label: "Title Contains" },
      { value: "description", label: "Description Contains" },
    ],
    ticket_updated: [
      { value: "status", label: "Status Changed To" },
      { value: "priority", label: "Priority Changed To" },
      { value: "assigned_to", label: "Assigned To" },
    ],
    asset_registered: [
      { value: "category", label: "Asset Category" },
      { value: "purchase_cost", label: "Purchase Price" },
      { value: "warranty_expiry", label: "Warranty Expiry" },
    ],
    expense_added: [
      { value: "amount", label: "Amount" },
      { value: "category", label: "Category" },
      { value: "vendor_id", label: "Vendor" },
    ],
    diesel_low: [
      { value: "branch_id", label: "Branch" },
      { value: "closing_stock", label: "Current Stock Level" },
    ],
    contract_expiring: [
      { value: "days_until_expiry", label: "Days Until Expiry" },
      { value: "service_type", label: "Service Type" },
    ],
    user_registered: [
      { value: "role", label: "User Role" },
      { value: "department", label: "Department" },
    ],
  };

  const actionTypes = [
    { value: "assign_technician", label: "Assign Technician", icon: Users },
    { value: "send_notification", label: "Send Notification", icon: AlertTriangle },
    { value: "escalate_ticket", label: "Escalate Ticket", icon: ArrowRight },
    { value: "update_status", label: "Update Status", icon: Settings },
    { value: "send_email", label: "Send Email", icon: FileText },
    { value: "create_task", label: "Create Follow-up Task", icon: CheckCircle },
  ];

  const operators = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not Equals" },
    { value: "contains", label: "Contains" },
    { value: "greater_than", label: "Greater Than" },
    { value: "less_than", label: "Less Than" },
    { value: "between", label: "Between" },
  ];

  const addCondition = () => {
    setRuleForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: "", operator: "equals", value: "" }]
    }));
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setRuleForm(prev => ({
      ...prev,
      conditions: prev.conditions.map((cond, i) =>
        i === index ? { ...cond, ...updates } : cond
      )
    }));
  };

  const removeCondition = (index: number) => {
    setRuleForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const addAction = () => {
    setRuleForm(prev => ({
      ...prev,
      actions: [...prev.actions, { type: "", config: {} }]
    }));
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    setRuleForm(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) =>
        i === index ? { ...action, ...updates } : action
      )
    }));
  };

  const removeAction = (index: number) => {
    setRuleForm(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const saveRule = async () => {
    if (!ruleForm.name || !ruleForm.trigger_event) {
      toast({
        title: "Validation Error",
        description: "Please fill in the rule name and trigger event",
        variant: "destructive",
      });
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      const ruleData = {
        name: ruleForm.name,
        description: ruleForm.description || null,
        trigger_event: ruleForm.trigger_event,
        conditions: ruleForm.conditions,
        actions: ruleForm.actions,
        is_active: ruleForm.is_active,
        created_by: user.data.user?.id,
      };

      const { error } = await supabase
        .from("automation_rules" as any)
        .insert(ruleData as any);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Automation rule created successfully",
      });

      setRuleForm({
        name: "",
        description: "",
        trigger_event: "",
        conditions: [],
        actions: [],
        is_active: true,
      });
      setIsRuleBuilderOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create rule",
        variant: "destructive",
      });
    }
  };

  const toggleRuleStatus = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("automation_rules" as any)
        .update({ is_active: isActive } as any)
        .eq("id", ruleId);

      if (error) throw error;
      refetch();
    } catch (error) {
      console.error("Error updating rule status:", error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from("automation_rules" as any)
        .delete()
        .eq("id", ruleId);

      if (error) throw error;
      refetch();
    } catch (error) {
      console.error("Error deleting rule:", error);
    }
  };

  const getTriggerIcon = (triggerEvent: string) => {
    const trigger = triggerEvents.find(t => t.value === triggerEvent);
    const Icon = trigger?.icon || Zap;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automation Rules</h1>
          <p className="text-muted-foreground">Create intelligent workflows with IF-THEN automation</p>
        </div>
        <Dialog open={isRuleBuilderOpen} onOpenChange={setIsRuleBuilderOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Rule Builder</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Rule Name *</Label>
                  <Input
                    id="rule-name"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Auto-assign high priority tickets"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trigger-event">Trigger Event *</Label>
                  <Select
                    value={ruleForm.trigger_event}
                    onValueChange={(value) => setRuleForm(prev => ({ ...prev, trigger_event: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger event" />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerEvents.map((event) => (
                        <SelectItem key={event.value} value={event.value}>
                          <div className="flex items-center gap-2">
                            <event.icon className="h-4 w-4" />
                            {event.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-description">Description</Label>
                <Input
                  id="rule-description"
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this rule does"
                />
              </div>

              {/* Conditions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Conditions (IF)
                    <Button onClick={addCondition} size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Condition
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ruleForm.conditions.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No conditions set. This rule will trigger on every matching event.
                      </p>
                    ) : (
                      ruleForm.conditions.map((condition, index) => (
                        <div key={index} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label>Field</Label>
                            <Select
                              value={condition.field}
                              onValueChange={(value) => updateCondition(index, { field: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                {conditionFields[ruleForm.trigger_event]?.map((field) => (
                                  <SelectItem key={field.value} value={field.value}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Label>Operator</Label>
                            <Select
                              value={condition.operator}
                              onValueChange={(value) => updateCondition(index, { operator: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {operators.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Label>Value</Label>
                            <Input
                              value={condition.value}
                              onChange={(e) => updateCondition(index, { value: e.target.value })}
                              placeholder="Enter value"
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeCondition(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Actions (THEN)
                    <Button onClick={addAction} size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Action
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ruleForm.actions.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No actions defined. Add actions to specify what happens when conditions are met.
                      </p>
                    ) : (
                      ruleForm.actions.map((action, index) => (
                        <div key={index} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label>Action Type</Label>
                            <Select
                              value={action.type}
                              onValueChange={(value) => updateAction(index, { type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select action" />
                              </SelectTrigger>
                              <SelectContent>
                                {actionTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex items-center gap-2">
                                      <type.icon className="h-4 w-4" />
                                      {type.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Label>Configuration</Label>
                            <Input
                              placeholder="Action-specific configuration"
                              value={typeof action.config === 'object' ? JSON.stringify(action.config) : ''}
                              onChange={(e) => {
                                try {
                                  const config = JSON.parse(e.target.value || '{}');
                                  updateAction(index, { config });
                                } catch {
                                  // Invalid JSON, keep as-is
                                }
                              }}
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeAction(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={ruleForm.is_active}
                  onCheckedChange={(checked) => setRuleForm(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Rule is active</Label>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsRuleBuilderOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveRule}>
                  Save Rule
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Rules */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rules?.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Automation Rules</h3>
              <p className="text-muted-foreground mb-4">
                Create your first automation rule to streamline workflows
              </p>
              <Button onClick={() => setIsRuleBuilderOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules?.map((rule) => (
            <Card key={rule.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {getTriggerIcon(rule.trigger_event)}
                      {rule.name}
                    </CardTitle>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    )}
                  </div>
                  <Badge variant={rule.is_active ? "default" : "secondary"}>
                    {rule.is_active ? (
                      <>
                        <Play className="mr-1 h-3 w-3" />
                        Active
                      </>
                    ) : (
                      <>
                        <Pause className="mr-1 h-3 w-3" />
                        Paused
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium">Trigger:</span>
                    {triggerEvents.find(t => t.value === rule.trigger_event)?.label || rule.trigger_event}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <span className="font-medium">Conditions:</span>
                    {Array.isArray(rule.conditions) ? rule.conditions.length : 0} condition(s)
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <span className="font-medium">Actions:</span>
                    {Array.isArray(rule.actions) ? rule.actions.length : 0} action(s)
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => toggleRuleStatus(rule.id, checked)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {rule.is_active ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Executions */}
      {ruleExecutions && ruleExecutions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ruleExecutions.map((execution: any) => (
                <div 
                  key={execution.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {execution.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : execution.status === 'failed' ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">{execution.rule?.name || 'Unknown Rule'}</p>
                      <p className="text-sm text-muted-foreground">
                        {execution.executed_at ? format(new Date(execution.executed_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    execution.status === 'success' ? 'default' : 
                    execution.status === 'failed' ? 'destructive' : 
                    'secondary'
                  }>
                    {execution.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
