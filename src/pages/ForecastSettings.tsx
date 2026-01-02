import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Sliders, 
  Loader2,
  Info,
  Target,
  TrendingUp
} from 'lucide-react';
import ForecastGlobalSettings from '@/components/forecast/ForecastGlobalSettings';
import ForecastPerQualityOverrides from '@/components/forecast/ForecastPerQualityOverrides';
import ForecastAccuracyChart from '@/components/forecast/ForecastAccuracyChart';

const ForecastSettings: React.FC = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('global');

  useEffect(() => {
    if (!permissionsLoading) {
      fetchSettings();
    }
  }, [permissionsLoading]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forecast_settings_global')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching forecast settings:', error);
      toast({
        title: t('error') as string,
        description: t('forecast.fetchSettingsError') as string || 'Failed to load settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canModifySettings = hasPermission('forecasting', 'modifyforecastsettings');
  const canViewSettings = hasPermission('forecasting', 'viewforecasts');

  if (!canViewSettings) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            {t('noPermission') || 'You do not have permission to view this page.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            {t('forecast.settings') || 'Forecast Settings'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('forecast.settingsDescription') || 'Configure forecasting parameters, overrides, and permissions'}
          </p>
        </div>
      </div>

      {!canModifySettings && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t('forecast.readOnlyMode') || 'You are viewing settings in read-only mode. Only admins can modify these settings.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="global" className="flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            {t('forecast.globalSettings') || 'Global Settings'}
          </TabsTrigger>
          <TabsTrigger value="overrides" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('forecast.perQualityOverrides') || 'Per-Quality Overrides'}
          </TabsTrigger>
          <TabsTrigger value="accuracy" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            {t('forecast.accuracy') || 'Accuracy'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global">
          <ForecastGlobalSettings 
            settings={settings} 
            onSettingsChange={setSettings}
            onRefresh={fetchSettings}
            readOnly={!canModifySettings}
          />
        </TabsContent>

        <TabsContent value="overrides">
          <ForecastPerQualityOverrides 
            globalSettings={settings}
            readOnly={!canModifySettings}
          />
        </TabsContent>

        <TabsContent value="accuracy">
          <ForecastAccuracyChart />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ForecastSettings;