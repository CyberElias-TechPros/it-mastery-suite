import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Fuel, Calculator } from "lucide-react";

export default function NewDiesel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    generator_id: "",
    date: new Date().toISOString().split('T')[0],
    opening_stock: "",
    closing_stock: "",
    start_time: "",
    stop_time: "",
    cost_per_liter: "",
    notes: "",
  });

  const [calculatedValues, setCalculatedValues] = useState({
    consumed_stock: 0,
    running_hours: 0,
    total_cost: 0,
  });

  const createDieselLogMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: log, error } = await supabase
        .from("diesel_logs")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return log;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Diesel log created successfully",
      });
      navigate("/diesel");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create diesel log",
        variant: "destructive",
      });
      console.error("Error creating diesel log:", error);
    },
  });

  const calculateValues = () => {
    const opening = parseFloat(formData.opening_stock) || 0;
    const closing = parseFloat(formData.closing_stock) || 0;
    const consumed = opening - closing;

    let runningHours = 0;
    if (formData.start_time && formData.stop_time) {
      const start = new Date(`2000-01-01T${formData.start_time}`);
      const stop = new Date(`2000-01-01T${formData.stop_time}`);
      runningHours = (stop.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (runningHours < 0) runningHours += 24; // Handle overnight
    }

    const costPerLiter = parseFloat(formData.cost_per_liter) || 0;
    const totalCost = consumed * costPerLiter;

    setCalculatedValues({
      consumed_stock: consumed,
      running_hours: runningHours,
      total_cost: totalCost,
    });

    return {
      consumed_stock: consumed,
      running_hours: runningHours,
      total_cost: totalCost,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const calculated = calculateValues();

    setLoading(true);

    try {
      await createDieselLogMutation.mutateAsync({
        ...formData,
        ...calculated,
        recorded_by: user?.id,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Auto-calculate when relevant fields change
    if (['opening_stock', 'closing_stock', 'start_time', 'stop_time', 'cost_per_liter'].includes(field)) {
      setTimeout(calculateValues, 100);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/diesel")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Diesel Logs
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add Diesel Log</h1>
          <p className="text-muted-foreground">Record generator fuel consumption</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Fuel Consumption
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="generator_id">Generator ID *</Label>
              <Input
                id="generator_id"
                value={formData.generator_id}
                onChange={(e) => handleInputChange("generator_id", e.target.value)}
                placeholder="e.g., GEN-001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="opening_stock">Opening Stock (L) *</Label>
                <Input
                  id="opening_stock"
                  type="number"
                  step="0.01"
                  value={formData.opening_stock}
                  onChange={(e) => handleInputChange("opening_stock", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="closing_stock">Closing Stock (L) *</Label>
                <Input
                  id="closing_stock"
                  type="number"
                  step="0.01"
                  value={formData.closing_stock}
                  onChange={(e) => handleInputChange("closing_stock", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_per_liter">Cost per Liter ($)</Label>
              <Input
                id="cost_per_liter"
                type="number"
                step="0.01"
                value={formData.cost_per_liter}
                onChange={(e) => handleInputChange("cost_per_liter", e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Additional notes about the diesel consumption"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Runtime & Calculations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleInputChange("start_time", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stop_time">Stop Time</Label>
                <Input
                  id="stop_time"
                  type="time"
                  value={formData.stop_time}
                  onChange={(e) => handleInputChange("stop_time", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Calculated Values</h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Consumed Stock</Label>
                  <div className="text-lg font-semibold">{calculatedValues.consumed_stock.toFixed(2)} L</div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Running Hours</Label>
                  <div className="text-lg font-semibold">{calculatedValues.running_hours.toFixed(2)} h</div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Total Cost</Label>
                <div className="text-xl font-bold text-green-600">${calculatedValues.total_cost.toFixed(2)}</div>
              </div>

              {calculatedValues.consumed_stock > 0 && calculatedValues.running_hours > 0 && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Consumption Rate</Label>
                  <div className="text-lg font-semibold">
                    {(calculatedValues.consumed_stock / calculatedValues.running_hours).toFixed(2)} L/hour
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => navigate("/diesel")}>
          Cancel
        </Button>
        <Button type="submit" onClick={handleSubmit} disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Saving..." : "Save Diesel Log"}
        </Button>
      </div>
    </div>
  );
}