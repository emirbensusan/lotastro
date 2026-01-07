import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Filter, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  RefreshCw,
  Download,
  Package,
  Truck,
  ClipboardCheck,
  Wrench,
  Calendar as CalendarIcon,
  X,
  ClipboardList,
  Unlock
} from 'lucide-react';

// Simple date picker component
const SimpleDatePicker: React.FC<{
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  placeholder: string;
}> = ({ date, onSelect, placeholder }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-normal",
          !date && "text-muted-foreground"
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(date, "dd MMM yyyy") : placeholder}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={date}
        onSelect={onSelect}
        initialFocus
      />
    </PopoverContent>
  </Popover>
);

// Transaction type configuration with icons and colors
const TRANSACTION_TYPE_CONFIG: Record<string, { 
  label: { en: string; tr: string }; 
  icon: React.ElementType; 
  color: string;
  isPositive: boolean;
}> = {
  'INCOMING_RECEIPT': { 
    label: { en: 'Incoming Receipt', tr: 'Giriş Fişi' }, 
    icon: Truck, 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    isPositive: true
  },
  'ORDER_FULFILLMENT': { 
    label: { en: 'Order Fulfillment', tr: 'Sipariş Karşılama' }, 
    icon: Package, 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    isPositive: false
  },
  'STOCK_ADJUSTMENT': { 
    label: { en: 'Stock Adjustment', tr: 'Stok Düzeltme' }, 
    icon: ClipboardList, 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    isPositive: false
  },
  'MANUAL_CORRECTION': { 
    label: { en: 'Manual Correction', tr: 'Manuel Düzeltme' }, 
    icon: Wrench, 
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    isPositive: false
  },
  'RESERVATION_ALLOCATION': { 
    label: { en: 'Reservation', tr: 'Rezervasyon' }, 
    icon: Package, 
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    isPositive: false
  },
  'RESERVATION_RELEASE': { 
    label: { en: 'Reservation Release', tr: 'Rezervasyon İptali' }, 
    icon: Package, 
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    isPositive: true
  },
  'TRANSFER_OUT': { 
    label: { en: 'Transfer Out', tr: 'Transfer Çıkışı' }, 
    icon: ArrowUpCircle, 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    isPositive: false
  },
  'TRANSFER_IN': { 
    label: { en: 'Transfer In', tr: 'Transfer Girişi' }, 
    icon: ArrowDownCircle, 
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
    isPositive: true
  },
};

interface InventoryTransaction {
  id: string;
  created_at: string;
  created_by: string | null;
  roll_id: string | null;
  transaction_type: string;
  quantity_change: number;
  unit: string;
  source_type: string;
  source_id: string | null;
  source_identifier: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
}

const InventoryTransactions: React.FC = () => {
  const { language, t } = useLanguage();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Fetch transactions
  const { data: transactions, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inventory-transactions', typeFilter, sourceTypeFilter, startDate, endDate, searchQuery, page],
    queryFn: async () => {
      let query = supabase
        .from('inventory_transactions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (typeFilter !== 'all') {
        // Cast to the expected enum type for Supabase
        query = query.eq('transaction_type', typeFilter as any);
      }
      
      if (sourceTypeFilter !== 'all') {
        query = query.eq('source_type', sourceTypeFilter);
      }
      
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }
      
      if (searchQuery) {
        query = query.or(`source_identifier.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;
      
      if (error) throw error;
      return { transactions: data as InventoryTransaction[], total: count || 0 };
    },
  });

  // Fetch distinct source types for filter
  const { data: sourceTypes } = useQuery({
    queryKey: ['inventory-transactions-source-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('source_type')
        .limit(100);
      
      if (error) throw error;
      const unique = [...new Set(data?.map(d => d.source_type) || [])];
      return unique.sort();
    },
  });

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setSourceTypeFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
    setPage(1);
  };

  const hasActiveFilters = searchQuery || typeFilter !== 'all' || sourceTypeFilter !== 'all' || startDate || endDate;

  const totalPages = Math.ceil((transactions?.total || 0) / pageSize);

  const getTransactionTypeDisplay = (type: string) => {
    const config = TRANSACTION_TYPE_CONFIG[type];
    if (!config) return { label: type, icon: Package, color: 'bg-muted text-muted-foreground', isPositive: false };
    return {
      ...config,
      label: language === 'tr' ? config.label.tr : config.label.en
    };
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {language === 'tr' ? 'Stok Hareketleri' : 'Inventory Transactions'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'tr' 
              ? 'Tüm stok giriş ve çıkışlarının kayıtları' 
              : 'Complete ledger of all inventory movements'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {String(t('refresh') || 'Refresh')}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {String(t('export'))}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {String(t('filters'))}
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                {String(t('clearFilters'))}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'tr' ? 'Kaynak veya not ara...' : 'Search source or notes...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Transaction Type */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'tr' ? 'İşlem Tipi' : 'Transaction Type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{String(t('all'))}</SelectItem>
                {Object.entries(TRANSACTION_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {language === 'tr' ? config.label.tr : config.label.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Source Type */}
            <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'tr' ? 'Kaynak Tipi' : 'Source Type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{String(t('all'))}</SelectItem>
                {sourceTypes?.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Start Date */}
            <SimpleDatePicker
              date={startDate}
              onSelect={setStartDate}
              placeholder={language === 'tr' ? 'Başlangıç' : 'Start Date'}
            />

            {/* End Date */}
            <SimpleDatePicker
              date={endDate}
              onSelect={setEndDate}
              placeholder={language === 'tr' ? 'Bitiş' : 'End Date'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardDescription>
              {transactions?.total ? (
                <>
                  {String(t('showing'))} {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, transactions.total)} {String(t('of'))} {transactions.total}
                </>
              ) : (
                language === 'tr' ? 'İşlem bulunamadı' : 'No transactions found'
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions?.transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{language === 'tr' ? 'Henüz işlem kaydı yok' : 'No transaction records yet'}</p>
              <p className="text-sm mt-1">
                {language === 'tr' 
                  ? 'Stok hareketleri burada görüntülenecek' 
                  : 'Inventory movements will appear here'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'tr' ? 'Tarih' : 'Date'}</TableHead>
                    <TableHead>{language === 'tr' ? 'İşlem Tipi' : 'Type'}</TableHead>
                    <TableHead className="text-right">{language === 'tr' ? 'Miktar' : 'Quantity'}</TableHead>
                    <TableHead>{language === 'tr' ? 'Kaynak' : 'Source'}</TableHead>
                    <TableHead>{language === 'tr' ? 'Tanımlayıcı' : 'Identifier'}</TableHead>
                    <TableHead>{language === 'tr' ? 'Notlar' : 'Notes'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions?.transactions.map((tx) => {
                    const typeDisplay = getTransactionTypeDisplay(tx.transaction_type);
                    const IconComponent = typeDisplay.icon;
                    const isPositive = tx.quantity_change > 0;
                    
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm">
                            {format(new Date(tx.created_at), 'dd MMM yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), 'HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${typeDisplay.color} gap-1`}>
                            <IconComponent className="h-3 w-3" />
                            {typeDisplay.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {isPositive ? '+' : ''}{tx.quantity_change.toLocaleString()} {tx.unit}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.source_type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {tx.source_identifier || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                          {tx.notes || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {String(t('previous'))}
              </Button>
              <span className="text-sm text-muted-foreground">
                {String(t('page'))} {page} {String(t('of'))} {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                {String(t('next'))}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryTransactions;
