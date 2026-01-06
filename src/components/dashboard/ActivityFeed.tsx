import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Package,
  Truck,
  Factory,
  User
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, staleTime } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityIdentifier: string | null;
  userEmail: string;
  createdAt: string;
}

interface ActivityFeedProps {
  className?: string;
}

export function ActivityFeed({ className }: ActivityFeedProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const { data: activities, isLoading } = useQuery({
    queryKey: queryKeys.auditLogs.recent(10),
    queryFn: async (): Promise<ActivityItem[]> => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, entity_type, entity_identifier, user_email, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entity_type,
        entityIdentifier: item.entity_identifier,
        userEmail: item.user_email,
        createdAt: item.created_at || '',
      }));
    },
    staleTime: staleTime.dashboard,
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Plus className="h-3 w-3 text-green-600" />;
      case 'UPDATE':
        return <Pencil className="h-3 w-3 text-blue-600" />;
      case 'DELETE':
        return <Trash2 className="h-3 w-3 text-destructive" />;
      default:
        return <History className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'lot':
        return <Package className="h-3 w-3" />;
      case 'order':
        return <Truck className="h-3 w-3" />;
      case 'manufacturing_order':
        return <Factory className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const formatUserEmail = (email: string) => {
    return email.split('@')[0];
  };

  if (isLoading) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('recentActivity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-3/4 mb-1" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('recentActivity')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => navigate('/audit-logs')}
          >
            {t('viewAll')}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          <div className="space-y-3">
            {activities?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('noRecentActivity')}
              </p>
            ) : (
              activities?.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-2 text-sm py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted flex-shrink-0">
                    {getActionIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-xs">
                        {formatUserEmail(activity.userEmail)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {activity.action.toLowerCase()}d
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        {getEntityIcon(activity.entityType)}
                        <span className="text-muted-foreground">
                          {activity.entityType.replace('_', ' ')}
                        </span>
                      </span>
                    </div>
                    {activity.entityIdentifier && (
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.entityIdentifier}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
