import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, Clock, CheckCircle2, AlertTriangle, TrendingUp, Wrench, Package, DollarSign, AlertCircle, Fuel, Calendar, Zap, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const { profile } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      try {
        // Get all stats from different endpoints
        const [ticketStats, assetStats, expenseStats, dieselLogs, events, vendors, kbArticles] = await Promise.all([
          apiClient.getTicketStats(),
          apiClient.getAssetStats(),
          apiClient.getExpenseStats(),
          apiClient.getDieselLogs(),
          apiClient.getCalendarEvents({
            start: new Date().toISOString().split('T')[0] + 'T00:00:00',
            end: new Date().toISOString().split('T')[0] + 'T23:59:59'
          }),
          apiClient.getVendors(),
          apiClient.getKBArticles({ limit: 10 })
        ]);

        // Calculate additional stats
        const latestDiesel = dieselLogs.logs?.[0] || {};
        const expiringContracts = vendors.vendors?.filter(v =>
          v.contract_end_date &&
          new Date(v.contract_end_date) > new Date() &&
          new Date(v.contract_end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ).length || 0;

        const totalKBViews = kbArticles.articles?.reduce((sum, article) => sum + (article.view_count || 0), 0) || 0;

        return {
          // Ticket stats
          totalTickets: ticketStats.stats.total_tickets || 0,
          openTickets: ticketStats.stats.open_tickets || 0,
          inProgress: ticketStats.stats.in_progress || 0,
          resolved: ticketStats.stats.resolved || 0,
          highPriority: ticketStats.stats.high_priority || 0,
          overdueTickets: ticketStats.stats.overdue || 0,

          // Asset stats
          totalAssets: assetStats.stats.total_assets || 0,
          activeAssets: assetStats.stats.active_assets || 0,
          maintenanceAssets: assetStats.stats.maintenance_assets || 0,
          disposedAssets: assetStats.stats.disposed_assets || 0,

          // Financial stats
          monthlyExpenditure: expenseStats.stats.total_amount || 0,
          pendingExpenses: expenseStats.stats.total_amount || 0,
          pendingExpenseCount: expenseStats.stats.pending_approval || 0,

          // Diesel stats
          latestDieselConsumption: latestDiesel.consumed_stock || 0,
          dieselCost: (latestDiesel.consumed_stock || 0) * (latestDiesel.cost_per_liter || 0),

          // Other stats
          todayEvents: events.events?.length || 0,
          expiringContracts,
          kbActivity: totalKBViews,
        };
      } catch (error) {
        console.error('Dashboard stats error:', error);
        // Return default values on error
        return {
          totalTickets: 0, openTickets: 0, inProgress: 0, resolved: 0, highPriority: 0, overdueTickets: 0,
          totalAssets: 0, activeAssets: 0, maintenanceAssets: 0, disposedAssets: 0,
          monthlyExpenditure: 0, pendingExpenses: 0, pendingExpenseCount: 0,
          latestDieselConsumption: 0, dieselCost: 0,
          todayEvents: 0, expiringContracts: 0, kbActivity: 0,
        };
      }
    },
  });

  const { data: recentTickets } = useQuery({
    queryKey: ["recent-tickets"],
    queryFn: async () => {
      try {
        const response = await apiClient.getTickets({ limit: 5, page: 1 });
        return response.tickets || [];
      } catch (error) {
        console.error('Recent tickets error:', error);
        return [];
      }
    },
  });

  const statCards = [
    {
      title: "Open Tickets",
      value: stats?.openTickets || 0,
      icon: Ticket,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "In Progress",
      value: stats?.inProgress || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950",
    },
    {
      title: "Overdue Tickets",
      value: stats?.overdueTickets || 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
    {
      title: "Active Assets",
      value: stats?.activeAssets || 0,
      icon: Package,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Assets in Maintenance",
      value: stats?.maintenanceAssets || 0,
      icon: Wrench,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      title: "Monthly Expenditure",
      value: `$${(stats?.monthlyExpenditure || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Pending Approvals",
      value: stats?.pendingExpenseCount || 0,
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      title: "Diesel Consumption",
      value: `${stats?.latestDieselConsumption || 0}L`,
      icon: Fuel,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950",
    },
    {
      title: "Today's Events",
      value: stats?.todayEvents || 0,
      icon: Calendar,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
    },
    {
      title: "Expiring Contracts",
      value: stats?.expiringContracts || 0,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
    {
      title: "KB Article Views",
      value: stats?.kbActivity || 0,
      icon: BookOpen,
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-950",
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      default:
        return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500";
      case "in_progress":
        return "bg-warning";
      case "resolved":
        return "bg-success";
      case "closed":
        return "bg-muted";
      default:
        return "bg-secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-10 w-10 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {profile?.full_name || "User"}!
          </p>
        </div>
        <Link to="/tickets/new">
          <Button>
            <Ticket className="mr-2 h-4 w-4" />
            New Ticket
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.value === 1 ? "ticket" : "tickets"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* SLA Compliance and System Health */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              SLA Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Compliance</span>
                <span className="font-medium">
                  {stats ? Math.round(((stats.totalTickets - (stats.overdueTickets || 0)) / Math.max(stats.totalTickets, 1)) * 100) : 0}%
                </span>
              </div>
              <Progress
                value={stats ? ((stats.totalTickets - (stats.overdueTickets || 0)) / Math.max(stats.totalTickets, 1)) * 100 : 0}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {stats?.overdueTickets || 0} tickets are currently overdue
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">Healthy</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">API Response</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">Good</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage</span>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">75% Used</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Tickets</CardTitle>
            <Link to="/tickets">
              <Button variant="ghost" size="sm">
                View All
                <TrendingUp className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!recentTickets || recentTickets.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No tickets yet. Create your first ticket to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {recentTickets.map((ticket: any) => (
                <Link key={ticket.id} to={`/tickets/${ticket.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(ticket.status)}`} />
                      <div>
                        <p className="font-medium">{ticket.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {ticket.ticket_number} • Created by {ticket.created_by_profile?.full_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getPriorityColor(ticket.priority) as any}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
