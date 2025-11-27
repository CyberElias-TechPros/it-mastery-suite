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
import { Plus, Search, Filter, Package, Wrench, Archive, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function Assets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets", searchTerm, statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("assets")
        .select(`
          *,
          assigned_to_profile:profiles!assets_assigned_to_fkey(full_name),
          department:departments(name),
          branch:branches(name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter as any);
      }

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,asset_tag.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "in_maintenance":
        return "warning";
      case "retired":
        return "secondary";
      case "disposed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return Package;
      case "in_maintenance":
        return Wrench;
      case "retired":
        return Archive;
      case "disposed":
        return Trash2;
      default:
        return Package;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <p className="text-muted-foreground">Manage IT assets and equipment</p>
        </div>
        <Link to="/assets/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="in_maintenance">In Maintenance</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="laptop">Laptop</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="server">Server</SelectItem>
                <SelectItem value="printer">Printer</SelectItem>
                <SelectItem value="mobile_device">Mobile Device</SelectItem>
                <SelectItem value="software_license">Software License</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading assets...</div>
          ) : !assets || assets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No assets found. Add your first asset to get started!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Purchase Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset: any) => {
                    const StatusIcon = getStatusIcon(asset.status);
                    return (
                      <TableRow key={asset.id} className="cursor-pointer">
                        <TableCell>
                          <Link
                            to={`/assets/${asset.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {asset.asset_tag}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell className="capitalize">{asset.type.replace("_", " ")}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(asset.status) as any} className="capitalize">
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {asset.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{asset.assigned_to_profile?.full_name || "Unassigned"}</TableCell>
                        <TableCell>{asset.department?.name || "N/A"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {asset.purchase_date ? format(new Date(asset.purchase_date), "MMM d, yyyy") : "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}