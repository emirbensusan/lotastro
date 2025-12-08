import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Edit, Save, Loader2, Mail } from 'lucide-react';

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject_en: string;
  subject_tr: string;
  body_en: string;
  body_tr: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EmailTemplatesTab: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editLanguage, setEditLanguage] = useState<'en' | 'tr'>('en');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: t('error') as string,
        description: t('settings.fetchTemplatesError') as string,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate({ ...template });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          name: editingTemplate.name,
          subject_en: editingTemplate.subject_en,
          subject_tr: editingTemplate.subject_tr,
          body_en: editingTemplate.body_en,
          body_tr: editingTemplate.body_tr,
          is_active: editingTemplate.is_active,
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: t('settings.templateSaved') as string,
      });

      fetchTemplates();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: t('error') as string,
        description: t('settings.saveTemplateError') as string,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;
      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {t('settings.emailTemplates')}
        </CardTitle>
        <CardDescription>{t('settings.emailTemplatesDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
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
                <TableHead>{t('settings.templateName')}</TableHead>
                <TableHead>{t('settings.templateKey')}</TableHead>
                <TableHead>{t('settings.variables')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {template.template_key}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.variables?.slice(0, 3).map((v) => (
                        <Badge key={v} variant="outline" className="text-xs">
                          {`{${v}}`}
                        </Badge>
                      ))}
                      {template.variables?.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.variables.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={() => toggleActive(template)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                      <Edit className="h-3 w-3 mr-1" />
                      {t('edit')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('settings.editTemplate')}</DialogTitle>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.templateName')}</Label>
                <Input
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('settings.availableVariables')}</Label>
                <div className="flex flex-wrap gap-1 p-2 bg-muted rounded">
                  {editingTemplate.variables?.map((v) => (
                    <Badge key={v} variant="secondary" className="text-xs">
                      {`{${v}}`}
                    </Badge>
                  ))}
                </div>
              </div>

              <Tabs value={editLanguage} onValueChange={(v) => setEditLanguage(v as 'en' | 'tr')}>
                <TabsList>
                  <TabsTrigger value="en">🇺🇸 English</TabsTrigger>
                  <TabsTrigger value="tr">🇹🇷 Türkçe</TabsTrigger>
                </TabsList>

                <TabsContent value="en" className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.subject')}</Label>
                    <Input
                      value={editingTemplate.subject_en}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, subject_en: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.body')}</Label>
                    <Textarea
                      value={editingTemplate.body_en}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, body_en: e.target.value })}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="tr" className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.subject')}</Label>
                    <Input
                      value={editingTemplate.subject_tr}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, subject_tr: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.body')}</Label>
                    <Textarea
                      value={editingTemplate.body_tr}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, body_tr: e.target.value })}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  {t('save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default EmailTemplatesTab;