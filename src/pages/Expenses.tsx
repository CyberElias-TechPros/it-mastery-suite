import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, DollarSign, TrendingUp, TrendingDown, Calendar, Building, Users } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Expenses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", searchTerm, categoryFilter, statusFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select(`
          *,
          recorded_by_profile:profiles!expenses_recorded_by_fkey(full_name),
          approved_by_profile:profiles!expenses_approved_by_fkey(full_name),
          vendor:vendors(name),
          branch:branches(name),
          department:departments(name)
        `)
        .order("expense_date", { ascending: false });

      // Apply filters
      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      if (statusFilter === "approved") {
        query = query.not("approved_at", "is", null);
      } else if (statusFilter === "pending") {
        query = query.is("approved_at", null);
      }

      if (dateFilter !== "all") {
        const now = new Date();
        let startDate;

        switch (dateFilter) {
          case "this_month":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case "last_month":
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            break;
          case "this_quarter":
            const quarterStart = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), quarterStart, 1);
            break;
          case "this_year":
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          query = query.gte("expense_date", startDate.toISOString());
        }
      }

      if (searchTerm) {
        query = query.or(
          `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: expenseStats } = useQuery({
    queryKey: ["expense-stats"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Monthly expenses
      const { data: monthlyExpenses } = await supabase
        .from("expenses")
        .select("amount")
        .gte("expense_date", startOfMonth.toISOString());

      // Yearly expenses
      const { data: yearlyExpenses } = await supabase
        .from("expenses")
        .select("amount")
        .gte("expense_date", startOfYear.toISOString());

      // Pending approvals
      const { data: pendingExpenses } = await supabase
        .from("expenses")
        .select("amount")
        .is("approved_at", null);

      const monthlyTotal = monthlyExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
      const yearlyTotal = yearlyExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
      const pendingTotal = pendingExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      return {
        monthlyTotal,
        yearlyTotal,
        pendingTotal,
        approvedCount: (monthlyExpenses?.length || 0) - (pendingExpenses?.length || 0),
        pendingCount: pendingExpenses?.length || 0,
      };
    },
  });

  const { data: categoryBreakdown } = useQuery({
    queryKey: ["expense-category-breakdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("category, amount")
        .not("category", "is", null);

      if (error) throw error;

      // Group by category
      const categoryMap = new Map<string, number>();
      data?.forEach(expense => {
        const current = categoryMap.get(expense.category) || 0;
        categoryMap.set(expense.category, current + (expense.amount || 0));
      });

      return Array.from(categoryMap.entries()).map(([category, amount]) => ({
        category,
        amount,
      }));
    },
  });

  const getStatusBadge = (expense: any) => {
    if (expense.approved_at) {
      return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "$0.00";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const expenseCategories = [
    "Repairs",
    "Purchases",
    "Licenses",
    "Renewals",
    "Maintenance",
    "Diesel",
    "Travel",
    "Training",
    "Software",
    "Hardware",
    "Other"
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Management</h1>
          <p className="text-muted-foreground">Track expenses, budgets, and financial analytics</p>
        </div>
        <Link to="/expenses/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(expenseStats?.monthlyTotal)}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yearly Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(expenseStats?.yearlyTotal)}</div>
            <p className="text-xs text-muted-foreground">
              This year
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(expenseStats?.pendingTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {expenseStats?.pendingCount || 0} expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved This Month</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenseStats?.approvedCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Expenses approved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {categoryBreakdown?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="amount" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {expenseCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading expenses...</div>
          ) : !expenses || expenses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No expenses found. Add your first expense to get started!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{expense.title}</p>
                          {expense.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {expense.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(expense.expense_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(expense)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          {expense.branch && (
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {expense.branch.name}
                            </div>
                          )}
                          {expense.department && (
                            <div className="flex items-center gap-1 ml-2">
                              <Users className="h-3 w-3" />
                              {expense.department.name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{expense.recorded_by_profile?.full_name}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link to={`/expenses/${expense.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          {!expense.approved_at && (
                            <Button variant="ghost" size="sm">
                              Approve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}