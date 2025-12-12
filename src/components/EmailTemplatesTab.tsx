import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Edit, Mail, Plus, Copy, Search, Clock, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, 
  Filter, X, Save, Trash2, Bookmark, ChevronDown
} from 'lucide-react';
import EmailTemplateEditor from '@/components/email/EmailTemplateEditor';
import VersionHistoryDrawer from '@/components/email/VersionHistoryDrawer';
import SendTestEmailDialog from '@/components/email/SendTestEmailDialog';
import CreateTemplateDialog from '@/components/email/CreateTemplateDialog';
import DeactivateConfirmDialog from '@/components/email/DeactivateConfirmDialog';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

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
  is_digest: boolean;
  version: number;
  created_at?: string;
  updated_at?: string;
  last_sent_at?: string | null;
  send_count?: number | null;
  error_count?: number | null;
}

interface TemplateUsage {
  id: string;
  usage_type: string;
  usage_name: string;
  schedule: string | null;
}

interface SavedFilterPreset {
  id: string;
  name: string;
  searchQuery: string;
  categoryFilter: string;
  statusFilter: string;
  typeFilter: string;
}

type SortDirection = 'asc' | 'desc' | null;
type SortKey = 'name' | 'category' | 'subject_en' | 'subject_tr' | 'last_sent_at' | 'send_count' | 'error_rate' | 'is_active';

const CATEGORIES = [
  { value: 'all', labelEn: 'All Categories', labelTr: 'Tüm Kategoriler' },
  { value: 'manufacturing_orders', labelEn: 'Manufacturing Orders', labelTr: 'Üretim Siparişleri' },
  { value: 'reservations', labelEn: 'Reservations', labelTr: 'Rezervasyonlar' },
  { value: 'deliveries', labelEn: 'Deliveries', labelTr: 'Teslimatlar' },
  { value: 'system', labelEn: 'System Alerts', labelTr: 'Sistem Uyarıları' },
  { value: 'digests', labelEn: 'Digests', labelTr: 'Özetler' },
];

const STATUS_OPTIONS = [
  { value: 'all', labelEn: 'All Status', labelTr: 'Tüm Durumlar' },
  { value: 'active', labelEn: 'Active', labelTr: 'Aktif' },
  { value: 'inactive', labelEn: 'Inactive', labelTr: 'Pasif' },
];

const TYPE_OPTIONS = [
  { value: 'all', labelEn: 'All Types', labelTr: 'Tüm Tipler' },
  { value: 'single', labelEn: 'Single Email', labelTr: 'Tekli E-posta' },
  { value: 'digest', labelEn: 'Digest Email', labelTr: 'Özet E-posta' },
];

const FILTER_PRESETS_KEY = 'email_templates_filter_presets';

const EmailTemplatesTab: React.FC = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [usages, setUsages] = useState<Record<string, TemplateUsage[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [originalTemplate, setOriginalTemplate] = useState<EmailTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'name', 
    direction: 'asc' 
  });
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Saved filter presets
  const [savedPresets, setSavedPresets] = useState<SavedFilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  
  // Dialog states
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateTemplate, setDuplicateTemplate] = useState<EmailTemplate | null>(null);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [templateToDeactivate, setTemplateToDeactivate] = useState<EmailTemplate | null>(null);

  // Load saved presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(FILTER_PRESETS_KEY);
    if (saved) {
      try {
        setSavedPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved presets:', e);
      }
    }
  }, []);

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
        is_digest: t.is_digest ?? false,
        version: t.version || 1,
        created_at: t.created_at,
        updated_at: t.updated_at,
        last_sent_at: t.last_sent_at,
        send_count: t.send_count,
        error_count: t.error_count,
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
        description: language === 'tr' ? 'E-posta şablonları yüklenemedi' : 'Failed to fetch email templates',
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
        title: language === 'tr' ? 'Doğrulama Hatası' : 'Validation Error',
        description: language === 'tr' ? 'Konu ve içerik her iki dilde de zorunludur' : 'Subject and body are required in both languages',
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
        description: language === 'tr' ? 'Şablon başarıyla kaydedildi' : 'Template saved successfully',
      });

      fetchTemplates();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: t('error') as string,
        description: language === 'tr' ? 'Şablon kaydedilemedi' : 'Failed to save template',
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
    
    toast({ 
      title: language === 'tr' ? 'Varsayılana sıfırlandı' : 'Reset to default', 
      description: language === 'tr' ? 'Şablon içeriği orijinaline geri yüklendi' : 'Template content restored to original' 
    });
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
    
    toast({ 
      title: language === 'tr' ? 'Sürüm geri yüklendi' : 'Version restored', 
      description: language === 'tr' ? `Sürüm ${version.version}'e geri yüklendi` : `Restored to version ${version.version}` 
    });
  };

  const toggleActive = async (template: EmailTemplate) => {
    if (template.is_active) {
      setTemplateToDeactivate(template);
      setDeactivateConfirmOpen(true);
    } else {
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
        title: newStatus 
          ? (language === 'tr' ? 'Şablon Aktifleştirildi' : 'Template Activated')
          : (language === 'tr' ? 'Şablon Deaktif Edildi' : 'Template Deactivated'),
        description: `"${template.name}" ${newStatus 
          ? (language === 'tr' ? 'artık aktif' : 'is now active')
          : (language === 'tr' ? 'artık pasif' : 'is now inactive')}`
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
      if (!confirm(language === 'tr' ? 'Kaydedilmemiş değişiklikleriniz var. Kapatmak istediğinize emin misiniz?' : 'You have unsaved changes. Are you sure you want to close?')) return;
    }
    setDialogOpen(false);
    setEditingTemplate(null);
    setOriginalTemplate(null);
  };

  // Sorting
  const handleSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      if (prev.direction === 'desc') {
        return { key, direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key || sortConfig.direction === null) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Filter and sort templates
  const filteredAndSortedTemplates = useMemo(() => {
    let result = templates.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           t.template_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           t.subject_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           t.subject_tr.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter || 
                             (categoryFilter === 'digests' && t.is_digest);
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' && t.is_active) || 
                           (statusFilter === 'inactive' && !t.is_active);
      const matchesType = typeFilter === 'all' || 
                         (typeFilter === 'digest' && t.is_digest) || 
                         (typeFilter === 'single' && !t.is_digest);
      return matchesSearch && matchesCategory && matchesStatus && matchesType;
    });

    // Sort
    if (sortConfig.direction) {
      result = [...result].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortConfig.key) {
          case 'name':
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case 'category':
            aVal = a.category;
            bVal = b.category;
            break;
          case 'subject_en':
            aVal = a.subject_en.toLowerCase();
            bVal = b.subject_en.toLowerCase();
            break;
          case 'subject_tr':
            aVal = a.subject_tr.toLowerCase();
            bVal = b.subject_tr.toLowerCase();
            break;
          case 'last_sent_at':
            aVal = a.last_sent_at || '';
            bVal = b.last_sent_at || '';
            break;
          case 'send_count':
            aVal = a.send_count || 0;
            bVal = b.send_count || 0;
            break;
          case 'error_rate':
            aVal = (a.send_count && a.send_count > 0) ? ((a.error_count || 0) / a.send_count) : 0;
            bVal = (b.send_count && b.send_count > 0) ? ((b.error_count || 0) / b.send_count) : 0;
            break;
          case 'is_active':
            aVal = a.is_active ? 1 : 0;
            bVal = b.is_active ? 1 : 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [templates, searchQuery, categoryFilter, statusFilter, typeFilter, sortConfig]);

  // Paginated templates
  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedTemplates.slice(start, start + pageSize);
  }, [filteredAndSortedTemplates, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedTemplates.length / pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter, typeFilter]);

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? (language === 'tr' ? cat.labelTr : cat.labelEn) : category;
  };

  const getErrorRate = (template: EmailTemplate): string => {
    if (!template.send_count || template.send_count === 0) return '-';
    const rate = ((template.error_count || 0) / template.send_count) * 100;
    return `${rate.toFixed(1)}%`;
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Saved presets management
  const savePreset = () => {
    if (!presetName.trim()) return;
    
    const newPreset: SavedFilterPreset = {
      id: crypto.randomUUID(),
      name: presetName,
      searchQuery,
      categoryFilter,
      statusFilter,
      typeFilter,
    };
    
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(updated));
    setPresetName('');
    setShowSavePreset(false);
    toast({ 
      title: language === 'tr' ? 'Ön Ayar Kaydedildi' : 'Preset Saved',
      description: `"${presetName}" ${language === 'tr' ? 'kaydedildi' : 'saved'}`
    });
  };

  const loadPreset = (preset: SavedFilterPreset) => {
    setSearchQuery(preset.searchQuery);
    setCategoryFilter(preset.categoryFilter);
    setStatusFilter(preset.statusFilter);
    setTypeFilter(preset.typeFilter);
  };

  const deletePreset = (id: string) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(updated));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {language === 'tr' ? 'E-posta Şablonları' : 'Email Templates'}
            </CardTitle>
            <CardDescription>
              {language === 'tr' ? 'Hatırlatmalar ve bildirimler için e-posta şablonlarını yönetin' : 'Manage email templates for reminders and notifications'}
            </CardDescription>
          </div>
          <Button onClick={() => { setDuplicateTemplate(null); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'tr' ? 'Yeni Şablon' : 'New Template'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'tr' ? 'Şablon ara...' : 'Search templates...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={language === 'tr' ? 'Kategori' : 'Category'} />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {language === 'tr' ? cat.labelTr : cat.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={language === 'tr' ? 'Durum' : 'Status'} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {language === 'tr' ? opt.labelTr : opt.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={language === 'tr' ? 'Tip' : 'Type'} />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {language === 'tr' ? opt.labelTr : opt.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Saved Presets */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10">
                <Bookmark className="h-4 w-4 mr-2" />
                {language === 'tr' ? 'Ön Ayarlar' : 'Presets'}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {savedPresets.length > 0 ? (
                <>
                  {savedPresets.map(preset => (
                    <DropdownMenuItem key={preset.id} className="flex justify-between">
                      <span onClick={() => loadPreset(preset)} className="flex-1 cursor-pointer">
                        {preset.name}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 ml-2"
                        onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : (
                <DropdownMenuItem disabled>
                  {language === 'tr' ? 'Kaydedilmiş ön ayar yok' : 'No saved presets'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowSavePreset(true)}>
                <Save className="h-4 w-4 mr-2" />
                {language === 'tr' ? 'Mevcut Filtreleri Kaydet' : 'Save Current Filters'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
              <X className="h-4 w-4 mr-1" />
              {language === 'tr' ? 'Temizle' : 'Clear'}
            </Button>
          )}
        </div>

        {/* Save Preset Dialog */}
        {showSavePreset && (
          <div className="flex gap-2 mb-4 p-3 border rounded-lg bg-muted/50">
            <Input
              placeholder={language === 'tr' ? 'Ön ayar adı...' : 'Preset name...'}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="max-w-xs"
            />
            <Button size="sm" onClick={savePreset} disabled={!presetName.trim()}>
              <Save className="h-4 w-4 mr-1" />
              {language === 'tr' ? 'Kaydet' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowSavePreset(false)}>
              {language === 'tr' ? 'İptal' : 'Cancel'}
            </Button>
          </div>
        )}

        {/* Top Pagination */}
        <div className="mb-4">
          <DataTablePagination
            page={currentPage}
            pageSize={pageSize}
            totalCount={filteredAndSortedTemplates.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[200px]">
                    <button 
                      onClick={() => handleSort('name')} 
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      {language === 'tr' ? 'Şablon' : 'Template'}
                      {getSortIcon('name')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <button 
                      onClick={() => handleSort('category')} 
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      {language === 'tr' ? 'Kategori' : 'Category'}
                      {getSortIcon('category')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[180px]">
                    <button 
                      onClick={() => handleSort('subject_en')} 
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      {language === 'tr' ? 'Konu (EN)' : 'Subject EN'}
                      {getSortIcon('subject_en')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[180px]">
                    <button 
                      onClick={() => handleSort('subject_tr')} 
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      {language === 'tr' ? 'Konu (TR)' : 'Subject TR'}
                      {getSortIcon('subject_tr')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    {language === 'tr' ? 'Kullanıldığı Yer' : 'Used By'}
                  </TableHead>
                  <TableHead className="w-[140px]">
                    <button 
                      onClick={() => handleSort('last_sent_at')} 
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      {language === 'tr' ? 'Son Gönderim' : 'Last Sent'}
                      {getSortIcon('last_sent_at')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[80px] text-center">
                    <button 
                      onClick={() => handleSort('send_count')} 
                      className="flex items-center justify-center hover:text-foreground transition-colors w-full"
                    >
                      {language === 'tr' ? 'Gönderim' : 'Sent'}
                      {getSortIcon('send_count')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[80px] text-center">
                    <button 
                      onClick={() => handleSort('error_rate')} 
                      className="flex items-center justify-center hover:text-foreground transition-colors w-full"
                    >
                      {language === 'tr' ? 'Hata Oranı' : 'Error Rate'}
                      {getSortIcon('error_rate')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <button 
                      onClick={() => handleSort('is_active')} 
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      {language === 'tr' ? 'Durum' : 'Status'}
                      {getSortIcon('is_active')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    {language === 'tr' ? 'İşlemler' : 'Actions'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {language === 'tr' ? 'Şablon bulunamadı' : 'No templates found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTemplates.map((template) => (
                    <TableRow key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            {template.name}
                            {template.is_system && (
                              <Badge variant="secondary" className="text-xs">
                                {language === 'tr' ? 'Sistem' : 'System'}
                              </Badge>
                            )}
                            {template.is_digest && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {language === 'tr' ? 'Özet' : 'Digest'}
                              </Badge>
                            )}
                          </div>
                          <code className="text-xs text-muted-foreground">{template.template_key}</code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryLabel(template.category)}</Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-sm truncate block max-w-[160px]">
                                {template.subject_en}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              {template.subject_en}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-sm truncate block max-w-[160px]">
                                {template.subject_tr}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              {template.subject_tr}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                                  <TooltipContent>{u.schedule || (language === 'tr' ? 'Otomatik' : 'Automated')}</TooltipContent>
                                </Tooltip>
                              ))}
                              {usages[template.id].length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{usages[template.id].length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {language === 'tr' ? 'Kullanılmıyor' : 'Not used'}
                            </span>
                          )}
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(template.last_sent_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">
                          {template.send_count || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm ${
                          template.error_count && template.send_count && (template.error_count / template.send_count) > 0.1 
                            ? 'text-destructive font-medium' 
                            : 'text-muted-foreground'
                        }`}>
                          {getErrorRate(template)}
                        </span>
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
                              {language === 'tr' ? 'Pasif' : 'Inactive'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                            <Edit className="h-3 w-3 mr-1" />
                            {language === 'tr' ? 'Düzenle' : 'Edit'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Bottom Pagination */}
        <div className="mt-4">
          <DataTablePagination
            page={currentPage}
            pageSize={pageSize}
            totalCount={filteredAndSortedTemplates.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          {editingTemplate && (
            <EmailTemplateEditor
              template={{
                ...editingTemplate,
                variables_meta: editingTemplate.variables_meta || [],
              }}
              onChange={(t) => setEditingTemplate({ ...t, is_digest: editingTemplate.is_digest })}
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
        onOpenChange={setCreateOpen}
        duplicateFrom={duplicateTemplate}
        onCreated={fetchTemplates}
      />

      {/* Deactivate Confirmation */}
      <DeactivateConfirmDialog
        open={deactivateConfirmOpen}
        onOpenChange={setDeactivateConfirmOpen}
        templateId={templateToDeactivate?.id || ''}
        templateName={templateToDeactivate?.name || ''}
        onConfirm={() => {
          if (templateToDeactivate) {
            updateActiveStatus(templateToDeactivate, false);
          }
          setDeactivateConfirmOpen(false);
          setTemplateToDeactivate(null);
        }}
      />
    </Card>
  );
};

export default EmailTemplatesTab;
