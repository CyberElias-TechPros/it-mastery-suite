import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Fuel } from "lucide-react";
import { format } from "date-fns";

export default function Diesel() {
  const { data: dieselLogs, isLoading } = useQuery({
    queryKey: ["diesel-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diesel_logs")
        .select(`*, recorded_by_profile:profiles!diesel_logs_recorded_by_fkey(full_name), branch:branches(name)`)
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["diesel-stats"],
    queryFn: async () => {
      const { data: logs } = await supabase
        .from("diesel_logs")
        .select("consumed_stock, running_hours")
        .order("date", { ascending: false })
        .limit(10);

      const totalConsumption = logs?.reduce((sum, log: any) => sum + (log.consumed_stock || 0), 0) || 0;
      const totalHours = logs?.reduce((sum, log: any) => sum + (log.running_hours || 0), 0) || 0;
      return { totalConsumption, avgPerHour: totalHours > 0 ? totalConsumption / totalHours : 0 };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diesel Consumption</h1>
          <p className="text-muted-foreground">Monitor generator fuel usage</p>
        </div>
        <Link to="/diesel/new">
          <Button><Plus className="mr-2 h-4 w-4" />Add Log</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Consumption (Last 10)</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalConsumption?.toFixed(1) || 0} L</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Consumption/Hour</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgPerHour?.toFixed(2) || 0} L/hr</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : dieselLogs?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No diesel logs found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Opening</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Consumed</TableHead>
                  <TableHead>Closing</TableHead>
                  <TableHead>Recorded By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dieselLogs?.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{format(new Date(log.date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{log.branch?.name || "N/A"}</TableCell>
                    <TableCell>{log.opening_stock} L</TableCell>
                    <TableCell>{log.received_stock || 0} L</TableCell>
                    <TableCell>{log.consumed_stock} L</TableCell>
                    <TableCell>{log.closing_stock} L</TableCell>
                    <TableCell>{log.recorded_by_profile?.full_name || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}