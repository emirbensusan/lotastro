import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Edit, Trash2, Search, Loader2, AlertCircle } from 'lucide-react';

interface Override {
  id: string;
  quality_code: string;
  color_code: string;
  lead_time_days: number | null;
  safety_stock_weeks: number | null;
  safety_stock_mode: string | null;
  target_coverage_weeks: number | null;
  min_recommended_order: number | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  globalSettings: any;
  readOnly: boolean;
}

const ForecastPerQualityOverrides: React.FC<Props> = ({ globalSettings, readOnly }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<Override | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    quality_code: '',
    color_code: '',
    lead_time_days: '',
    safety_stock_weeks: '',
    safety_stock_mode: '',
    target_coverage_weeks: '',
    min_recommended_order: '',
  });

  useEffect(() => {
    fetchOverrides();
  }, []);

  const fetchOverrides = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forecast_settings_per_quality')
        .select('*')
        .order('quality_code', { ascending: true });

      if (error) throw error;
      setOverrides(data || []);
    } catch (error) {
      console.error('Error fetching overrides:', error);
      toast({
        title: t('error') as string,
        description: 'Failed to load overrides',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (override?: Override) => {
    if (override) {
      setEditingOverride(override);
      setFormData({
        quality_code: override.quality_code,
        color_code: override.color_code,
        lead_time_days: override.lead_time_days?.toString() || '',
        safety_stock_weeks: override.safety_stock_weeks?.toString() || '',
        safety_stock_mode: override.safety_stock_mode || '',
        target_coverage_weeks: override.target_coverage_weeks?.toString() || '',
        min_recommended_order: override.min_recommended_order?.toString() || '',
      });
    } else {
      setEditingOverride(null);
      setFormData({
        quality_code: '',
        color_code: '',
        lead_time_days: '',
        safety_stock_weeks: '',
        safety_stock_mode: '',
        target_coverage_weeks: '',
        min_recommended_order: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.quality_code || !formData.color_code) {
      toast({
        title: t('error') as string,
        description: t('forecast.qualityColorRequired') as string || 'Quality and color are required',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        quality_code: formData.quality_code.toUpperCase(),
        color_code: formData.color_code.toUpperCase(),
        lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
        safety_stock_weeks: formData.safety_stock_weeks ? parseFloat(formData.safety_stock_weeks) : null,
        safety_stock_mode: formData.safety_stock_mode || null,
        target_coverage_weeks: formData.target_coverage_weeks ? parseFloat(formData.target_coverage_weeks) : null,
        min_recommended_order: formData.min_recommended_order ? parseFloat(formData.min_recommended_order) : null,
        updated_by: user?.id,
      };

      if (editingOverride) {
        // Log audit
        await supabase.from('forecast_settings_audit_log').insert([{
          changed_by: user?.id || '',
          scope: 'per_quality' as const,
          quality_code: payload.quality_code,
          color_code: payload.color_code,
          parameter_name: 'override_update',
          old_value: JSON.parse(JSON.stringify(editingOverride)),
          new_value: JSON.parse(JSON.stringify(payload)),
        }]);

        const { error } = await supabase
          .from('forecast_settings_per_quality')
          .update(payload)
          .eq('id', editingOverride.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('forecast_settings_per_quality')
          .insert({ ...payload, created_by: user?.id });

        if (error) throw error;

        // Log audit
        await supabase.from('forecast_settings_audit_log').insert([{
          changed_by: user?.id || '',
          scope: 'per_quality' as const,
          quality_code: payload.quality_code,
          color_code: payload.color_code,
          parameter_name: 'override_create',
          new_value: JSON.parse(JSON.stringify(payload)),
        }]);
      }

      toast({
        title: t('success') as string,
        description: editingOverride ? 'Override updated' : 'Override created',
      });
      setDialogOpen(false);
      fetchOverrides();
    } catch (error: any) {
      console.error('Error saving override:', error);
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (override: Override) => {
    if (!confirm(t('forecast.confirmDeleteOverride') as string || 'Are you sure you want to delete this override?')) {
      return;
    }

    try {
      // Log audit
      await supabase.from('forecast_settings_audit_log').insert([{
        changed_by: user?.id || '',
        scope: 'per_quality' as const,
        quality_code: override.quality_code,
        color_code: override.color_code,
        parameter_name: 'override_delete',
        old_value: JSON.parse(JSON.stringify(override)),
      }]);

      const { error } = await supabase
        .from('forecast_settings_per_quality')
        .delete()
        .eq('id', override.id);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: 'Override deleted',
      });
      fetchOverrides();
    } catch (error: any) {
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const filteredOverrides = overrides.filter(o => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return o.quality_code.toLowerCase().includes(query) || 
           o.color_code.toLowerCase().includes(query);
  });

  const tintColor = globalSettings?.override_row_tint_color || '#FEF3C7';

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{t('forecast.perQualityOverrides') || 'Per-Quality Overrides'}</CardTitle>
            <CardDescription>
              {t('forecast.perQualityOverridesDesc') || 'Set custom parameters for specific quality-color combinations'}
            </CardDescription>
          </div>
          {!readOnly && (
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addOverride') || 'Add Override'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchQualityColor') || 'Search quality or color...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Info about tinting */}
        <div 
          className="flex items-center gap-2 p-3 rounded-lg text-sm"
          style={{ backgroundColor: tintColor }}
        >
          <AlertCircle className="h-4 w-4" />
          {t('forecast.overrideRowsWillBeTinted') || 'Rows with overrides will be highlighted with this color in the forecast grid.'}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredOverrides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? t('noResultsFound') || 'No results found' : t('forecast.noOverridesYet') || 'No overrides configured yet'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('quality') || 'Quality'}</TableHead>
                <TableHead>{t('color') || 'Color'}</TableHead>
                <TableHead className="text-right">{t('forecast.leadTimeDays') || 'Lead Time (days)'}</TableHead>
                <TableHead className="text-right">{t('forecast.safetyStockWeeks') || 'Safety Stock (weeks)'}</TableHead>
                <TableHead className="text-right">{t('forecast.targetCoverage') || 'Target Coverage (weeks)'}</TableHead>
                <TableHead className="text-right">{t('forecast.minOrder') || 'Min Order'}</TableHead>
                <TableHead>{t('actions') || 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOverrides.map((override) => {
                const bgStyle = { backgroundColor: tintColor };
                return (
                <TableRow key={override.id} style={bgStyle}>
                  <TableCell className="font-medium">{override.quality_code}</TableCell>
                  <TableCell>{override.color_code}</TableCell>
                  <TableCell className="text-right">
                    {override.lead_time_days !== null ? String(override.lead_time_days) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {override.safety_stock_weeks !== null ? String(override.safety_stock_weeks) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {override.target_coverage_weeks !== null ? String(override.target_coverage_weeks) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {override.min_recommended_order !== null ? String(override.min_recommended_order) : '—'}
                <TableHead>{t('color') || 'Color'}</TableHead>
                <TableHead className="text-right">{t('forecast.leadTimeDays') || 'Lead Time (days)'}</TableHead>
                <TableHead className="text-right">{t('forecast.safetyStockWeeks') || 'Safety Stock (weeks)'}</TableHead>
                <TableHead className="text-right">{t('forecast.targetCoverage') || 'Target Coverage (weeks)'}</TableHead>
                <TableHead className="text-right">{t('forecast.minOrder') || 'Min Order'}</TableHead>
                <TableHead>{t('actions') || 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOverrides.map((override) => (
                <TableRow key={override.id} style={{ backgroundColor: tintColor }}>
                  <TableCell className="font-medium">{override.quality_code}</TableCell>
                  <TableCell>{override.color_code}</TableCell>
                  <TableCell className="text-right">
                    {override.lead_time_days !== null ? override.lead_time_days : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {override.safety_stock_weeks !== null ? override.safety_stock_weeks : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {override.target_coverage_weeks !== null ? override.target_coverage_weeks : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {override.min_recommended_order !== null ? override.min_recommended_order : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {!readOnly && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openDialog(override)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(override)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingOverride ? t('forecast.editOverride') || 'Edit Override' : t('forecast.addOverride') || 'Add Override'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('quality') || 'Quality'} *</Label>
                  <Input
                    value={formData.quality_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, quality_code: e.target.value }))}
                    placeholder="e.g., V710"
                    disabled={!!editingOverride}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('color') || 'Color'} *</Label>
                  <Input
                    value={formData.color_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, color_code: e.target.value }))}
                    placeholder="e.g., RED"
                    disabled={!!editingOverride}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('forecast.leadTimeDays') || 'Lead Time (days)'}</Label>
                  <Input
                    type="number"
                    value={formData.lead_time_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, lead_time_days: e.target.value }))}
                    placeholder={`Default: ${globalSettings?.default_lead_time_days || 30}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('forecast.safetyStockWeeks') || 'Safety Stock (weeks)'}</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.safety_stock_weeks}
                    onChange={(e) => setFormData(prev => ({ ...prev, safety_stock_weeks: e.target.value }))}
                    placeholder={`Default: ${globalSettings?.default_safety_stock_weeks || 2}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('forecast.targetCoverage') || 'Target Coverage (weeks)'}</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.target_coverage_weeks}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_coverage_weeks: e.target.value }))}
                    placeholder="Auto-calculated"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('forecast.minOrder') || 'Min Recommended Order'}</Label>
                  <Input
                    type="number"
                    value={formData.min_recommended_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_recommended_order: e.target.value }))}
                    placeholder={`Default: ${globalSettings?.min_order_zero_history || 0}`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('forecast.safetyStockMode') || 'Safety Stock Mode'}</Label>
                <Select
                  value={formData.safety_stock_mode}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, safety_stock_mode: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('useDefault') || 'Use default'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weeks">{t('forecast.weeksOfCoverage') || 'Weeks of Coverage'}</SelectItem>
                    <SelectItem value="min_units">{t('forecast.minimumUnits') || 'Minimum Units'}</SelectItem>
                    <SelectItem value="min_per_color">{t('forecast.minPerColor') || 'Minimum per Color'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('save') || 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ForecastPerQualityOverrides;