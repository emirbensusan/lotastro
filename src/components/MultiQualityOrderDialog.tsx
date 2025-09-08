import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface QualityColorSelection {
  id: string;
  quality: string;
  color: string;
}

interface MultiQualityOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableQualities: string[];
  onProceed: (selections: QualityColorSelection[]) => void;
}

export default function MultiQualityOrderDialog({
  open,
  onOpenChange,
  availableQualities,
  onProceed
}: MultiQualityOrderDialogProps) {
  const [selections, setSelections] = useState<QualityColorSelection[]>([
    { id: '1', quality: '', color: '' }
  ]);

  const addSelection = () => {
    const newId = Date.now().toString();
    setSelections([...selections, { id: newId, quality: '', color: '' }]);
  };

  const removeSelection = (id: string) => {
    if (selections.length > 1) {
      setSelections(selections.filter(s => s.id !== id));
    }
  };

  const updateSelection = (id: string, field: keyof QualityColorSelection, value: string) => {
    setSelections(selections.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const handleProceed = () => {
    const validSelections = selections.filter(s => s.quality && s.color);
    
    if (validSelections.length === 0) {
      toast.error("Please select at least one quality and color combination");
      return;
    }

    onProceed(validSelections);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Quality & Color Combinations</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {selections.map((selection, index) => (
            <div key={selection.id} className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <Label>Quality</Label>
                  <Select
                    value={selection.quality}
                    onValueChange={(value) => updateSelection(selection.id, 'quality', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select quality" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableQualities.map((quality) => (
                        <SelectItem key={quality} value={quality}>
                          {quality}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Color</Label>
                  <Input
                    placeholder="Enter color"
                    value={selection.color}
                    onChange={(e) => updateSelection(selection.id, 'color', e.target.value)}
                  />
                </div>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => removeSelection(selection.id)}
                disabled={selections.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          
          <Button
            variant="outline"
            onClick={addSelection}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Quality & Color
          </Button>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleProceed}>
            Proceed to Lot Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}