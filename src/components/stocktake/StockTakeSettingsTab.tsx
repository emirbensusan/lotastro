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
import { Loader2, Save, Camera, Clock, Image, FileSearch, Wand2, RefreshCw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface StockTakeSettings {
  ocr_timeout_seconds: number;
  max_retry_attempts: number;
  thumbnail_quality: number;
  session_timeout_minutes: number;
  auto_approve_high_confidence: boolean;
  require_recount_reason: boolean;
  photo_retention_months: number;
  // Image preprocessing settings
  preprocessing_enabled: boolean;
  preprocessing_grayscale: boolean;
  preprocessing_contrast: boolean;
  preprocessing_contrast_level: number;
  preprocessing_sharpen: boolean;
  preprocessing_sharpen_level: number;
  // Retry & backup settings
  retry_enabled: boolean;
  retry_max_attempts: number;
  retry_base_delay_seconds: number;
  backup_enabled: boolean;
}

const DEFAULT_SETTINGS: StockTakeSettings = {
  ocr_timeout_seconds: 5,
  max_retry_attempts: 3,
  thumbnail_quality: 80,
  session_timeout_minutes: 5,
  auto_approve_high_confidence: false,
  require_recount_reason: true,
  photo_retention_months: 12,
  // Preprocessing defaults - enabled
  preprocessing_enabled: true,
  preprocessing_grayscale: true,
  preprocessing_contrast: true,
  preprocessing_contrast_level: 20,
  preprocessing_sharpen: true,
  preprocessing_sharpen_level: 30,
  // Retry & backup defaults - enabled
  retry_enabled: true,
  retry_max_attempts: 3,
  retry_base_delay_seconds: 1,
  backup_enabled: true,
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
                  <SelectItem value="5">5 {language === 'tr' ? 'dakika' : 'minutes'}</SelectItem>
                  <SelectItem value="10">10 {language === 'tr' ? 'dakika' : 'minutes'}</SelectItem>
                  <SelectItem value="15">15 {language === 'tr' ? 'dakika' : 'minutes'}</SelectItem>
                  <SelectItem value="30">30 {language === 'tr' ? 'dakika' : 'minutes'}</SelectItem>
                  <SelectItem value="60">1 {language === 'tr' ? 'saat' : 'hour'}</SelectItem>
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

      {/* Image Preprocessing Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            {language === 'tr' ? 'Görüntü Ön İşleme' : 'Image Preprocessing'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'OCR doğruluğunu artırmak için görüntü işleme ayarları' 
              : 'Image processing settings to improve OCR accuracy'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                {language === 'tr' ? 'Ön İşleme Etkin' : 'Preprocessing Enabled'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' 
                  ? 'OCR öncesi görüntü iyileştirme uygula'
                  : 'Apply image enhancement before OCR processing'}
              </p>
            </div>
            <Switch
              checked={settings.preprocessing_enabled}
              onCheckedChange={(v) => updateSetting('preprocessing_enabled', v)}
            />
          </div>

          {/* Individual preprocessing options - only shown when enabled */}
          {settings.preprocessing_enabled && (
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              {/* Grayscale */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{language === 'tr' ? 'Gri Tonlama' : 'Grayscale Conversion'}</Label>
                  <p className="text-xs text-muted-foreground">
                    {language === 'tr' 
                      ? 'Görüntüyü siyah-beyaza çevir (metin okunabilirliğini artırır)'
                      : 'Convert image to black & white (improves text readability)'}
                  </p>
                </div>
                <Switch
                  checked={settings.preprocessing_grayscale}
                  onCheckedChange={(v) => updateSetting('preprocessing_grayscale', v)}
                />
              </div>

              {/* Contrast */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{language === 'tr' ? 'Kontrast Artırma' : 'Contrast Enhancement'}</Label>
                    <p className="text-xs text-muted-foreground">
                      {language === 'tr' 
                        ? 'Metin ve arka plan arasındaki farkı artır'
                        : 'Increase difference between text and background'}
                    </p>
                  </div>
                  <Switch
                    checked={settings.preprocessing_contrast}
                    onCheckedChange={(v) => updateSetting('preprocessing_contrast', v)}
                  />
                </div>
                {settings.preprocessing_contrast && (
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">
                        {language === 'tr' ? 'Seviye' : 'Level'}: {settings.preprocessing_contrast_level}%
                      </Label>
                    </div>
                    <Slider
                      value={[settings.preprocessing_contrast_level]}
                      onValueChange={([v]) => updateSetting('preprocessing_contrast_level', v)}
                      min={10}
                      max={50}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Sharpen */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{language === 'tr' ? 'Keskinleştirme' : 'Sharpening'}</Label>
                    <p className="text-xs text-muted-foreground">
                      {language === 'tr' 
                        ? 'Bulanık görüntülerde metin kenarlarını belirginleştir'
                        : 'Enhance text edges in blurry images'}
                    </p>
                  </div>
                  <Switch
                    checked={settings.preprocessing_sharpen}
                    onCheckedChange={(v) => updateSetting('preprocessing_sharpen', v)}
                  />
                </div>
                {settings.preprocessing_sharpen && (
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">
                        {language === 'tr' ? 'Seviye' : 'Level'}: {settings.preprocessing_sharpen_level}%
                      </Label>
                    </div>
                    <Slider
                      value={[settings.preprocessing_sharpen_level]}
                      onValueChange={([v]) => updateSetting('preprocessing_sharpen_level', v)}
                      min={10}
                      max={60}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retry & Backup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {language === 'tr' ? 'Yeniden Deneme & Yedekleme' : 'Retry & Backup'}
          </CardTitle>
          <CardDescription>
            {language === 'tr' 
              ? 'Ağ hatalarında otomatik yeniden deneme ve yerel yedekleme ayarları' 
              : 'Auto-retry on network failures and local backup settings'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Backup toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                {language === 'tr' ? 'Yerel Yedekleme' : 'Local Backup'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' 
                  ? 'Yükleme öncesi fotoğrafları cihazda yedekle'
                  : 'Backup photos locally before upload'}
              </p>
            </div>
            <Switch
              checked={settings.backup_enabled}
              onCheckedChange={(v) => updateSetting('backup_enabled', v)}
            />
          </div>

          {/* Retry toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                {language === 'tr' ? 'Otomatik Yeniden Deneme' : 'Auto Retry'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' 
                  ? 'Başarısız yüklemeleri otomatik olarak yeniden dene'
                  : 'Automatically retry failed uploads'}
              </p>
            </div>
            <Switch
              checked={settings.retry_enabled}
              onCheckedChange={(v) => updateSetting('retry_enabled', v)}
            />
          </div>

          {/* Retry options - only shown when enabled */}
          {settings.retry_enabled && (
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Maksimum Deneme' : 'Max Attempts'}</Label>
                  <Select
                    value={String(settings.retry_max_attempts)}
                    onValueChange={(v) => updateSetting('retry_max_attempts', parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {language === 'tr' 
                      ? 'Başarısız yükleme için maksimum deneme sayısı'
                      : 'Maximum retry attempts for failed uploads'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Bekleme Süresi (sn)' : 'Base Delay (sec)'}</Label>
                  <Select
                    value={String(settings.retry_base_delay_seconds)}
                    onValueChange={(v) => updateSetting('retry_base_delay_seconds', parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 {language === 'tr' ? 'saniye' : 'second'}</SelectItem>
                      <SelectItem value="2">2 {language === 'tr' ? 'saniye' : 'seconds'}</SelectItem>
                      <SelectItem value="5">5 {language === 'tr' ? 'saniye' : 'seconds'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {language === 'tr' 
                      ? 'Her deneme arasında bekleme süresi (üstel artış)'
                      : 'Delay between retries (exponential backoff)'}
                  </p>
                </div>
              </div>
            </div>
          )}
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
