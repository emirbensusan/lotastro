import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { History, RotateCcw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface TemplateVersion {
  id: string;
  version: number;
  subject_en: string;
  subject_tr: string;
  body_en: string;
  body_tr: string;
  changed_by: string;
  change_reason: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface VersionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  currentVersion: number;
  onRollback: (version: TemplateVersion) => void;
}

const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  open,
  onOpenChange,
  templateId,
  currentVersion,
  onRollback
}) => {
  const { toast } = useToast();
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  useEffect(() => {
    if (open && templateId) {
      fetchVersions();
    }
  }, [open, templateId]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_template_versions')
        .select(`
          *,
          profiles:changed_by (full_name, email)
        `)
        .eq('template_id', templateId)
        .order('version', { ascending: false });

      if (error) throw error;
      setVersions((data as unknown as TemplateVersion[]) || []);
    } catch (error) {
      console.error('Error fetching versions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load version history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = (version: TemplateVersion) => {
    onRollback(version);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </SheetTitle>
          <SheetDescription>
            View and restore previous versions of this template
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No version history yet</p>
              <p className="text-sm">Changes will be recorded after the first save</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="space-y-3 pr-4">
                {versions.map((version) => (
                  <Collapsible
                    key={version.id}
                    open={expandedVersion === version.version}
                    onOpenChange={(open) => setExpandedVersion(open ? version.version : null)}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <Badge variant={version.version === currentVersion ? "default" : "outline"}>
                              v{version.version}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium">
                                {version.profiles?.full_name || version.profiles?.email || 'Unknown'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(version.created_at), 'PPp')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {version.version === currentVersion && (
                              <Badge variant="secondary" className="text-xs">Current</Badge>
                            )}
                            {expandedVersion === version.version ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="p-3 border-t">
                          {version.change_reason && (
                            <p className="text-sm text-muted-foreground mb-3 italic">
                              "{version.change_reason}"
                            </p>
                          )}
                          
                          <Tabs defaultValue="en" className="w-full">
                            <TabsList className="w-full">
                              <TabsTrigger value="en" className="flex-1">🇺🇸 EN</TabsTrigger>
                              <TabsTrigger value="tr" className="flex-1">🇹🇷 TR</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="en" className="mt-3">
                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Subject</p>
                                  <p className="text-sm">{version.subject_en}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Body</p>
                                  <div 
                                    className="text-sm prose prose-sm max-w-none max-h-32 overflow-auto border rounded p-2 bg-muted/20"
                                    dangerouslySetInnerHTML={{ __html: version.body_en }}
                                  />
                                </div>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="tr" className="mt-3">
                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Konu</p>
                                  <p className="text-sm">{version.subject_tr}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">İçerik</p>
                                  <div 
                                    className="text-sm prose prose-sm max-w-none max-h-32 overflow-auto border rounded p-2 bg-muted/20"
                                    dangerouslySetInnerHTML={{ __html: version.body_tr }}
                                  />
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                          
                          {version.version !== currentVersion && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-3"
                              onClick={() => handleRollback(version)}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restore this version
                            </Button>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VersionHistoryDrawer;