import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePOCart } from "@/contexts/POCartProvider";

interface Roll {
  id: string;
  position: number;
  meters: number;
}

interface SampleRoll extends Roll {
  sampleMeters: number;
}

interface SampleRollSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotId: string;
  lotNumber: string;
  quality: string;
  color: string;
  supplierName: string;
  entryDate: string;
}

const PRESET_METERS = [5, 10, 25, 50];

export default function SampleRollSelectionDialog({
  open,
  onOpenChange,
  lotId,
  lotNumber,
  quality,
  color,
  supplierName,
  entryDate
}: SampleRollSelectionDialogProps) {
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [sampleRolls, setSampleRolls] = useState<SampleRoll[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToCart } = usePOCart();

  useEffect(() => {
    if (open && lotId) {
      fetchRolls();
    }
  }, [open, lotId]);

  const fetchRolls = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rolls')
        .select('id, position, meters')
        .eq('lot_id', lotId)
        .order('position');

      if (error) throw error;
      
      const rollsData = data || [];
      setRolls(rollsData);
      setSampleRolls(rollsData.map(roll => ({ ...roll, sampleMeters: 0 })));
    } catch (error) {
      toast.error('Failed to fetch rolls');
    } finally {
      setLoading(false);
    }
  };

  const updateSampleMeters = (rollId: string, meters: number) => {
    setSampleRolls(prev => prev.map(roll => 
      roll.id === rollId ? { ...roll, sampleMeters: meters } : roll
    ));
  };

  const setPresetMeters = (rollId: string, meters: number) => {
    const roll = rolls.find(r => r.id === rollId);
    if (roll && meters <= roll.meters) {
      updateSampleMeters(rollId, meters);
    } else {
      toast.error(`Cannot exceed ${roll?.meters}m for this roll`);
    }
  };

  const getSelectedSampleRolls = () => {
    return sampleRolls.filter(roll => roll.sampleMeters > 0);
  };

  const getTotalSampleMeters = () => {
    return getSelectedSampleRolls().reduce((sum, roll) => sum + roll.sampleMeters, 0);
  };

  const handleAddToCart = () => {
    const selectedRolls = getSelectedSampleRolls();
    
    if (selectedRolls.length === 0) {
      toast.error('Please select at least one roll with sample meters');
      return;
    }

    // Validate all sample meters are within roll limits
    const invalidRolls = selectedRolls.filter(sampleRoll => {
      const originalRoll = rolls.find(r => r.id === sampleRoll.id);
      return !originalRoll || sampleRoll.sampleMeters > originalRoll.meters;
    });

    if (invalidRolls.length > 0) {
      toast.error('Some sample meters exceed roll capacity');
      return;
    }

    // Prepare data for cart
    const rollIds = selectedRolls.map(roll => roll.id);
    const rollMeters = selectedRolls.map(roll => roll.sampleMeters.toString());
    const rollsData = selectedRolls.map(roll => ({
      id: roll.id,
      meters: roll.sampleMeters,
      position: roll.position
    }));

    addToCart({
      id: lotId,
      lot_number: lotNumber,
      quality,
      color,
      meters: getTotalSampleMeters(),
      roll_count: selectedRolls.length,
      selectedRollIds: rollIds,
      selectedRollsData: rollsData,
      entry_date: entryDate,
      supplier_name: supplierName,
      lineType: 'sample',
      selectedRollMeters: rollMeters
    });

    toast.success(`Added ${selectedRolls.length} sample rolls to cart`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Sample Roll Selection - {lotNumber}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><strong>Quality:</strong> {quality}</div>
            <div><strong>Color:</strong> {color}</div>
            <div><strong>Total Sample:</strong> {getTotalSampleMeters()}m</div>
          </div>

          <Card className="flex-1 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Available Rolls
                <Badge variant="secondary">
                  {getSelectedSampleRolls().length} rolls selected
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {loading ? (
                <div className="text-center py-8">Loading rolls...</div>
              ) : rolls.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No rolls available
                </div>
              ) : (
                <div className="space-y-3">
                  {sampleRolls.map((roll) => {
                    const originalRoll = rolls.find(r => r.id === roll.id);
                    if (!originalRoll) return null;
                    
                    return (
                      <div
                        key={roll.id}
                        className="border rounded-lg p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">Roll #{roll.position}</div>
                            <div className="text-sm text-muted-foreground">
                              Available: {originalRoll.meters}m
                            </div>
                          </div>
                          <Badge 
                            variant={roll.sampleMeters > 0 ? "default" : "secondary"}
                          >
                            {roll.sampleMeters > 0 ? `${roll.sampleMeters}m selected` : 'No sample'}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Enter meters"
                              value={roll.sampleMeters || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                if (value <= originalRoll.meters) {
                                  updateSampleMeters(roll.id, value);
                                } else {
                                  toast.error(`Maximum ${originalRoll.meters}m available`);
                                }
                              }}
                              className="flex-1"
                              max={originalRoll.meters}
                              step="0.1"
                            />
                            <span className="text-sm text-muted-foreground">meters</span>
                          </div>
                          
                          <div className="flex gap-1">
                            <span className="text-xs text-muted-foreground mr-2">Quick:</span>
                            {PRESET_METERS.map(meters => (
                              <Button
                                key={meters}
                                variant="outline"
                                size="sm"
                                className="text-xs h-6 px-2"
                                onClick={() => setPresetMeters(roll.id, meters)}
                                disabled={meters > originalRoll.meters}
                              >
                                {meters}m
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <Separator />
        
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {getSelectedSampleRolls().length > 0 && (
              <>Total: {getTotalSampleMeters()}m from {getSelectedSampleRolls().length} rolls</>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddToCart}
              disabled={getSelectedSampleRolls().length === 0}
            >
              Add to Cart
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}