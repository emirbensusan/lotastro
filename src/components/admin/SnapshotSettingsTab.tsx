import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Camera, Clock, Database, Loader2, Save, HardDrive, Calendar, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface SnapshotSettings {
  id: string;
  is_enabled: boolean;
  snapshot_time_utc: string;
  retention_years: number;
  include_lot_details: boolean;
  include_quality_breakdown: boolean;
  include_color_breakdown: boolean;
  include_customer_breakdown: boolean;
  last_snapshot_at: string | null;
  last_snapshot_status: string | null;
  last_snapshot_error: string | null;
}

interface SnapshotStats {
  inventory_count: number;
  order_count: number;
  reservation_count: number;
  oldest_date: string | null;
  newest_date: string | null;
}

const SnapshotSettingsTab: React.FC = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SnapshotSettings | null>(null);
  const [stats, setStats] = useState<SnapshotStats>({
    inventory_count: 0,
    order_count: 0,
    reservation_count: 0,
    oldest_date: null,
    newest_date: null,
  });

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('snapshot_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching snapshot settings:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Ayarlar yüklenemedi' : 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get inventory snapshot count and date range
      const { count: invCount } = await supabase
        .from('inventory_snapshots')
        .select('*', { count: 'exact', head: true });

      const { data: invDates } = await supabase
        .from('inventory_snapshots')
        .select('snapshot_date')
        .order('snapshot_date', { ascending: true })
        .limit(1);

      const { data: invLatest } = await supabase
        .from('inventory_snapshots')
        .select('snapshot_date')
        .order('snapshot_date', { ascending: false })
        .limit(1);

      const { count: orderCount } = await supabase
        .from('order_snapshots')
        .select('*', { count: 'exact', head: true });

      const { count: resCount } = await supabase
        .from('reservation_snapshots')
        .select('*', { count: 'exact', head: true });

      setStats({
        inventory_count: invCount || 0,
        order_count: orderCount || 0,
        reservation_count: resCount || 0,
        oldest_date: invDates?.[0]?.snapshot_date || null,
        newest_date: invLatest?.[0]?.snapshot_date || null,
      });
    } catch (error) {
      console.error('Error fetching snapshot stats:', error);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('snapshot_settings')
        .update({
          is_enabled: settings.is_enabled,
          snapshot_time_utc: settings.snapshot_time_utc,
          retention_years: settings.retention_years,
          include_lot_details: settings.include_lot_details,
          include_quality_breakdown: settings.include_quality_breakdown,
          include_color_breakdown: settings.include_color_breakdown,
          include_customer_breakdown: settings.include_customer_breakdown,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: language === 'tr' ? 'Başarılı' : 'Success',
        description: language === 'tr' ? 'Ayarlar kaydedildi' : 'Settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Ayarlar kaydedilemedi' : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const estimateStorage = () => {
    // Rough estimates per snapshot
    let bytesPerDay = 500; // Base totals
    if (settings?.include_lot_details) bytesPerDay += 10000; // ~10KB for lot details
    if (settings?.include_quality_breakdown) bytesPerDay += 5000; // ~5KB
    if (settings?.include_color_breakdown) bytesPerDay += 15000; // ~15KB
    if (settings?.include_customer_breakdown) bytesPerDay += 3000; // ~3KB

    const daysPerYear = 365;
    const years = settings?.retention_years || 10;
    const totalBytes = bytesPerDay * daysPerYear * years;
    
    if (totalBytes > 1024 * 1024 * 1024) {
      return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } else if (totalBytes > 1024 * 1024) {
      return `${(totalBytes / (1024 * 1024)).toFixed(0)} MB`;
    }
    return `${(totalBytes / 1024).toFixed(0)} KB`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          {language === 'tr' ? 'Ayarlar bulunamadı' : 'Settings not found'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {language === 'tr' ? 'Günlük Anlık Görüntüler' : 'Daily Snapshots'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Envanter, sipariş ve rezervasyon verilerinin günlük anlık görüntülerini oluşturun'
              : 'Create daily snapshots of inventory, orders, and reservations data'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                {language === 'tr' ? 'Günlük anlık görüntüleri etkinleştir' : 'Enable daily snapshots'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' 
                  ? 'Her gün gece yarısı otomatik olarak anlık görüntü oluşturur'
                  : 'Automatically create snapshots every day at midnight'}
              </p>
            </div>
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
            />
          </div>

          {/* Time and Retention Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {language === 'tr' ? 'Anlık Görüntü Zamanı (UTC)' : 'Snapshot Time (UTC)'}
              </Label>
              <Select
                value={settings.snapshot_time_utc}
                onValueChange={(value) => setSettings({ ...settings, snapshot_time_utc: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="00:00:00">00:00 UTC (Midnight)</SelectItem>
                  <SelectItem value="03:00:00">03:00 UTC</SelectItem>
                  <SelectItem value="06:00:00">06:00 UTC</SelectItem>
                  <SelectItem value="21:00:00">21:00 UTC (Midnight Istanbul)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                21:00 UTC = {language === 'tr' ? 'Gece yarısı (İstanbul)' : 'Midnight (Istanbul time)'}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {language === 'tr' ? 'Saklama Süresi (Yıl)' : 'Retention Period (Years)'}
              </Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={settings.retention_years}
                onChange={(e) => setSettings({ ...settings, retention_years: parseInt(e.target.value) || 10 })}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'tr' 
                  ? `${settings.retention_years} yıldan eski anlık görüntüler otomatik silinir`
                  : `Snapshots older than ${settings.retention_years} years are automatically deleted`}
              </p>
            </div>
          </div>

          {/* Data to Capture */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              {language === 'tr' ? 'Kaydedilecek Veriler' : 'Data to Capture'}
            </Label>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{language === 'tr' ? 'Lot Detayları' : 'Lot Details'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'tr' ? 'Her lot için metre ve durum bilgisi' : 'Meters and status for each lot'}
                  </p>
                </div>
                <Switch
                  checked={settings.include_lot_details}
                  onCheckedChange={(checked) => setSettings({ ...settings, include_lot_details: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{language === 'tr' ? 'Kalite Dağılımı' : 'Quality Breakdown'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'tr' ? 'Kaliteye göre toplam metre' : 'Aggregated meters by quality'}
                  </p>
                </div>
                <Switch
                  checked={settings.include_quality_breakdown}
                  onCheckedChange={(checked) => setSettings({ ...settings, include_quality_breakdown: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{language === 'tr' ? 'Renk Dağılımı' : 'Color Breakdown'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'tr' ? 'Renge göre toplam metre' : 'Aggregated meters by color'}
                  </p>
                </div>
                <Switch
                  checked={settings.include_color_breakdown}
                  onCheckedChange={(checked) => setSettings({ ...settings, include_color_breakdown: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{language === 'tr' ? 'Müşteri Dağılımı' : 'Customer Breakdown'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'tr' ? 'Sipariş ve rezervasyonlar için müşteri dağılımı' : 'Customer distribution for orders and reservations'}
                  </p>
                </div>
                <Switch
                  checked={settings.include_customer_breakdown}
                  onCheckedChange={(checked) => setSettings({ ...settings, include_customer_breakdown: checked })}
                />
              </div>
            </div>
          </div>

          {/* Storage Estimate */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-4 w-4" />
              <span className="font-medium">
                {language === 'tr' ? 'Tahmini Depolama' : 'Estimated Storage'}
              </span>
            </div>
            <p className="text-2xl font-bold">{estimateStorage()}</p>
            <p className="text-sm text-muted-foreground">
              {language === 'tr' 
                ? `${settings.retention_years} yıl için tahmini toplam boyut`
                : `Estimated total size over ${settings.retention_years} years`}
            </p>
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {language === 'tr' ? 'Ayarları Kaydet' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Snapshot Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {language === 'tr' ? 'Anlık Görüntü İstatistikleri' : 'Snapshot Statistics'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <p className="text-3xl font-bold">{stats.inventory_count}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Envanter Anlık Görüntüsü' : 'Inventory Snapshots'}
              </p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-3xl font-bold">{stats.order_count}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Sipariş Anlık Görüntüsü' : 'Order Snapshots'}
              </p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-3xl font-bold">{stats.reservation_count}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Rezervasyon Anlık Görüntüsü' : 'Reservation Snapshots'}
              </p>
            </div>
          </div>

          {stats.oldest_date && stats.newest_date && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="font-medium">{language === 'tr' ? 'Tarih Aralığı:' : 'Date Range:'}</span>{' '}
                {format(new Date(stats.oldest_date), 'dd MMM yyyy')} - {format(new Date(stats.newest_date), 'dd MMM yyyy')}
              </p>
            </div>
          )}

          {settings.last_snapshot_at && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">
                {language === 'tr' ? 'Son anlık görüntü:' : 'Last snapshot:'}{' '}
                {format(new Date(settings.last_snapshot_at), 'dd MMM yyyy HH:mm')}
              </span>
              {settings.last_snapshot_status && (
                <Badge variant={settings.last_snapshot_status === 'success' ? 'default' : 'destructive'}>
                  {settings.last_snapshot_status}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SnapshotSettingsTab;
