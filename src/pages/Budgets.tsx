import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building, DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export default function Budgets() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: budgets, isLoading } = useQuery({
    queryKey: ["budgets", selectedYear],
    queryFn: async () => {
      // Get branches with budgets
      const { data: branches, error: branchesError } = await supabase
        .from("branches")
        .select("*")
        .not("budget", "is", null);

      if (branchesError) throw branchesError;

      // Get departments with budgets
      const { data: departments, error: deptsError } = await supabase
        .from("departments")
        .select(`
          *,
          branch:branches(name)
        `)
        .not("budget", "is", null);

      if (deptsError) throw deptsError;

      // Get expense data for the selected year
      const startOfYear = new Date(selectedYear, 0, 1);
      const endOfYear = new Date(selectedYear, 11, 31);

      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select(`
          amount,
          branch_id,
          department_id,
          expense_date
        `)
        .gte("expense_date", startOfYear.toISOString())
        .lte("expense_date", endOfYear.toISOString())
        .not("approved_at", "is", null); // Only approved expenses

      if (expensesError) throw expensesError;

      // Calculate spending by branch and department
      const branchSpending = new Map<string, number>();
      const departmentSpending = new Map<string, number>();

      expenses?.forEach(expense => {
        if (expense.branch_id) {
          const current = branchSpending.get(expense.branch_id) || 0;
          branchSpending.set(expense.branch_id, current + (expense.amount || 0));
        }
        if (expense.department_id) {
          const current = departmentSpending.get(expense.department_id) || 0;
          departmentSpending.set(expense.department_id, current + (expense.amount || 0));
        }
      });

      return {
        branches: branches?.map(branch => ({
          ...branch,
          spent: branchSpending.get(branch.id) || 0,
          remaining: (branch.budget || 0) - (branchSpending.get(branch.id) || 0),
          utilization: ((branchSpending.get(branch.id) || 0) / (branch.budget || 1)) * 100,
        })) || [],
        departments: departments?.map(dept => ({
          ...dept,
          spent: departmentSpending.get(dept.id) || 0,
          remaining: (dept.budget || 0) - (departmentSpending.get(dept.id) || 0),
          utilization: ((departmentSpending.get(dept.id) || 0) / (dept.budget || 1)) * 100,
        })) || [],
      };
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getBudgetStatus = (utilization: number) => {
    if (utilization >= 100) return { status: "over", color: "destructive", icon: AlertTriangle };
    if (utilization >= 80) return { status: "warning", color: "warning", icon: AlertTriangle };
    return { status: "good", color: "success", icon: CheckCircle };
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading budgets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget Management</h1>
          <p className="text-muted-foreground">Track spending against budgets by branch and department</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="year-select">Year:</Label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md bg-background"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                (budgets?.branches?.reduce((sum, b) => sum + (b.budget || 0), 0) || 0) +
                (budgets?.departments?.reduce((sum, d) => sum + (d.budget || 0), 0) || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all branches & departments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                (budgets?.branches?.reduce((sum, b) => sum + b.spent, 0) || 0) +
                (budgets?.departments?.reduce((sum, d) => sum + d.spent, 0) || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Approved expenses in {selectedYear}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Budget</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                (budgets?.branches?.reduce((sum, b) => sum + b.remaining, 0) || 0) +
                (budgets?.departments?.reduce((sum, d) => sum + d.remaining, 0) || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for spending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Utilization</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                ((budgets?.branches?.reduce((sum, b) => sum + b.utilization, 0) || 0) +
                 (budgets?.departments?.reduce((sum, d) => sum + d.utilization, 0) || 0)) /
                ((budgets?.branches?.length || 0) + (budgets?.departments?.length || 0) || 1)
              )}%
            </div>
            <p className="text-xs text-muted-foreground">
              Budget utilization rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Branch Budgets */}
      <Card>
        <CardHeader>
          <CardTitle>Branch Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {budgets?.branches?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No branch budgets configured
              </p>
            ) : (
              budgets?.branches?.map((branch) => {
                const budgetStatus = getBudgetStatus(branch.utilization);
                const StatusIcon = budgetStatus.icon;

                return (
                  <div key={branch.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        <h3 className="font-semibold">{branch.name}</h3>
                        <Badge variant={budgetStatus.color as any}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {budgetStatus.status === "over" ? "Over Budget" :
                           budgetStatus.status === "warning" ? "Near Limit" : "On Track"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatCurrency(branch.spent)} / {formatCurrency(branch.budget || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(branch.remaining)} remaining
                        </p>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(branch.utilization, 100)}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {branch.utilization.toFixed(1)}% utilized
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Department Budgets */}
      <Card>
        <CardHeader>
          <CardTitle>Department Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {budgets?.departments?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No department budgets configured
              </p>
            ) : (
              budgets?.departments?.map((dept) => {
                const budgetStatus = getBudgetStatus(dept.utilization);
                const StatusIcon = budgetStatus.icon;

                return (
                  <div key={dept.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{dept.name}</h3>
                        <Badge variant="outline">{dept.branch?.name}</Badge>
                        <Badge variant={budgetStatus.color as any}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {budgetStatus.status === "over" ? "Over Budget" :
                           budgetStatus.status === "warning" ? "Near Limit" : "On Track"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatCurrency(dept.spent)} / {formatCurrency(dept.budget || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(dept.remaining)} remaining
                        </p>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(dept.utilization, 100)}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {dept.utilization.toFixed(1)}% utilized
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget Alerts */}
      {(budgets?.branches?.some(b => b.utilization >= 80) ||
        budgets?.departments?.some(d => d.utilization >= 80)) && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-5 w-5" />
              Budget Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budgets?.branches?.filter(b => b.utilization >= 80).map(branch => (
                <p key={branch.id} className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ <strong>{branch.name}</strong> is at {branch.utilization.toFixed(1)}% of budget
                </p>
              ))}
              {budgets?.departments?.filter(d => d.utilization >= 80).map(dept => (
                <p key={dept.id} className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ <strong>{dept.name}</strong> ({dept.branch?.name}) is at {dept.utilization.toFixed(1)}% of budget
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}