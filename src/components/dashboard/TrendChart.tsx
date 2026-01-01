import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Package, Truck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, staleTime } from '@/lib/queryClient';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface TrendData {
  date: string;
  incoming: number;
  outgoing: number;
}

interface TrendChartProps {
  className?: string;
}

export function TrendChart({ className }: TrendChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.all, 'trends'],
    queryFn: async (): Promise<{
      chartData: TrendData[];
      weekChange: number;
      totalIncoming: number;
      totalOutgoing: number;
    }> => {
      const days: TrendData[] = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const nextDateStr = new Date(date.getTime() + 86400000).toISOString().split('T')[0];
        
        // Use separate queries with explicit typing to avoid deep type instantiation
        const lotsQuery = supabase
          .from('lots')
          .select('id', { count: 'exact', head: true })
          .gte('entry_date', dateStr)
          .lt('entry_date', nextDateStr);
        
        // Cast to any to avoid deep type instantiation with orders table
        const ordersQuery = (supabase
          .from('orders') as any)
          .select('id', { count: 'exact', head: true })
          .eq('status', 'fulfilled')
          .gte('fulfilled_date', dateStr)
          .lt('fulfilled_date', nextDateStr);

        const [lotsResult, ordersResult] = await Promise.all([lotsQuery, ordersQuery]);

        days.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          incoming: (lotsResult.count as number) || 0,
          outgoing: (ordersResult.count as number) || 0,
        });
      }

      const currentWeekTotal = days.slice(-3).reduce((sum, d) => sum + d.incoming + d.outgoing, 0);
      const previousWeekTotal = days.slice(0, 4).reduce((sum, d) => sum + d.incoming + d.outgoing, 0);
      const weekChange = previousWeekTotal > 0 
        ? ((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100 
        : 0;

      return {
        chartData: days,
        weekChange: Math.round(weekChange),
        totalIncoming: days.reduce((sum, d) => sum + d.incoming, 0),
        totalOutgoing: days.reduce((sum, d) => sum + d.outgoing, 0),
      };
    },
    staleTime: staleTime.dashboard,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            7-Day Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[160px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const TrendIndicator = () => {
    if (!data) return null;
    
    if (data.weekChange > 0) {
      return (
        <span className="flex items-center text-green-600 text-xs">
          <TrendingUp className="h-3 w-3 mr-0.5" />
          +{data.weekChange}%
        </span>
      );
    } else if (data.weekChange < 0) {
      return (
        <span className="flex items-center text-destructive text-xs">
          <TrendingDown className="h-3 w-3 mr-0.5" />
          {data.weekChange}%
        </span>
      );
    }
    return (
      <span className="flex items-center text-muted-foreground text-xs">
        <Minus className="h-3 w-3 mr-0.5" />
        0%
      </span>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            7-Day Trends
          </CardTitle>
          <TrendIndicator />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.chartData || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                content={({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md">
                      <p className="font-medium mb-1">{label}</p>
                      {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }}>
                          {entry.name}: {entry.value}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="incoming"
                name="Incoming"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIncoming)"
              />
              <Area
                type="monotone"
                dataKey="outgoing"
                name="Outgoing"
                stroke="#22c55e"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorOutgoing)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Package className="h-3 w-3 text-blue-500" />
            <span className="text-muted-foreground">Incoming:</span>
            <span className="font-medium">{data?.totalIncoming || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Truck className="h-3 w-3 text-green-500" />
            <span className="text-muted-foreground">Outgoing:</span>
            <span className="font-medium">{data?.totalOutgoing || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
