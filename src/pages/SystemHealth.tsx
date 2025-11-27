import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Server,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { format } from "date-fns";

interface HealthMetric {
  id: string;
  metric_name: string;
  metric_value: string | null;
  status: "healthy" | "warning" | "critical";
  recorded_at: string;
}

export default function SystemHealth() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: healthMetrics, refetch } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      // In a real implementation, this would fetch actual system metrics
      // For demo purposes, we'll simulate some metrics
      const mockMetrics: HealthMetric[] = [
        {
          id: "1",
          metric_name: "Server Uptime",
          metric_value: "99.9%",
          status: "healthy",
          recorded_at: new Date().toISOString()
        },
        {
          id: "2",
          metric_name: "Database Connections",
          metric_value: "45/100",
          status: "healthy",
          recorded_at: new Date().toISOString()
        },
        {
          id: "3",
          metric_name: "CPU Usage",
          metric_value: "67%",
          status: "warning",
          recorded_at: new Date().toISOString()
        },
        {
          id: "4",
          metric_name: "Memory Usage",
          metric_value: "78%",
          status: "warning",
          recorded_at: new Date().toISOString()
        },
        {
          id: "5",
          metric_name: "Disk Usage",
          metric_value: "45%",
          status: "healthy",
          recorded_at: new Date().toISOString()
        },
        {
          id: "6",
          metric_name: "API Response Time",
          metric_value: "245ms",
          status: "healthy",
          recorded_at: new Date().toISOString()
        },
        {
          id: "7",
          metric_name: "Failed Login Attempts",
          metric_value: "3",
          status: "warning",
          recorded_at: new Date().toISOString()
        },
        {
          id: "8",
          metric_name: "Active Sessions",
          metric_value: "127",
          status: "healthy",
          recorded_at: new Date().toISOString()
        }
      ];

      return mockMetrics;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: recentAlerts } = useQuery({
    queryKey: ["system-alerts"],
    queryFn: async () => {
      // Mock alerts data
      return [
        {
          id: "1",
          type: "warning",
          message: "High CPU usage detected on server",
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          resolved: false
        },
        {
          id: "2",
          type: "critical",
          message: "Database connection pool exhausted",
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          resolved: true
        },
        {
          id: "3",
          type: "info",
          message: "Scheduled backup completed successfully",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          resolved: true
        }
      ];
    },
  });

  const { data: performanceData } = useQuery({
    queryKey: ["performance-data"],
    queryFn: async () => {
      // Mock performance data for charts
      return {
        responseTimes: [
          { time: "00:00", value: 120 },
          { time: "04:00", value: 135 },
          { time: "08:00", value: 245 },
          { time: "12:00", value: 180 },
          { time: "16:00", value: 160 },
          { time: "20:00", value: 140 }
        ],
        cpuUsage: [
          { time: "00:00", value: 45 },
          { time: "04:00", value: 52 },
          { time: "08:00", value: 67 },
          { time: "12:00", value: 58 },
          { time: "16:00", value: 61 },
          { time: "20:00", value: 55 }
        ],
        memoryUsage: [
          { time: "00:00", value: 62 },
          { time: "04:00", value: 68 },
          { time: "08:00", value: 78 },
          { time: "12:00", value: 72 },
          { time: "16:00", value: 75 },
          { time: "20:00", value: 69 }
        ]
      };
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "critical":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      healthy: "default",
      warning: "secondary",
      critical: "destructive"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "info":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const overallHealth = healthMetrics?.reduce((acc, metric) => {
    if (metric.status === "critical") return "critical";
    if (metric.status === "warning" && acc !== "critical") return "warning";
    return acc;
  }, "healthy" as string) || "healthy";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health Monitoring</h1>
          <p className="text-muted-foreground">Real-time system metrics and performance monitoring</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Overall Health Status */}
      <Card className={`border-2 ${
        overallHealth === "healthy" ? "border-green-200 bg-green-50/50" :
        overallHealth === "warning" ? "border-yellow-200 bg-yellow-50/50" :
        "border-red-200 bg-red-50/50"
      }`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {getStatusIcon(overallHealth)}
              <div>
                <h2 className="text-2xl font-bold">System Status: {
                  overallHealth.charAt(0).toUpperCase() + overallHealth.slice(1)
                }</h2>
                <p className="text-muted-foreground">
                  Last updated: {format(new Date(), "MMM d, yyyy 'at' h:mm:ss a")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Uptime</div>
              <div className="text-lg font-semibold">99.9%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {healthMetrics?.map((metric) => (
          <Card key={metric.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.metric_name}</CardTitle>
              {getStatusIcon(metric.status)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.metric_value}</div>
              <div className="flex items-center justify-between mt-2">
                {getStatusBadge(metric.status)}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(metric.recorded_at), "HH:mm")}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Charts */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              API Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {performanceData?.responseTimes.map((point, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{point.time}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={(point.value / 300) * 100} className="w-16 h-2" />
                    <span className="text-sm font-medium">{point.value}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              CPU Usage (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {performanceData?.cpuUsage.map((point, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{point.time}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={point.value} className="w-16 h-2" />
                    <span className="text-sm font-medium">{point.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Memory Usage (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {performanceData?.memoryUsage.map((point, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{point.time}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={point.value} className="w-16 h-2" />
                    <span className="text-sm font-medium">{point.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent System Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentAlerts?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No recent alerts. System is running smoothly.
              </p>
            ) : (
              recentAlerts?.map((alert: any) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <p className="font-medium">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(alert.timestamp), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      {alert.resolved && (
                        <Badge variant="outline" className="text-xs">
                          Resolved
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Services Status */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Web Server</p>
                <p className="text-sm text-muted-foreground">Running</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Database</p>
                <p className="text-sm text-muted-foreground">Running</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium">Cache Service</p>
                <p className="text-sm text-muted-foreground">Degraded</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Email Service</p>
                <p className="text-sm text-muted-foreground">Running</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium">Server Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OS:</span>
                  <span>Ubuntu 22.04 LTS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU:</span>
                  <span>Intel Xeon 8-core</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memory:</span>
                  <span>32GB RAM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage:</span>
                  <span>500GB SSD</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Network Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connectivity:</span>
                  <span className="flex items-center gap-1">
                    <Wifi className="h-3 w-3 text-green-600" />
                    Excellent
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency:</span>
                  <span>12ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bandwidth:</span>
                  <span>1Gbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Connections:</span>
                  <span>1,247</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}