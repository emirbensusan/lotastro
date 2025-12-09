import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { 
  Package, 
  TrendingUp, 
  Clock, 
  ShieldCheck,
  Loader2,
  CheckCircle,
  Calendar
} from 'lucide-react';

interface Recommendation {
  id: string;
  quality_code: string;
  color_code: string;
  unit: string;
  available_stock: number;
  incoming_stock: number;
  in_production_stock: number;
  total_stock_position: number;
  past_12m_demand: number;
  forecasted_lead_time_demand: number;
  safety_stock_value: number;
  conservative_recommendation: number;
  normal_recommendation: number;
  aggressive_recommendation: number;
  lead_time_days: number;
  target_coverage_weeks: number;
  has_quality_override: boolean;
  status: string;
  last_order_date: string | null;
  notes: string | null;
}

interface ForecastResult {
  id: string;
  period_start: string;
  period_end: string;
  scenario: string;
  forecast_amount: number;
  historical_avg: number | null;
  weighted_avg: number | null;
  trend_factor: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendation: Recommendation | null;
  latestRunId?: string;
}

const ForecastDetailDrawer: React.FC<Props> = ({ open, onOpenChange, recommendation, latestRunId }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && recommendation && latestRunId) {
      fetchForecastResults();
      setNotes(recommendation.notes || '');
    }
  }, [open, recommendation, latestRunId]);

  const fetchForecastResults = async () => {
    if (!recommendation || !latestRunId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forecast_results')
        .select('*')
        .eq('run_id', latestRunId)
        .eq('quality_code', recommendation.quality_code)
        .eq('color_code', recommendation.color_code)
        .order('period_start', { ascending: true });

      if (error) throw error;
      setForecastResults(data || []);
    } catch (error) {
      console.error('Error fetching forecast results:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsReviewed = async () => {
    if (!recommendation) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('purchase_recommendations')
        .update({
          status: 'reviewed',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          notes: notes || null
        })
        .eq('id', recommendation.id);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: t('forecast.markedAsReviewed') || 'Marked as reviewed',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('error') as string,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (!recommendation) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {recommendation.quality_code} - {recommendation.color_code}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <Badge variant={recommendation.status === 'reviewed' ? 'default' : 'secondary'}>
              {recommendation.status}
            </Badge>
            {recommendation.has_quality_override && (
              <Badge variant="outline">Has Override</Badge>
            )}
          </div>

          {/* Stock Position */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t('forecast.stockPosition') || 'Stock Position'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('forecast.availableStock') || 'Available Stock'}</span>
                <span className="font-medium">{recommendation.available_stock.toLocaleString()} {recommendation.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('forecast.incoming') || 'Incoming'}</span>
                <span className="font-medium">{recommendation.incoming_stock.toLocaleString()} {recommendation.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('forecast.inProduction') || 'In Production'}</span>
                <span className="font-medium">{recommendation.in_production_stock.toLocaleString()} {recommendation.unit}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">{t('forecast.totalPosition') || 'Total Position'}</span>
                <span className="font-bold">{recommendation.total_stock_position.toLocaleString()} {recommendation.unit}</span>
              </div>
            </CardContent>
          </Card>

          {/* Demand Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t('forecast.demandInfo') || 'Demand Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('forecast.past12mDemand') || 'Past 12M Demand'}</span>
                <span className="font-medium">{recommendation.past_12m_demand.toLocaleString()} {recommendation.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('forecast.leadTimeDemand') || 'Lead Time Demand'}</span>
                <span className="font-medium">{recommendation.forecasted_lead_time_demand.toLocaleString()} {recommendation.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('forecast.safetyStock') || 'Safety Stock'}</span>
                <span className="font-medium">{recommendation.safety_stock_value.toLocaleString()} {recommendation.unit}</span>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('forecast.parameters') || 'Parameters'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('forecast.leadTime') || 'Lead Time'}</span>
                <span className="font-medium">{recommendation.lead_time_days} {t('days') || 'days'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('forecast.targetCoverage') || 'Target Coverage'}</span>
                <span className="font-medium">{recommendation.target_coverage_weeks} {t('weeks') || 'weeks'}</span>
              </div>
              {recommendation.last_order_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('forecast.lastOrderDate') || 'Last Order Date'}</span>
                  <span className="font-medium">{new Date(recommendation.last_order_date).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {t('forecast.recommendations') || 'Recommendations'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">{t('forecast.conservative') || 'Conservative'}</span>
                <span className="font-medium">{recommendation.conservative_recommendation.toLocaleString()} {recommendation.unit}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-primary/10 border border-primary/20">
                <span className="font-medium">{t('forecast.normal') || 'Normal'}</span>
                <span className="font-bold text-primary">{recommendation.normal_recommendation.toLocaleString()} {recommendation.unit}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">{t('forecast.aggressive') || 'Aggressive'}</span>
                <span className="font-medium">{recommendation.aggressive_recommendation.toLocaleString()} {recommendation.unit}</span>
              </div>
            </CardContent>
          </Card>

          {/* Forecast by Period */}
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : forecastResults.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('forecast.byPeriod') || 'Forecast by Period'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {forecastResults.filter(r => r.scenario === 'normal').map(result => (
                    <div key={result.id} className="flex justify-between text-sm p-2 rounded bg-muted/30">
                      <span className="text-muted-foreground">
                        {new Date(result.period_start).toLocaleDateString()} - {new Date(result.period_end).toLocaleDateString()}
                      </span>
                      <span className="font-medium">{result.forecast_amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{String(t('notes') || 'Notes')}</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={String(t('forecast.addNotes') || 'Add notes...')}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('close') || 'Close'}
            </Button>
            {recommendation.status !== 'reviewed' && (
              <Button className="flex-1" onClick={markAsReviewed} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {t('forecast.markReviewed') || 'Mark as Reviewed'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ForecastDetailDrawer;
