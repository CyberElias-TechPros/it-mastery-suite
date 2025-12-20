import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Building,
  Users,
  DollarSign,
  Package,
  MapPin,
  Phone,
  Plus,
  Search,
  Edit,
  Trash2
} from "lucide-react";

interface BranchWithMetrics {
  id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  budget?: number;
  manager?: { full_name: string; email: string } | null;
  departmentCount: number;
  assetCount: number;
  userCount: number;
  monthlySpent: number;
  budgetUtilization: number;
  remainingBudget: number;
}

export default function Branches() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches", searchTerm],
    queryFn: async () => {
      const { data: branchData, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");

      if (error) throw error;

      // Calculate additional metrics for each branch
      const branchesWithMetrics: BranchWithMetrics[] = await Promise.all(
        (branchData || []).map(async (branch: any) => {
          // Get department count
          const { count: deptCount } = await supabase
            .from("departments")
            .select("*", { count: "exact", head: true })
            .eq("branch_id", branch.id);

          // Get asset count
          const { count: assetCount } = await supabase
            .from("assets")
            .select("*", { count: "exact", head: true })
            .eq("branch_id", branch.id);

          // Get user count - profiles may not have branch_id yet
          const { count: userCount } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true });

          // Get monthly expenses
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          const { data: monthlyExpenses } = await supabase
            .from("expenses")
            .select("amount")
            .gte("expense_date", startOfMonth.toISOString().split('T')[0])
            .not("approved_at", "is", null);

          const monthlySpent = monthlyExpenses?.reduce((sum, exp: any) => sum + (exp.amount || 0), 0) || 0;
          const branchBudget = branch.budget || 0;
          const budgetUtilization = branchBudget > 0 ? (monthlySpent / branchBudget) * 100 : 0;

          // Get manager info if manager_id exists
          let manager = null;
          if (branch.manager_id) {
            const { data: managerData } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", branch.manager_id)
              .single();
            manager = managerData;
          }

          return {
            id: branch.id,
            name: branch.name,
            code: branch.code,
            address: branch.address,
            city: branch.city,
            country: branch.country,
            phone: branch.phone,
            budget: branchBudget,
            manager,
            departmentCount: deptCount || 0,
            assetCount: assetCount || 0,
            userCount: userCount || 0,
            monthlySpent,
            budgetUtilization,
            remainingBudget: branchBudget - monthlySpent,
          };
        })
      );

      // Filter by search term
      if (searchTerm) {
        return branchesWithMetrics.filter(branch => 
          branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          branch.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          branch.address?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return branchesWithMetrics;
    },
  });

  const { data: branchStats } = useQuery({
    queryKey: ["branch-stats"],
    queryFn: async () => {
      const { data: allBranches } = await supabase
        .from("branches")
        .select("*");

      const totalBudget = allBranches?.reduce((sum, branch: any) => sum + (branch.budget || 0), 0) || 0;

      const { count: totalDepartments } = await supabase
        .from("departments")
        .select("*", { count: "exact", head: true });

      const { count: totalAssets } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true });

      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      return {
        totalBranches: allBranches?.length || 0,
        totalBudget,
        totalDepartments: totalDepartments || 0,
        totalAssets: totalAssets || 0,
        totalUsers: totalUsers || 0,
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
    if (utilization >= 100) return { status: "Over Budget", color: "destructive" };
    if (utilization >= 80) return { status: "Near Limit", color: "secondary" };
    return { status: "On Track", color: "default" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branch Management</h1>
          <p className="text-muted-foreground">Manage company branches, departments, and locations</p>
        </div>
        <Link to="/branches/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Branch
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branchStats?.totalBranches || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(branchStats?.totalBudget || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Across all branches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branchStats?.totalDepartments || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total departments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branchStats?.totalAssets || 0}</div>
            <p className="text-xs text-muted-foreground">
              Assigned to branches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branchStats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total employees
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Branches Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : !branches || branches.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-8 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No branches found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? "Try adjusting your search" : "Create your first branch to get started"}
                </p>
                {!searchTerm && (
                  <Link to="/branches/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Branch
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          branches.map((branch) => {
            const budgetStatus = getBudgetStatus(branch.budgetUtilization);

            return (
              <Card key={branch.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {branch.name}
                      </CardTitle>
                      {branch.code && <Badge variant="outline">{branch.code}</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Location */}
                  {branch.address && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{branch.address}</span>
                    </div>
                  )}

                  {/* Contact */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {branch.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {branch.phone}
                      </div>
                    )}
                  </div>

                  {/* Manager */}
                  {branch.manager && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {branch.manager.full_name?.charAt(0) || "M"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{branch.manager.full_name} (Manager)</span>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{branch.departmentCount}</div>
                      <div className="text-xs text-muted-foreground">Departments</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">{branch.assetCount}</div>
                      <div className="text-xs text-muted-foreground">Assets</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">{branch.userCount}</div>
                      <div className="text-xs text-muted-foreground">Employees</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">{formatCurrency(branch.monthlySpent)}</div>
                      <div className="text-xs text-muted-foreground">This Month</div>
                    </div>
                  </div>

                  {/* Budget Progress */}
                  {branch.budget && branch.budget > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Monthly Budget</span>
                        <Badge variant={budgetStatus.color as any} className="text-xs">
                          {budgetStatus.status}
                        </Badge>
                      </div>
                      <Progress
                        value={Math.min(branch.budgetUtilization, 100)}
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(branch.monthlySpent)} spent</span>
                        <span>{formatCurrency(branch.remainingBudget)} remaining</span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Link to={`/branches/${branch.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </Link>
                    <Link to={`/branches/${branch.id}/departments`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Departments
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}