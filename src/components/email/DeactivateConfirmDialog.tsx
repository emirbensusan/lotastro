import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Clock, Loader2 } from 'lucide-react';

interface TemplateUsage {
  id: string;
  usage_type: string;
  usage_name: string;
  schedule: string | null;
  description: string | null;
}

interface DeactivateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  onConfirm: () => void;
}

const DeactivateConfirmDialog: React.FC<DeactivateConfirmDialogProps> = ({
  open,
  onOpenChange,
  templateId,
  templateName,
  onConfirm
}) => {
  const [usages, setUsages] = useState<TemplateUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && templateId) {
      fetchUsages();
    }
  }, [open, templateId]);

  const fetchUsages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_template_usage')
        .select('*')
        .eq('template_id', templateId);

      if (error) throw error;
      setUsages(data || []);
    } catch (error) {
      console.error('Error fetching template usages:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUsageTypeIcon = (type: string) => {
    switch (type) {
      case 'cron':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Deactivate Template?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You are about to deactivate the "{templateName}" template.
              </p>
              
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking dependencies...
                </div>
              ) : usages.length > 0 ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
                  <p className="font-medium text-yellow-600 mb-2">
                    This template is used by:
                  </p>
                  <ul className="space-y-2">
                    {usages.map(usage => (
                      <li key={usage.id} className="flex items-start gap-2 text-sm">
                        {getUsageTypeIcon(usage.usage_type)}
                        <div>
                          <span className="font-medium">{usage.usage_name}</span>
                          {usage.schedule && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {usage.schedule}
                            </Badge>
                          )}
                          {usage.description && (
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {usage.description}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-yellow-600 mt-3">
                    Deactivating will stop these notifications from being sent.
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  This template is not currently used by any automated processes.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            Deactivate Template
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeactivateConfirmDialog;