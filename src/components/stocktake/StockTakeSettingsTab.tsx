import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Camera, Clock, Image, FileSearch } from 'lucide-react';

interface StockTakeSettings {
  ocr_timeout_seconds: number;
  max_retry_attempts: number;
  thumbnail_quality: number;
  session_timeout_minutes: number;
  auto_approve_high_confidence: boolean;
  require_recount_reason: boolean;
  photo_retention_months: number;
}

const DEFAULT_SETTINGS: StockTakeSettings = {
  ocr_timeout_seconds: 5,
  max_retry_attempts: 3,
  thumbnail_quality: 80,
  session_timeout_minutes: 30,
  auto_approve_high_confidence: false,
  require_recount_reason: true,
  photo_retention_months: 12,
};

const StockTakeSettingsTab: React.FC = () => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [settings, setSettings] = useState<StockTakeSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_settings')
        .select('setting_key, setting_value')
        .eq('setting_key', 'stocktake_settings')
        .maybeSingle();

      if (data && !error && data.setting_value) {
        const savedSettings = data.setting_value as unknown as Partial<StockTakeSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
      }
    } catch (error) {
      console.error('[StockTakeSettingsTab] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('email_settings')
        .select('id')
        .eq('setting_key', 'stocktake_settings')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('email_settings')
          .update({
            setting_value: settings as any,
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'stocktake_settings');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('email_settings')
          .insert([{
            setting_key: 'stocktake_settings',
            setting_value: settings as any,
          }]);

        if (error) throw error;
      }

      toast({
        title: language === 'tr' ? 'Başarılı' : 'Success',
        description: language === 'tr' ? 'Ayarlar kaydedildi' : 'Settings saved',
      });
      setHasChanges(false);
    } catch (error) {
      console.error('[StockTakeSettingsTab] Save error:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Ayarlar kaydedilemedi' : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof StockTakeSettings>(key: K, value: StockTakeSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OCR Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            {language === 'tr' ? 'OCR Ayarları' : 'OCR Settings'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Optik karakter tanıma işleme ayarları' 
              : 'Optical character recognition processing settings'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'OCR Zaman Aşımı (saniye)' : 'OCR Timeout (seconds)'}</Label>
              <Input
                type="number"
                min={3}
                max={30}
                value={settings.ocr_timeout_seconds}
                onChange={(e) => updateSetting('ocr_timeout_seconds', parseInt(e.target.value) || 5)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'tr' 
                  ? 'Bu süreden sonra manuel giriş seçeneği gösterilir'
                  : 'After this time, manual entry option will be shown'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Maksimum Deneme Sayısı' : 'Max Retry Attempts'}</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={settings.max_retry_attempts}
                onChange={(e) => updateSetting('max_retry_attempts', parseInt(e.target.value) || 3)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'tr' 
                  ? 'OCR başarısız olursa kaç kez yeniden denenecek'
                  : 'How many times to retry if OCR fails'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {language === 'tr' ? 'Oturum Ayarları' : 'Session Settings'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Sayım oturumu zaman aşımı ve davranış ayarları' 
              : 'Count session timeout and behavior settings'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Oturum Zaman Aşımı (dakika)' : 'Session Timeout (minutes)'}</Label>
              <Select
                value={String(settings.session_timeout_minutes)}
                onValueChange={(v) => updateSetting('session_timeout_minutes', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 {language === 'tr' ? 'dakika' : 'minutes'}</SelectItem>
                  <SelectItem value="30">30 {language === 'tr' ? 'dakika' : 'minutes'}</SelectItem>
                  <SelectItem value="60">1 {language === 'tr' ? 'saat' : 'hour'}</SelectItem>
                  <SelectItem value="120">2 {language === 'tr' ? 'saat' : 'hours'}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {language === 'tr' 
                  ? 'Hareketsizlik sonrası oturum zaman aşımı'
                  : 'Session timeout after inactivity'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{language === 'tr' ? 'Yeniden Sayım Sebebi Zorunlu' : 'Require Recount Reason'}</Label>
              <p className="text-xs text-muted-foreground">
                {language === 'tr' 
                  ? 'Admin yeniden sayım talep ederken sebep girmek zorunda'
                  : 'Admin must enter reason when requesting recount'}
              </p>
            </div>
            <Switch
              checked={settings.require_recount_reason}
              onCheckedChange={(v) => updateSetting('require_recount_reason', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Image Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            {language === 'tr' ? 'Görüntü Ayarları' : 'Image Settings'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Fotoğraf sıkıştırma ve saklama ayarları' 
              : 'Photo compression and storage settings'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Thumbnail Kalitesi (%)' : 'Thumbnail Quality (%)'}</Label>
              <Input
                type="number"
                min={50}
                max={100}
                value={settings.thumbnail_quality}
                onChange={(e) => updateSetting('thumbnail_quality', parseInt(e.target.value) || 80)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'tr' 
                  ? 'Düşük değer = küçük dosya, düşük kalite'
                  : 'Lower value = smaller file, lower quality'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Fotoğraf Saklama Süresi (ay)' : 'Photo Retention (months)'}</Label>
              <Select
                value={String(settings.photo_retention_months)}
                onValueChange={(v) => updateSetting('photo_retention_months', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 {language === 'tr' ? 'ay' : 'months'}</SelectItem>
                  <SelectItem value="12">12 {language === 'tr' ? 'ay' : 'months'}</SelectItem>
                  <SelectItem value="24">24 {language === 'tr' ? 'ay' : 'months'}</SelectItem>
                  <SelectItem value="36">36 {language === 'tr' ? 'ay' : 'months'}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {language === 'tr' 
                  ? 'Bu süreden sonra fotoğraflar otomatik silinir'
                  : 'Photos will be automatically deleted after this period'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {language === 'tr' ? 'İnceleme Ayarları' : 'Review Settings'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Admin inceleme süreci ayarları' 
              : 'Admin review process settings'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{language === 'tr' ? 'Yüksek Güvenli Otomatik Onay' : 'Auto-Approve High Confidence'}</Label>
              <p className="text-xs text-muted-foreground">
                {language === 'tr' 
                  ? 'OCR güveni yüksek ve manuel düzenleme yoksa otomatik onayla'
                  : 'Auto-approve if OCR confidence is high and no manual edits'}
              </p>
            </div>
            <Switch
              checked={settings.auto_approve_high_confidence}
              onCheckedChange={(v) => updateSetting('auto_approve_high_confidence', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {language === 'tr' ? 'Kaydediliyor...' : 'Saving...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {language === 'tr' ? 'Ayarları Kaydet' : 'Save Settings'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default StockTakeSettingsTab;
