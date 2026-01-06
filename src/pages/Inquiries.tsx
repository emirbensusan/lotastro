import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInquiries, Inquiry } from '@/hooks/useInquiries';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';
import { ViewDetailsButton } from '@/components/ui/view-details-button';
import InquiryDialog from '@/components/InquiryDialog';
import InquiryDetailsDialog from '@/components/InquiryDetailsDialog';
import StockTakeSessionDialog from '@/components/StockTakeSessionDialog';
import { Plus, FileSearch, ClipboardCheck, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';

type InquiryStatus = Database['public']['Enums']['inquiry_status'];
type InquiryReason = Database['public']['Enums']['inquiry_reason'];

const STATUS_COLORS: Record<InquiryStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-primary text-primary-foreground',
  converted: 'bg-green-500 text-white',
  expired: 'bg-orange-500 text-white',
  cancelled: 'bg-destructive text-destructive-foreground',
};

const REASON_LABELS: Record<InquiryReason, { en: string; tr: string }> = {
  customer_quote: { en: 'Customer Quote', tr: 'Müşteri Teklifi' },
  stock_check: { en: 'Stock Check', tr: 'Stok Kontrolü' },
  management_review: { en: 'Management Review', tr: 'Yönetim İncelemesi' },
  stock_take: { en: 'Stock Take', tr: 'Sayım' },
  qa_investigation: { en: 'QA Investigation', tr: 'Kalite Araştırması' },
};

const Inquiries = () => {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { fetchInquiries, loading } = useInquiries();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Sorting
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>({
    key: 'created_at',
    direction: 'desc'
  });

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showStockTakeDialog, setShowStockTakeDialog] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    loadInquiries();
  }, [statusFilter, reasonFilter]);

  const loadInquiries = async () => {
    const data = await fetchInquiries({
      status: statusFilter as InquiryStatus || undefined,
      reason: reasonFilter as InquiryReason || undefined,
    });
    setInquiries(data);
  };

  const handleSort = (key: string, direction: SortDirection) => {
    setCurrentSort(direction ? { key, direction } : null);
  };

  // Filter and sort inquiries
  const filteredInquiries = inquiries
    .filter(inq => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return inq.inquiry_number.toLowerCase().includes(query) ||
               inq.customer_name?.toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      if (!currentSort) return 0;
      const { key, direction } = currentSort;
      const aVal = a[key as keyof Inquiry];
      const bVal = b[key as keyof Inquiry];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return direction === 'asc' ? cmp : -cmp;
    });

  // Paginate
  const totalCount = filteredInquiries.length;
  const paginatedInquiries = filteredInquiries.slice((page - 1) * pageSize, page * pageSize);

  const handleViewDetails = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setShowDetailsDialog(true);
  };

  const canCreate = profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'senior_manager' || profile?.role === 'warehouse_staff';

  if (loading && inquiries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{String(t('inquiry.title'))}</h1>
          <FileSearch className="h-8 w-8 text-primary" />
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{String(t('inquiry.title'))}</h1>
        <FileSearch className="h-8 w-8 text-primary" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{String(t('inquiry.title'))}</CardTitle>
              <CardDescription>{String(t('inquiry.description'))}</CardDescription>
            </div>
            <div className="flex gap-2">
              {canCreate && (
                <>
                  <Button variant="outline" onClick={() => setShowStockTakeDialog(true)}>
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    {String(t('stockTakeSession.start'))}
                  </Button>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {String(t('inquiry.createNew'))}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={String(t('inquiry.search'))}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={String(t('status'))} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{String(t('all'))}</SelectItem>
                <SelectItem value="active">{String(t('inquiry.status.active'))}</SelectItem>
                <SelectItem value="converted">{String(t('inquiry.status.converted'))}</SelectItem>
                <SelectItem value="expired">{String(t('inquiry.status.expired'))}</SelectItem>
                <SelectItem value="cancelled">{String(t('inquiry.status.cancelled'))}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={String(t('inquiry.reason'))} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{String(t('all'))}</SelectItem>
                {Object.entries(REASON_LABELS).map(([key, labels]) => (
                  <SelectItem key={key} value={key}>
                    {language === 'tr' ? labels.tr : labels.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pagination */}
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label={String(t('inquiry.number'))}
                  sortKey="inquiry_number"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('inquiry.reason'))}
                  sortKey="reason"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('customer'))}
                  sortKey="customer_name"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('inquiry.lines'))}
                  sortKey=""
                  currentSort={currentSort}
                  onSort={() => {}}
                />
                <SortableTableHead
                  label={String(t('inquiry.totalMeters'))}
                  sortKey=""
                  currentSort={currentSort}
                  onSort={() => {}}
                />
                <SortableTableHead
                  label={String(t('status'))}
                  sortKey="status"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('created'))}
                  sortKey="created_at"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={String(t('actions'))}
                  sortKey=""
                  currentSort={currentSort}
                  onSort={() => {}}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInquiries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {String(t('noResultsFound'))}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedInquiries.map((inquiry) => {
                  const totalMeters = inquiry.inquiry_lines?.reduce((sum, l) => sum + l.requested_meters, 0) || 0;
                  return (
                    <TableRow key={inquiry.id}>
                      <TableCell className="font-mono">{inquiry.inquiry_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {language === 'tr' ? REASON_LABELS[inquiry.reason].tr : REASON_LABELS[inquiry.reason].en}
                        </Badge>
                      </TableCell>
                      <TableCell>{inquiry.customer_name || '-'}</TableCell>
                      <TableCell>{inquiry.inquiry_lines?.length || 0}</TableCell>
                      <TableCell>{totalMeters.toFixed(2)}m</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[inquiry.status]}>
                          {String(t(`inquiry.status.${inquiry.status}`))}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(inquiry.created_at), 'PP')}</TableCell>
                      <TableCell>
                        <ViewDetailsButton 
                          onClick={() => handleViewDetails(inquiry)}
                          showLabel={false}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Bottom Pagination */}
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <InquiryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={loadInquiries}
      />

      <StockTakeSessionDialog
        open={showStockTakeDialog}
        onOpenChange={setShowStockTakeDialog}
        onSuccess={() => loadInquiries()}
      />

      <InquiryDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        inquiry={selectedInquiry}
        onRefresh={loadInquiries}
      />
    </div>
  );
};

export default Inquiries;
