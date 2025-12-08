import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Copy } from 'lucide-react';

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  category: string;
  subject_en: string;
  subject_tr: string;
  body_en: string;
  body_tr: string;
  variables: string[];
  variables_meta: any[];
  is_active: boolean;
  is_system: boolean;
  version: number;
}

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  duplicateFrom?: EmailTemplate | null;
}

const CATEGORIES = [
  { value: 'manufacturing_orders', label: 'Manufacturing Orders' },
  { value: 'reservations', label: 'Reservations' },
  { value: 'deliveries', label: 'Deliveries' },
  { value: 'system', label: 'System Alerts' },
];

const CreateTemplateDialog: React.FC<CreateTemplateDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
  duplicateFrom
}) => {
  const { toast } = useToast();
  const [name, setName] = useState(duplicateFrom ? `${duplicateFrom.name} (Copy)` : '');
  const [templateKey, setTemplateKey] = useState(duplicateFrom ? `${duplicateFrom.template_key}_copy` : '');
  const [category, setCategory] = useState(duplicateFrom?.category || 'system');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !templateKey.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name and template key are required',
        variant: 'destructive'
      });
      return;
    }

    // Validate template key format
    if (!/^[a-z0-9_]+$/.test(templateKey)) {
      toast({
        title: 'Invalid Template Key',
        description: 'Template key must contain only lowercase letters, numbers, and underscores',
        variant: 'destructive'
      });
      return;
    }

    setCreating(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const newTemplate = {
        name: name.trim(),
        template_key: templateKey.trim(),
        category,
        subject_en: duplicateFrom?.subject_en || 'New Template Subject',
        subject_tr: duplicateFrom?.subject_tr || 'Yeni Şablon Konusu',
        body_en: duplicateFrom?.body_en || '<p>Enter your email content here...</p>',
        body_tr: duplicateFrom?.body_tr || '<p>E-posta içeriğinizi buraya girin...</p>',
        variables: duplicateFrom?.variables || [],
        variables_meta: duplicateFrom?.variables_meta || [],
        is_active: false,
        is_system: false,
        version: 1
      };

      const { error } = await supabase
        .from('email_templates')
        .insert(newTemplate);

      if (error) {
        if (error.code === '23505') {
          throw new Error('A template with this key already exists');
        }
        throw error;
      }

      toast({
        title: 'Template Created',
        description: duplicateFrom 
          ? `Template duplicated from "${duplicateFrom.name}"`
          : 'New email template created successfully',
      });

      onCreated();
      onOpenChange(false);
      setName('');
      setTemplateKey('');
      setCategory('system');
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create template',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const generateKeyFromName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {duplicateFrom ? (
              <>
                <Copy className="h-5 w-5" />
                Duplicate Template
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Create New Template
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {duplicateFrom 
              ? `Create a copy of "${duplicateFrom.name}"`
              : 'Create a new email template for notifications'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              placeholder="e.g., Order Confirmation"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!duplicateFrom) {
                  setTemplateKey(generateKeyFromName(e.target.value));
                }
              }}
              disabled={creating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="key">Template Key</Label>
            <Input
              id="key"
              placeholder="e.g., order_confirmation"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              disabled={creating}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier used in code. Only lowercase letters, numbers, and underscores.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={creating}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim() || !templateKey.trim()}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : duplicateFrom ? (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTemplateDialog;