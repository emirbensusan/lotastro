import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StockTakeSettings {
  ocr_timeout_seconds: number;
  max_retry_attempts: number;
  thumbnail_quality: number;
  session_timeout_minutes: number;
  auto_approve_high_confidence: boolean;
  require_recount_reason: boolean;
  photo_retention_months: number;
  preprocessing_enabled: boolean;
  preprocessing_grayscale: boolean;
  preprocessing_contrast: boolean;
  preprocessing_contrast_level: number;
  preprocessing_sharpen: boolean;
  preprocessing_sharpen_level: number;
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
  preprocessing_enabled: true,
  preprocessing_grayscale: true,
  preprocessing_contrast: true,
  preprocessing_contrast_level: 20,
  preprocessing_sharpen: true,
  preprocessing_sharpen_level: 30,
  retry_enabled: true,
  retry_max_attempts: 3,
  retry_base_delay_seconds: 1,
  backup_enabled: true,
};

export const useStockTakeSettings = () => {
  const [settings, setSettings] = useState<StockTakeSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('email_settings')
          .select('setting_value')
          .eq('setting_key', 'stocktake_settings')
          .maybeSingle();

        if (data && !error && data.setting_value) {
          const savedSettings = data.setting_value as unknown as Partial<StockTakeSettings>;
          setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
        }
      } catch (error) {
        console.error('[useStockTakeSettings] Fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, isLoading };
};
