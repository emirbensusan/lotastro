import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { SortableTableHead, SortDirection } from '@/components/ui/sortable-table-head';
import { TableExportButton, exportToCSV } from '@/components/ui/table-export-button';
import { ViewDetailsButton } from '@/components/ui/view-details-button';

interface Supplier {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const Suppliers: React.FC = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const { toast } = useToast();

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting state
  const [currentSort, setCurrentSort] = useState<{ key: string; direction: SortDirection } | null>(
    { key: 'name', direction: 'asc' }
  );

  useEffect(() => {
    fetchSuppliers();
  }, [page, pageSize, currentSort]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      // Get total count
      const { count } = await supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true });
      setTotalCount(count || 0);

      // Build query
      let query = supabase.from('suppliers').select('*');

      // Apply sorting
      if (currentSort?.key && currentSort?.direction) {
        query = query.order(currentSort.key, { ascending: currentSort.direction === 'asc' });
      } else {
        query = query.order('name');
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: t('error') as string,
        description: t('failedToFetchSuppliers'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string, direction: SortDirection) => {
    setCurrentSort(direction ? { key, direction } : null);
    setPage(1);
  };

  const handleExport = () => {
    const exportData = suppliers.map(s => ({
      name: s.name,
      created_at: s.created_at,
      updated_at: s.updated_at
    }));
    exportToCSV(exportData, [
      { key: 'name', label: String(t('supplierName')) },
      { key: 'created_at', label: String(t('created')) },
      { key: 'updated_at', label: String(t('lastUpdated')) }
    ], 'suppliers-export');
  };

  const saveSupplier = async () => {
    if (!supplierName.trim()) {
      toast({
        title: t('error') as string,
        description: t('supplierNameRequired'),
        variant: 'destructive'
      });
      return;
    }

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update({ name: supplierName })
          .eq('id', editingSupplier.id);

        if (error) throw error;

        toast({
          title: t('success') as string,
          description: t('supplierUpdatedSuccess')
        });
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([{ name: supplierName }]);

        if (error) throw error;

        toast({
          title: t('success') as string,
          description: t('supplierCreatedSuccess')
        });
      }

      fetchSuppliers();
      closeDialog();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({
        title: t('error') as string,
        description: t('failedToSaveSupplier'),
        variant: 'destructive'
      });
    }
  };

  const deleteSupplier = async (supplierId: string) => {
    if (!confirm(String(t('confirmDeleteSupplier')))) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierId);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: t('supplierDeletedSuccess')
      });

      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: t('error') as string,
        description: t('failedToDeleteSupplier'),
        variant: 'destructive'
      });
    }
  };

  const openDialog = (supplier?: Supplier) => {
    setEditingSupplier(supplier || null);
    setSupplierName(supplier?.name || '');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSupplier(null);
    setSupplierName('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (permissionsLoading) {
    return <div className="text-sm text-muted-foreground">{t('loadingEllipsis')}</div>;
  }

  if (!hasPermission('suppliers', 'viewsuppliers')) {
    return <div className="text-sm text-muted-foreground">{t('noPermissionSuppliers')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('supplierManagement')}</h1>
        <div className="flex gap-2">
          <TableExportButton onExport={handleExport} disabled={suppliers.length === 0} />
          <Button onClick={() => openDialog()} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t('addSupplier')}
          </Button>
        </div>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('totalSuppliers')}</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCount}</div>
          <p className="text-xs text-muted-foreground">
            {t('activeSuppliersInSystem')}
          </p>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('allSuppliers')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Top Pagination */}
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />

          {loading ? (
            <div className="space-y-2 mt-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noSuppliersFound')}
            </div>
          ) : (
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    label={String(t('supplierName'))}
                    sortKey="name"
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
                    label={String(t('lastUpdated'))}
                    sortKey="updated_at"
                    currentSort={currentSort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={String(t('actions'))}
                    sortKey=""
                    currentSort={null}
                    onSort={() => {}}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{formatDate(supplier.created_at)}</TableCell>
                    <TableCell>{formatDate(supplier.updated_at)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <ViewDetailsButton onClick={() => openDialog(supplier)} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteSupplier(supplier.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Bottom Pagination */}
          {!loading && suppliers.length > 0 && (
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? t('editSupplier') : t('addNewSupplier')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="supplierName">{t('supplierName')}</Label>
              <Input
                id="supplierName"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder={String(t('enterSupplierName'))}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={closeDialog}>
                {t('cancel')}
              </Button>
              <Button onClick={saveSupplier}>
                {editingSupplier ? t('update') : t('create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;