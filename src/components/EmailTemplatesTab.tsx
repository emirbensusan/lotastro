import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Edit, Mail, Plus, Copy, Search, Clock, AlertTriangle } from 'lucide-react';
import EmailTemplateEditor from '@/components/email/EmailTemplateEditor';
import VersionHistoryDrawer from '@/components/email/VersionHistoryDrawer';
import SendTestEmailDialog from '@/components/email/SendTestEmailDialog';
import CreateTemplateDialog from '@/components/email/CreateTemplateDialog';
import DeactivateConfirmDialog from '@/components/email/DeactivateConfirmDialog';

interface VariableMeta {
  name: string;
  description: string;
  example: string;
  required: boolean;
}

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  category: string;
  subject_en: string;
  subject_tr: string;
  body_en: string;
  body_tr: string;
  default_subject_en: string | null;
  default_subject_tr: string | null;
  default_body_en: string | null;
  default_body_tr: string | null;
  variables: string[];
  variables_meta: VariableMeta[];
  is_active: boolean;
  is_system: boolean;
  version: number;
  created_at?: string;
  updated_at?: string;
}

interface TemplateUsage {
  id: string;
  usage_type: string;
  usage_name: string;
  schedule: string | null;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'manufacturing_orders', label: 'Manufacturing Orders' },
  { value: 'reservations', label: 'Reservations' },
  { value: 'deliveries', label: 'Deliveries' },
  { value: 'system', label: 'System Alerts' },
];

const EmailTemplatesTab: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [usages, setUsages] = useState<Record<string, TemplateUsage[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [originalTemplate, setOriginalTemplate] = useState<EmailTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Dialog states
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateTemplate, setDuplicateTemplate] = useState<EmailTemplate | null>(null);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [templateToDeactivate, setTemplateToDeactivate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      
      const templatesData: EmailTemplate[] = (data || []).map(t => ({
        id: t.id,
        template_key: t.template_key,
        name: t.name,
        category: t.category || 'system',
        subject_en: t.subject_en,
        subject_tr: t.subject_tr,
        body_en: t.body_en,
        body_tr: t.body_tr,
        default_subject_en: t.default_subject_en,
        default_subject_tr: t.default_subject_tr,
        default_body_en: t.default_body_en,
        default_body_tr: t.default_body_tr,
        variables: t.variables || [],
        variables_meta: (Array.isArray(t.variables_meta) ? t.variables_meta : []) as unknown as VariableMeta[],
        is_active: t.is_active ?? true,
        is_system: t.is_system ?? false,
        version: t.version || 1,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
      
      setTemplates(templatesData);
      
      // Fetch usages for all templates
      const { data: usageData } = await supabase
        .from('email_template_usage')
        .select('*');
      
      const usageMap: Record<string, TemplateUsage[]> = {};
      usageData?.forEach((u: any) => {
        if (!usageMap[u.template_id]) usageMap[u.template_id] = [];
        usageMap[u.template_id].push(u);
      });
      setUsages(usageMap);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: t('error') as string,
        description: 'Failed to fetch email templates',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate({ ...template });
    setOriginalTemplate({ ...template });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    // Validation
    if (!editingTemplate.subject_en.trim() || !editingTemplate.subject_tr.trim() ||
        !editingTemplate.body_en.trim() || !editingTemplate.body_tr.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Subject and body are required in both languages',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      // Save version history first
      if (originalTemplate) {
        await supabase.from('email_template_versions').insert({
          template_id: editingTemplate.id,
          version: editingTemplate.version,
          subject_en: originalTemplate.subject_en,
          subject_tr: originalTemplate.subject_tr,
          body_en: originalTemplate.body_en,
          body_tr: originalTemplate.body_tr,
          changed_by: user.user?.id,
        });
      }

      // Update the template
      const { error } = await supabase
        .from('email_templates')
        .update({
          name: editingTemplate.name,
          category: editingTemplate.category,
          subject_en: editingTemplate.subject_en,
          subject_tr: editingTemplate.subject_tr,
          body_en: editingTemplate.body_en,
          body_tr: editingTemplate.body_tr,
          is_active: editingTemplate.is_active,
          version: editingTemplate.version + 1,
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: 'Template saved successfully',
      });

      fetchTemplates();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: t('error') as string,
        description: 'Failed to save template',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!editingTemplate || !editingTemplate.default_body_en) return;
    
    setEditingTemplate({
      ...editingTemplate,
      subject_en: editingTemplate.default_subject_en || editingTemplate.subject_en,
      subject_tr: editingTemplate.default_subject_tr || editingTemplate.subject_tr,
      body_en: editingTemplate.default_body_en || editingTemplate.body_en,
      body_tr: editingTemplate.default_body_tr || editingTemplate.body_tr,
    });
    
    toast({ title: 'Reset to default', description: 'Template content restored to original' });
  };

  const handleRollback = (version: any) => {
    if (!editingTemplate) return;
    
    setEditingTemplate({
      ...editingTemplate,
      subject_en: version.subject_en,
      subject_tr: version.subject_tr,
      body_en: version.body_en,
      body_tr: version.body_tr,
    });
    
    toast({ title: 'Version restored', description: `Restored to version ${version.version}` });
  };

  const toggleActive = async (template: EmailTemplate) => {
    if (template.is_active) {
      // Show confirmation when deactivating
      setTemplateToDeactivate(template);
      setDeactivateConfirmOpen(true);
    } else {
      // Activate directly
      await updateActiveStatus(template, true);
    }
  };

  const updateActiveStatus = async (template: EmailTemplate, newStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ is_active: newStatus })
        .eq('id', template.id);

      if (error) throw error;
      fetchTemplates();
      toast({ 
        title: newStatus ? 'Template Activated' : 'Template Deactivated',
        description: `"${template.name}" is now ${newStatus ? 'active' : 'inactive'}`
      });
    } catch (error) {
      console.error('Error toggling template:', error);
    }
  };

  const handleDuplicate = (template: EmailTemplate) => {
    setDuplicateTemplate(template);
    setCreateOpen(true);
  };

  const hasChanges = editingTemplate && originalTemplate && (
    editingTemplate.name !== originalTemplate.name ||
    editingTemplate.subject_en !== originalTemplate.subject_en ||
    editingTemplate.subject_tr !== originalTemplate.subject_tr ||
    editingTemplate.body_en !== originalTemplate.body_en ||
    editingTemplate.body_tr !== originalTemplate.body_tr ||
    editingTemplate.is_active !== originalTemplate.is_active
  );

  const handleCloseDialog = () => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) return;
    }
    setDialogOpen(false);
    setEditingTemplate(null);
    setOriginalTemplate(null);
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.template_key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Templates
            </CardTitle>
            <CardDescription>Manage email templates for reminders and notifications</CardDescription>
          </div>
          <Button onClick={() => { setDuplicateTemplate(null); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Used By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                  <TableCell>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {template.name}
                        {template.is_system && <Badge variant="secondary" className="text-xs">System</Badge>}
                      </div>
                      <code className="text-xs text-muted-foreground">{template.template_key}</code>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getCategoryLabel(template.category)}</Badge>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      {usages[template.id]?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {usages[template.id].slice(0, 2).map(u => (
                            <Tooltip key={u.id}>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {u.usage_name}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{u.schedule || 'Automated'}</TooltipContent>
                            </Tooltip>
                          ))}
                          {usages[template.id].length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{usages[template.id].length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not used</span>
                      )}
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => toggleActive(template)}
                      />
                      {!template.is_active && (
                        <Badge variant="outline" className="text-muted-foreground">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          {editingTemplate && (
            <EmailTemplateEditor
              template={editingTemplate}
              onChange={setEditingTemplate}
              onSave={handleSave}
              onSendTest={() => setTestEmailOpen(true)}
              onReset={handleReset}
              onViewHistory={() => setHistoryOpen(true)}
              saving={saving}
              sendingTest={sendingTest}
              hasChanges={hasChanges || false}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Version History */}
      {editingTemplate && (
        <VersionHistoryDrawer
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          templateId={editingTemplate.id}
          currentVersion={editingTemplate.version}
          onRollback={handleRollback}
        />
      )}

      {/* Send Test Email */}
      {editingTemplate && (
        <SendTestEmailDialog
          open={testEmailOpen}
          onOpenChange={setTestEmailOpen}
          templateId={editingTemplate.id}
          templateName={editingTemplate.name}
        />
      )}

      {/* Create/Duplicate Template */}
      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setDuplicateTemplate(null); }}
        onCreated={fetchTemplates}
        duplicateFrom={duplicateTemplate}
      />

      {/* Deactivate Confirmation */}
      {templateToDeactivate && (
        <DeactivateConfirmDialog
          open={deactivateConfirmOpen}
          onOpenChange={setDeactivateConfirmOpen}
          templateId={templateToDeactivate.id}
          templateName={templateToDeactivate.name}
          onConfirm={() => {
            updateActiveStatus(templateToDeactivate, false);
            setDeactivateConfirmOpen(false);
            setTemplateToDeactivate(null);
          }}
        />
      )}
    </Card>
  );
};

export default EmailTemplatesTab;