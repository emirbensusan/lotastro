import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SampleLot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  roll_count: number;
}

interface SampleOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSample: (customerName: string, selectedLots: SampleLot[]) => void;
  isBulk?: boolean;
}

export default function SampleOrderDialog({
  open,
  onOpenChange,
  onCreateSample,
  isBulk = false
}: SampleOrderDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [availableLots, setAvailableLots] = useState<SampleLot[]>([]);
  const [selectedLots, setSelectedLots] = useState<SampleLot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAvailableLots();
    }
  }, [open]);

  const fetchAvailableLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('id, lot_number, quality, color, roll_count')
        .eq('status', 'in_stock')
        .gt('roll_count', 0)
        .limit(50);

      if (error) throw error;
      setAvailableLots(data || []);
    } catch (error) {
      toast.error('Failed to fetch available lots');
    }
  };

  const addLotToSample = (lot: SampleLot) => {
    // For samples, limit to 1-2 rolls maximum
    const maxRolls = isBulk ? 2 : 1;
    const rollCount = Math.min(lot.roll_count, maxRolls);
    
    const sampleLot = { ...lot, roll_count: rollCount };
    setSelectedLots([...selectedLots, sampleLot]);
  };

  const removeLotFromSample = (lotId: string) => {
    setSelectedLots(selectedLots.filter(lot => lot.id !== lotId));
  };

  const handleCreateSample = () => {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    if (selectedLots.length === 0) {
      toast.error('Please select at least one lot for the sample');
      return;
    }

    onCreateSample(customerName, selectedLots);
    
    // Reset form
    setCustomerName("");
    setSelectedLots([]);
    onOpenChange(false);
  };

  const totalRolls = selectedLots.reduce((sum, lot) => sum + lot.roll_count, 0);
  const maxSampleLimit = isBulk ? 10 : 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            {isBulk ? 'Bulk Sample Preparation' : 'Single Sample Order'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden">
          <div>
            <Label htmlFor="customer">Customer Name</Label>
            <Input
              id="customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-sm">Available Lots</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <div className="space-y-2">
                  {availableLots.map((lot) => (
                    <div
                      key={lot.id}
                      className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => addLotToSample(lot)}
                    >
                      <div>
                        <div className="font-medium">{lot.lot_number}</div>
                        <div className="text-sm text-muted-foreground">
                          {lot.quality} - {lot.color}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {lot.roll_count} rolls
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  Sample Selection
                  <Badge variant={totalRolls > maxSampleLimit ? "destructive" : "default"}>
                    {totalRolls}/{maxSampleLimit} rolls
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {selectedLots.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No lots selected for sample
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedLots.map((lot) => (
                      <div
                        key={lot.id}
                        className="flex items-center justify-between p-2 border rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{lot.lot_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {lot.quality} - {lot.color}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {lot.roll_count} roll{lot.roll_count > 1 ? 's' : ''}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLotFromSample(lot.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {totalRolls > maxSampleLimit && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              Sample exceeds maximum limit of {maxSampleLimit} rolls. Please reduce selection.
            </div>
          )}
        </div>
        
        <Separator />
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateSample}
            disabled={selectedLots.length === 0 || totalRolls > maxSampleLimit}
          >
            Create Sample Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}