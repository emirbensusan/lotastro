import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SampleRollSelectionDialog from "./SampleRollSelectionDialog";

interface QualityColorGroup {
  quality: string;
  color: string;
  lots: Array<{
    id: string;
    lot_number: string;
    roll_count: number;
    supplier_name: string;
    entry_date: string;
  }>;
}

interface SampleOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SampleOrderDialog({
  open,
  onOpenChange
}: SampleOrderDialogProps) {
  const [qualityColors, setQualityColors] = useState<QualityColorGroup[]>([]);
  const [selectedQuality, setSelectedQuality] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [availableLots, setAvailableLots] = useState<QualityColorGroup['lots']>([]);
  const [loading, setLoading] = useState(false);
  
  // Roll selection dialog state
  const [rollDialogOpen, setRollDialogOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<{
    id: string;
    lot_number: string;
    quality: string;
    color: string;
    supplier_name: string;
    entry_date: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      fetchQualityColorGroups();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (selectedQuality && selectedColor) {
      const group = qualityColors.find(
        qc => qc.quality === selectedQuality && qc.color === selectedColor
      );
      setAvailableLots(group?.lots || []);
    } else {
      setAvailableLots([]);
    }
  }, [selectedQuality, selectedColor, qualityColors]);

  const resetForm = () => {
    setSelectedQuality("");
    setSelectedColor("");
    setAvailableLots([]);
    setSelectedLot(null);
  };

  const fetchQualityColorGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          id,
          lot_number,
          quality,
          color,
          roll_count,
          entry_date,
          suppliers!inner(name)
        `)
        .eq('status', 'in_stock')
        .gt('roll_count', 0)
        .order('quality')
        .order('color')
        .order('lot_number');

      if (error) throw error;

      // Group by quality and color
      const groups = (data || []).reduce((acc, lot) => {
        const key = `${lot.quality}-${lot.color}`;
        if (!acc[key]) {
          acc[key] = {
            quality: lot.quality,
            color: lot.color,
            lots: []
          };
        }
        acc[key].lots.push({
          id: lot.id,
          lot_number: lot.lot_number,
          roll_count: lot.roll_count,
          supplier_name: lot.suppliers.name,
          entry_date: lot.entry_date
        });
        return acc;
      }, {} as Record<string, QualityColorGroup>);

      setQualityColors(Object.values(groups));
    } catch (error) {
      toast.error('Failed to fetch available lots');
    } finally {
      setLoading(false);
    }
  };

  const handleLotSelect = (lot: QualityColorGroup['lots'][0]) => {
    setSelectedLot({
      id: lot.id,
      lot_number: lot.lot_number,
      quality: selectedQuality,
      color: selectedColor,
      supplier_name: lot.supplier_name,
      entry_date: lot.entry_date
    });
    setRollDialogOpen(true);
  };

  const uniqueQualities = Array.from(new Set(qualityColors.map(qc => qc.quality)));
  const availableColors = qualityColors
    .filter(qc => !selectedQuality || qc.quality === selectedQuality)
    .map(qc => qc.color);
  const uniqueColors = Array.from(new Set(availableColors));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5" />
              Sample Order - Select Quality, Color & Lot
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Quality</label>
                <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueQualities.map(quality => (
                      <SelectItem key={quality} value={quality}>
                        {quality}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Color</label>
                <Select 
                  value={selectedColor} 
                  onValueChange={setSelectedColor}
                  disabled={!selectedQuality}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueColors.map(color => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedQuality && selectedColor && (
              <Card className="flex-1 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    Available Lots
                    <Badge variant="secondary">
                      {availableLots.length} lots
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="text-center py-8">Loading lots...</div>
                  ) : availableLots.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No lots available for this combination
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableLots.map((lot) => (
                        <div
                          key={lot.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleLotSelect(lot)}
                        >
                          <div>
                            <div className="font-medium">{lot.lot_number}</div>
                            <div className="text-sm text-muted-foreground">
                              {lot.supplier_name} • {lot.entry_date}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {lot.roll_count} rolls
                            </Badge>
                            <Button variant="ghost" size="sm">
                              Select Rolls
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          
          <Separator />
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedLot && (
        <SampleRollSelectionDialog
          open={rollDialogOpen}
          onOpenChange={setRollDialogOpen}
          lotId={selectedLot.id}
          lotNumber={selectedLot.lot_number}
          quality={selectedLot.quality}
          color={selectedLot.color}
          supplierName={selectedLot.supplier_name}
          entryDate={selectedLot.entry_date}
        />
      )}
    </>
  );
}