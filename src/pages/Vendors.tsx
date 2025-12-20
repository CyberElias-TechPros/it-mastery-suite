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
import { Plus, Search, Building, Star, AlertTriangle, Phone, Mail, Globe } from "lucide-react";
import { format } from "date-fns";

export default function Vendors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors", searchTerm, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("vendors")
        .select("*")
        .order("name", { ascending: true });

      if (categoryFilter !== "all") {
        query = query.eq("service_type", categoryFilter);
      }

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: expiringContracts } = useQuery({
    queryKey: ["expiring-vendor-contracts"],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .lte("contract_end_date", thirtyDaysFromNow.toISOString())
        .gte("contract_end_date", new Date().toISOString())
        .order("contract_end_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const getUniqueCategories = () => {
    if (!vendors) return [];
    const categories = [...new Set(vendors.map(vendor => vendor.service_type).filter(Boolean))] as string[];
    return categories;
  };

  const getContractStatus = (endDate: string | null) => {
    if (!endDate) return { status: "No Contract", color: "secondary" };

    const end = new Date(endDate);
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    if (end < now) {
      return { status: "Expired", color: "destructive" };
    } else if (end <= thirtyDaysFromNow) {
      return { status: "Expiring Soon", color: "warning" };
    } else {
      return { status: "Active", color: "success" };
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
        <span className="text-sm text-muted-foreground ml-1">({rating})</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendors</h1>
          <p className="text-muted-foreground">Manage vendor relationships and contracts</p>
        </div>
        <Link to="/vendors/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </Link>
      </div>

      {/* Contract Alerts */}
      {expiringContracts && expiringContracts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="h-5 w-5" />
              Contracts Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringContracts.slice(0, 3).map(vendor => (
                <div key={vendor.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded">
                  <div>
                    <p className="font-medium">{vendor.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Expires: {format(new Date(vendor.contract_end_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-600">
                    {Math.ceil((new Date(vendor.contract_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
                  </Badge>
                </div>
              ))}
              {expiringContracts.length > 3 && (
                <p className="text-sm text-muted-foreground">
                  And {expiringContracts.length - 3} more...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {getUniqueCategories().map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vendors Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading vendors...</div>
          ) : !vendors || vendors.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No vendors found. Add your first vendor to get started!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Contract Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((vendor: any) => {
                    const contractStatus = getContractStatus(vendor.contract_end_date);
                    return (
                      <TableRow key={vendor.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{vendor.name}</p>
                            {vendor.website && (
                              <a
                                href={vendor.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Globe className="h-3 w-3" />
                                Website
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {vendor.contact_person && (
                              <p className="text-sm">{vendor.contact_person}</p>
                            )}
                            {vendor.email && (
                              <a
                                href={`mailto:${vendor.email}`}
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Mail className="h-3 w-3" />
                                {vendor.email}
                              </a>
                            )}
                            {vendor.phone && (
                              <a
                                href={`tel:${vendor.phone}`}
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Phone className="h-3 w-3" />
                                {vendor.phone}
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{vendor.service_type || "Uncategorized"}</Badge>
                        </TableCell>
                        <TableCell>
                          {renderStars(null)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={contractStatus.color as any}>
                            {contractStatus.status}
                          </Badge>
                          {vendor.contract_end_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(vendor.contract_end_date), "MMM d, yyyy")}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Link to={`/vendors/${vendor.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                            <Link to={`/purchase-orders/new?vendor=${vendor.id}`}>
                              <Button variant="ghost" size="sm">
                                New PO
                              </Button>
                            </Link>
                          </div>
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