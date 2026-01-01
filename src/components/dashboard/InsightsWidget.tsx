import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, staleTime } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  type: 'warning' | 'info' | 'success' | 'critical';
  icon: React.ReactNode;
  title: string;
  description: string;
  link?: string;
  count?: number;
}

interface InsightsWidgetProps {
  className?: string;
}

export function InsightsWidget({ className }: InsightsWidgetProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const { data: insights, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async (): Promise<Insight[]> => {
      const insightsList: Insight[] = [];

      // Check for aging inventory (lots older than 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const { count: agingCount } = await supabase
        .from('lots')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_stock')
        .lt('entry_date', ninetyDaysAgo.toISOString());

      if (agingCount && agingCount > 0) {
        insightsList.push({
          id: 'aging-inventory',
          type: 'warning',
          icon: <Clock className="h-4 w-4" />,
          title: 'Aging Inventory',
          description: `${agingCount} lots are older than 90 days`,
          link: '/inventory',
          count: agingCount,
        });
      }

      // Check for pending approvals
      const { count: approvalCount } = await supabase
        .from('field_edit_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (approvalCount && approvalCount > 0) {
        insightsList.push({
          id: 'pending-approvals',
          type: 'info',
          icon: <CheckCircle className="h-4 w-4" />,
          title: 'Pending Approvals',
          description: `${approvalCount} items need review`,
          link: '/approvals',
          count: approvalCount,
        });
      }

      // Check for active reservations
      const { count: activeCount } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (activeCount && activeCount > 5) {
        insightsList.push({
          id: 'active-reservations',
          type: 'info',
          icon: <AlertTriangle className="h-4 w-4" />,
          title: 'Active Reservations',
          description: `${activeCount} active reservations`,
          link: '/reservations',
          count: activeCount,
        });
      }

      // If no insights, show a success message
      if (insightsList.length === 0) {
        insightsList.push({
          id: 'all-good',
          type: 'success',
          icon: <CheckCircle className="h-4 w-4" />,
          title: 'All Good!',
          description: 'No immediate actions required',
        });
      }

      return insightsList;
    },
    staleTime: staleTime.dashboard,
  });

  const getTypeStyles = (type: Insight['type']) => {
    switch (type) {
      case 'critical':
        return 'border-l-destructive bg-destructive/5';
      case 'warning':
        return 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10';
      case 'success':
        return 'border-l-green-500 bg-green-50 dark:bg-green-900/10';
      default:
        return 'border-l-primary bg-primary/5';
    }
  };

  const getBadgeVariant = (type: Insight['type']): 'destructive' | 'secondary' | 'outline' | 'default' => {
    switch (type) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      case 'success':
        return 'outline';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Key Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Key Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights?.map((insight) => (
          <div
            key={insight.id}
            className={`p-3 rounded-lg border-l-4 ${getTypeStyles(insight.type)} ${
              insight.link ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
            }`}
            onClick={insight.link ? () => navigate(insight.link!) : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <div className="flex-shrink-0 mt-0.5">{insight.icon}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{insight.title}</span>
                    {insight.count && (
                      <Badge variant={getBadgeVariant(insight.type)} className="text-xs">
                        {insight.count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {insight.description}
                  </p>
                </div>
              </div>
              {insight.link && (
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
