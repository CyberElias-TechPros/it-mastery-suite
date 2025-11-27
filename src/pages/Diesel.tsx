import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Fuel, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function Diesel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [generatorFilter, setGeneratorFilter] = useState("all");

  const { data: dieselLogs, isLoading } = useQuery({
    queryKey: ["diesel-logs", searchTerm, generatorFilter],
    queryFn: async () => {
      let query = supabase
        .from("diesel_logs")
        .select(`
          *,
          recorded_by_profile:profiles!diesel_logs_recorded_by_fkey(full_name)
        `)
        .order("date", { ascending: false });

      if (generatorFilter !== "all") {
        query = query.eq("generator_id", generatorFilter);
      }

      if (searchTerm) {
        query = query.ilike("generator_id", `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: chartData } = useQuery({
    queryKey: ["diesel-chart-data"],
    queryFn: async () => {
      const { data } = await supabase
        .from("diesel_logs")
        .select("date, consumed_stock, running_hours")
        .order("date", { ascending: true })
        .limit(30);

      return data?.map(log => ({
        date: format(new Date(log.date), "MMM dd"),
        consumption: log.consumed_stock,
        hours: log.running_hours,
      })) || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["diesel-stats"],
    queryFn: async () => {
      const { data: logs } = await supabase
        .from("diesel_logs")
        .select("consumed_stock, running_hours, cost_per_liter")
        .order("date", { ascending: false })
        .limit(10);

      if (!logs || logs.length === 0) return null;

      const totalConsumption = logs.reduce((sum, log) => sum + (log.consumed_stock || 0), 0);
      const totalHours = logs.reduce((sum, log) => sum + (log.running_hours || 0), 0);
      const avgConsumptionPerHour = totalHours > 0 ? totalConsumption / totalHours : 0;
      const latestLog = logs[0];
      const isLowDiesel = latestLog && (latestLog.consumed_stock || 0) < 50; // Alert if less than 50L consumed recently

      return {
        totalConsumption,
        avgConsumptionPerHour,
        isLowDiesel,
        latestConsumption: latestLog?.consumed_stock || 0,
      };
    },
  });

  const getUniqueGenerators = () => {
    if (!dieselLogs) return [];
    const generators = [...new Set(dieselLogs.map(log => log.generator_id))];
    return generators;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diesel Consumption</h1>
          <p className="text-muted-foreground">Monitor generator fuel usage and efficiency</p>
        </div>
        <Link to="/diesel/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Diesel Log
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latest Consumption</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.latestConsumption || 0}L</div>
            <p className="text-xs text-muted-foreground">Last recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Consumption/Hour</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.avgConsumptionPerHour || 0).toFixed(2)}L</div>
            <p className="text-xs text-muted-foreground">Last 10 records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Consumption</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalConsumption || 0}L</div>
            <p className="text-xs text-muted-foreground">Last 10 records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {stats?.isLowDiesel ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <Fuel className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={stats?.isLowDiesel ? "destructive" : "secondary"}>
                {stats?.isLowDiesel ? "Low Diesel Alert" : "Normal"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Consumption status</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consumption Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="consumption" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Running Hours vs Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Diesel Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search generator ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={generatorFilter} onValueChange={setGeneratorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by generator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Generators</SelectItem>
                {getUniqueGenerators().map((generator) => (
                  <SelectItem key={generator} value={generator}>
                    {generator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading diesel logs...</div>
          ) : !dieselLogs || dieselLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No diesel logs found. Add your first diesel consumption record!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Generator ID</TableHead>
                    <TableHead>Opening Stock</TableHead>
                    <TableHead>Closing Stock</TableHead>
                    <TableHead>Consumed</TableHead>
                    <TableHead>Running Hours</TableHead>
                    <TableHead>Cost/Liter</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Recorded By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dieselLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>{format(new Date(log.date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-medium">{log.generator_id}</TableCell>
                      <TableCell>{log.opening_stock}L</TableCell>
                      <TableCell>{log.closing_stock}L</TableCell>
                      <TableCell>{log.consumed_stock}L</TableCell>
                      <TableCell>{log.running_hours}h</TableCell>
                      <TableCell>${log.cost_per_liter}</TableCell>
                      <TableCell>${log.total_cost}</TableCell>
                      <TableCell>{log.recorded_by_profile?.full_name}</TableCell>
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