import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  FileText, Plus, Edit, Trash2, GripVertical, Save, X, Copy, 
  FileSpreadsheet, FileJson, Link, Mail, ChevronDown, ChevronUp,
  Filter, Columns, Settings, Eye
} from 'lucide-react';

interface ReportColumn {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  defaultVisible: boolean;
}

interface ReportFilter {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'select' | 'date-range' | 'number-range';
  options?: { value: string; labelEn: string; labelTr: string }[];
}

interface ReportTypeConfig {
  key: string;
  labelEn: string;
  labelTr: string;
  descriptionEn: string;
  descriptionTr: string;
  columns: ReportColumn[];
  filters: ReportFilter[];
}

interface ReportConfig {
  id: string;
  name: string;
  report_type: string;
  columns: string[];
  column_order?: string[];
  filters: Record<string, any>;
  grouping?: string[];
  comparison_period?: string;
  include_charts: boolean;
  output_formats: string[];
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Report type definitions with available columns and filters
const REPORT_TYPES: ReportTypeConfig[] = [
  {
    key: 'inventory_stock',
    labelEn: 'Inventory Stock Report',
    labelTr: 'Envanter Stok Raporu',
    descriptionEn: 'Current stock levels by quality and color',
    descriptionTr: 'Kalite ve renge göre mevcut stok seviyeleri',
    columns: [
      { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', defaultVisible: true },
      { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', defaultVisible: true },
      { key: 'total_meters', labelEn: 'Total Meters', labelTr: 'Toplam Metre', type: 'number', defaultVisible: true },
      { key: 'total_rolls', labelEn: 'Total Rolls', labelTr: 'Toplam Top', type: 'number', defaultVisible: true },
      { key: 'lot_count', labelEn: 'Lot Count', labelTr: 'Lot Sayısı', type: 'number', defaultVisible: true },
      { key: 'reserved_meters', labelEn: 'Reserved Meters', labelTr: 'Rezerve Metre', type: 'number', defaultVisible: true },
      { key: 'available_meters', labelEn: 'Available Meters', labelTr: 'Kullanılabilir Metre', type: 'number', defaultVisible: true },
      { key: 'incoming_meters', labelEn: 'Incoming Meters', labelTr: 'Gelen Metre', type: 'number', defaultVisible: false },
      { key: 'oldest_lot_date', labelEn: 'Oldest Lot Date', labelTr: 'En Eski Lot Tarihi', type: 'date', defaultVisible: false },
    ],
    filters: [
      { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text' },
      { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text' },
      { key: 'min_stock', labelEn: 'Minimum Stock', labelTr: 'Minimum Stok', type: 'number-range' },
    ],
  },
  {
    key: 'incoming_stock',
    labelEn: 'Incoming Stock Report',
    labelTr: 'Gelen Stok Raporu',
    descriptionEn: 'Expected deliveries and incoming stock status',
    descriptionTr: 'Beklenen teslimatlar ve gelen stok durumu',
    columns: [
      { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', defaultVisible: true },
      { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', defaultVisible: true },
      { key: 'supplier', labelEn: 'Supplier', labelTr: 'Tedarikçi', type: 'text', defaultVisible: true },
      { key: 'expected_meters', labelEn: 'Expected Meters', labelTr: 'Beklenen Metre', type: 'number', defaultVisible: true },
      { key: 'received_meters', labelEn: 'Received Meters', labelTr: 'Alınan Metre', type: 'number', defaultVisible: true },
      { key: 'remaining_meters', labelEn: 'Remaining Meters', labelTr: 'Kalan Metre', type: 'number', defaultVisible: true },
      { key: 'expected_date', labelEn: 'Expected Date', labelTr: 'Beklenen Tarih', type: 'date', defaultVisible: true },
      { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', defaultVisible: true },
      { key: 'invoice_number', labelEn: 'Invoice Number', labelTr: 'Fatura No', type: 'text', defaultVisible: false },
    ],
    filters: [
      { key: 'supplier', labelEn: 'Supplier', labelTr: 'Tedarikçi', type: 'text' },
      { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'select', options: [
        { value: 'pending_inbound', labelEn: 'Pending', labelTr: 'Beklemede' },
        { value: 'partially_received', labelEn: 'Partially Received', labelTr: 'Kısmen Alındı' },
        { value: 'fully_received', labelEn: 'Fully Received', labelTr: 'Tam Alındı' },
      ]},
      { key: 'date_range', labelEn: 'Date Range', labelTr: 'Tarih Aralığı', type: 'date-range' },
    ],
  },
  {
    key: 'reservations',
    labelEn: 'Reservations Report',
    labelTr: 'Rezervasyon Raporu',
    descriptionEn: 'Active and historical reservations',
    descriptionTr: 'Aktif ve geçmiş rezervasyonlar',
    columns: [
      { key: 'reservation_number', labelEn: 'Reservation #', labelTr: 'Rezervasyon No', type: 'text', defaultVisible: true },
      { key: 'customer_name', labelEn: 'Customer', labelTr: 'Müşteri', type: 'text', defaultVisible: true },
      { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', defaultVisible: true },
      { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', defaultVisible: true },
      { key: 'reserved_meters', labelEn: 'Reserved Meters', labelTr: 'Rezerve Metre', type: 'number', defaultVisible: true },
      { key: 'reserved_date', labelEn: 'Reserved Date', labelTr: 'Rezervasyon Tarihi', type: 'date', defaultVisible: true },
      { key: 'expiry_date', labelEn: 'Expiry Date', labelTr: 'Son Kullanma Tarihi', type: 'date', defaultVisible: true },
      { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', defaultVisible: true },
      { key: 'scope', labelEn: 'Scope', labelTr: 'Kapsam', type: 'text', defaultVisible: false },
      { key: 'created_by', labelEn: 'Created By', labelTr: 'Oluşturan', type: 'text', defaultVisible: false },
    ],
    filters: [
      { key: 'customer', labelEn: 'Customer', labelTr: 'Müşteri', type: 'text' },
      { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'select', options: [
        { value: 'active', labelEn: 'Active', labelTr: 'Aktif' },
        { value: 'converted', labelEn: 'Converted', labelTr: 'Dönüştürüldü' },
        { value: 'canceled', labelEn: 'Canceled', labelTr: 'İptal' },
        { value: 'expired', labelEn: 'Expired', labelTr: 'Süresi Doldu' },
      ]},
      { key: 'date_range', labelEn: 'Date Range', labelTr: 'Tarih Aralığı', type: 'date-range' },
    ],
  },
  {
    key: 'manufacturing_orders',
    labelEn: 'Manufacturing Orders Report',
    labelTr: 'Üretim Siparişleri Raporu',
    descriptionEn: 'Production orders and their status',
    descriptionTr: 'Üretim siparişleri ve durumları',
    columns: [
      { key: 'mo_number', labelEn: 'MO Number', labelTr: 'ÜS Numarası', type: 'text', defaultVisible: true },
      { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', defaultVisible: true },
      { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', defaultVisible: true },
      { key: 'supplier', labelEn: 'Supplier', labelTr: 'Tedarikçi', type: 'text', defaultVisible: true },
      { key: 'ordered_amount', labelEn: 'Ordered Amount', labelTr: 'Sipariş Miktarı', type: 'number', defaultVisible: true },
      { key: 'order_date', labelEn: 'Order Date', labelTr: 'Sipariş Tarihi', type: 'date', defaultVisible: true },
      { key: 'expected_completion', labelEn: 'Expected Completion', labelTr: 'Beklenen Tamamlanma', type: 'date', defaultVisible: true },
      { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', defaultVisible: true },
      { key: 'customer_name', labelEn: 'Customer', labelTr: 'Müşteri', type: 'text', defaultVisible: false },
      { key: 'price_per_meter', labelEn: 'Price/Meter', labelTr: 'Metre Fiyatı', type: 'currency', defaultVisible: false },
    ],
    filters: [
      { key: 'supplier', labelEn: 'Supplier', labelTr: 'Tedarikçi', type: 'text' },
      { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'select', options: [
        { value: 'ORDERED', labelEn: 'Ordered', labelTr: 'Sipariş Verildi' },
        { value: 'CONFIRMED', labelEn: 'Confirmed', labelTr: 'Onaylandı' },
        { value: 'IN_PRODUCTION', labelEn: 'In Production', labelTr: 'Üretimde' },
        { value: 'READY_TO_SHIP', labelEn: 'Ready to Ship', labelTr: 'Gönderime Hazır' },
        { value: 'SHIPPED', labelEn: 'Shipped', labelTr: 'Gönderildi' },
      ]},
      { key: 'date_range', labelEn: 'Date Range', labelTr: 'Tarih Aralığı', type: 'date-range' },
    ],
  },
  {
    key: 'order_fulfillment',
    labelEn: 'Order Fulfillment Report',
    labelTr: 'Sipariş Karşılama Raporu',
    descriptionEn: 'Customer orders and fulfillment status',
    descriptionTr: 'Müşteri siparişleri ve karşılama durumu',
    columns: [
      { key: 'order_number', labelEn: 'Order Number', labelTr: 'Sipariş No', type: 'text', defaultVisible: true },
      { key: 'customer_name', labelEn: 'Customer', labelTr: 'Müşteri', type: 'text', defaultVisible: true },
      { key: 'total_lots', labelEn: 'Total Lots', labelTr: 'Toplam Lot', type: 'number', defaultVisible: true },
      { key: 'total_rolls', labelEn: 'Total Rolls', labelTr: 'Toplam Top', type: 'number', defaultVisible: true },
      { key: 'total_meters', labelEn: 'Total Meters', labelTr: 'Toplam Metre', type: 'number', defaultVisible: true },
      { key: 'created_at', labelEn: 'Created Date', labelTr: 'Oluşturulma Tarihi', type: 'date', defaultVisible: true },
      { key: 'fulfilled_at', labelEn: 'Fulfilled Date', labelTr: 'Karşılanma Tarihi', type: 'date', defaultVisible: true },
      { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', defaultVisible: true },
      { key: 'created_by', labelEn: 'Created By', labelTr: 'Oluşturan', type: 'text', defaultVisible: false },
    ],
    filters: [
      { key: 'customer', labelEn: 'Customer', labelTr: 'Müşteri', type: 'text' },
      { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'select', options: [
        { value: 'pending', labelEn: 'Pending', labelTr: 'Beklemede' },
        { value: 'fulfilled', labelEn: 'Fulfilled', labelTr: 'Karşılandı' },
      ]},
      { key: 'date_range', labelEn: 'Date Range', labelTr: 'Tarih Aralığı', type: 'date-range' },
    ],
  },
  {
    key: 'inventory_aging',
    labelEn: 'Inventory Aging Report',
    labelTr: 'Stok Yaşlanma Raporu',
    descriptionEn: 'Stock age analysis by days in warehouse',
    descriptionTr: 'Depodaki gün sayısına göre stok yaş analizi',
    columns: [
      { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', defaultVisible: true },
      { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', defaultVisible: true },
      { key: 'lot_number', labelEn: 'Lot Number', labelTr: 'Lot Numarası', type: 'text', defaultVisible: true },
      { key: 'entry_date', labelEn: 'Entry Date', labelTr: 'Giriş Tarihi', type: 'date', defaultVisible: true },
      { key: 'days_in_stock', labelEn: 'Days in Stock', labelTr: 'Stoktaki Gün', type: 'number', defaultVisible: true },
      { key: 'meters', labelEn: 'Meters', labelTr: 'Metre', type: 'number', defaultVisible: true },
      { key: 'roll_count', labelEn: 'Roll Count', labelTr: 'Top Sayısı', type: 'number', defaultVisible: true },
      { key: 'age_bracket', labelEn: 'Age Bracket', labelTr: 'Yaş Grubu', type: 'text', defaultVisible: true },
      { key: 'supplier', labelEn: 'Supplier', labelTr: 'Tedarikçi', type: 'text', defaultVisible: false },
    ],
    filters: [
      { key: 'age_bracket', labelEn: 'Age Bracket', labelTr: 'Yaş Grubu', type: 'select', options: [
        { value: '0-30', labelEn: '0-30 days', labelTr: '0-30 gün' },
        { value: '31-60', labelEn: '31-60 days', labelTr: '31-60 gün' },
        { value: '61-90', labelEn: '61-90 days', labelTr: '61-90 gün' },
        { value: '90+', labelEn: '90+ days', labelTr: '90+ gün' },
      ]},
      { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text' },
    ],
  },
];

const OUTPUT_FORMATS = [
  { key: 'html', labelEn: 'HTML Email', labelTr: 'HTML E-posta', icon: Mail },
  { key: 'csv', labelEn: 'CSV File', labelTr: 'CSV Dosyası', icon: FileSpreadsheet },
  { key: 'excel', labelEn: 'Excel File', labelTr: 'Excel Dosyası', icon: FileSpreadsheet },
  { key: 'json', labelEn: 'JSON Data', labelTr: 'JSON Verisi', icon: FileJson },
  { key: 'link', labelEn: 'Dashboard Link', labelTr: 'Panel Bağlantısı', icon: Link },
];

const COMPARISON_PERIODS = [
  { value: 'none', labelEn: 'No Comparison', labelTr: 'Karşılaştırma Yok' },
  { value: 'previous_week', labelEn: 'Previous Week', labelTr: 'Önceki Hafta' },
  { value: 'previous_month', labelEn: 'Previous Month', labelTr: 'Önceki Ay' },
  { value: 'previous_quarter', labelEn: 'Previous Quarter', labelTr: 'Önceki Çeyrek' },
  { value: 'previous_year', labelEn: 'Previous Year', labelTr: 'Önceki Yıl' },
];

const ReportConfigurationTab: React.FC = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<ReportConfig> | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('email_report_configs')
        .select('*')
        .order('name');

      if (error) throw error;
      
      setConfigs((data || []).map(d => ({
        ...d,
        columns: Array.isArray(d.columns) ? d.columns as string[] : [],
        filters: typeof d.filters === 'object' ? d.filters as Record<string, any> : {},
        grouping: Array.isArray(d.grouping) ? d.grouping as string[] : [],
        output_formats: d.output_formats || ['html'],
        include_charts: d.include_charts ?? false,
      })));
    } catch (error) {
      console.error('Error fetching report configs:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Rapor yapılandırmaları yüklenemedi' : 'Failed to load report configurations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingConfig({
      name: '',
      report_type: '',
      columns: [],
      filters: {},
      grouping: [],
      comparison_period: 'none',
      include_charts: false,
      output_formats: ['html'],
      is_system: false,
    });
    setSelectedReportType('');
    setDialogOpen(true);
  };

  const handleEdit = (config: ReportConfig) => {
    setEditingConfig({ ...config });
    setSelectedReportType(config.report_type);
    setDialogOpen(true);
  };

  const handleDuplicate = (config: ReportConfig) => {
    setEditingConfig({
      ...config,
      id: undefined,
      name: `${config.name} (${language === 'tr' ? 'Kopya' : 'Copy'})`,
      is_system: false,
    });
    setSelectedReportType(config.report_type);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'tr' ? 'Bu rapor yapılandırmasını silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this report configuration?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_report_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: language === 'tr' ? 'Silindi' : 'Deleted',
        description: language === 'tr' ? 'Rapor yapılandırması silindi' : 'Report configuration deleted',
      });
      fetchConfigs();
    } catch (error) {
      console.error('Error deleting config:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Silinemedi' : 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!editingConfig?.name || !editingConfig?.report_type) {
      toast({
        title: language === 'tr' ? 'Doğrulama Hatası' : 'Validation Error',
        description: language === 'tr' ? 'Ad ve rapor tipi zorunludur' : 'Name and report type are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const payload = {
        name: editingConfig.name,
        report_type: editingConfig.report_type,
        columns: editingConfig.columns || [],
        filters: editingConfig.filters || {},
        grouping: editingConfig.grouping || [],
        comparison_period: editingConfig.comparison_period || 'none',
        include_charts: editingConfig.include_charts || false,
        output_formats: editingConfig.output_formats || ['html'],
        is_system: editingConfig.is_system || false,
        created_by: user.user?.id || null,
      };

      if (editingConfig.id) {
        const { error } = await supabase
          .from('email_report_configs')
          .update(payload)
          .eq('id', editingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_report_configs')
          .insert(payload);

        if (error) throw error;
      }

      toast({
        title: language === 'tr' ? 'Kaydedildi' : 'Saved',
        description: language === 'tr' ? 'Rapor yapılandırması kaydedildi' : 'Report configuration saved',
      });
      setDialogOpen(false);
      fetchConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Kaydedilemedi' : 'Failed to save',
        variant: 'destructive',
      });
    }
  };

  const handleReportTypeChange = (type: string) => {
    setSelectedReportType(type);
    const reportType = REPORT_TYPES.find(r => r.key === type);
    if (reportType) {
      const defaultColumns = reportType.columns.filter(c => c.defaultVisible).map(c => c.key);
      setEditingConfig(prev => ({
        ...prev,
        report_type: type,
        columns: defaultColumns,
        filters: {},
      }));
    }
  };

  const toggleColumn = (columnKey: string) => {
    if (!editingConfig) return;
    const currentColumns = editingConfig.columns || [];
    const newColumns = currentColumns.includes(columnKey)
      ? currentColumns.filter(c => c !== columnKey)
      : [...currentColumns, columnKey];
    setEditingConfig({ ...editingConfig, columns: newColumns });
  };

  const toggleOutputFormat = (format: string) => {
    if (!editingConfig) return;
    const currentFormats = editingConfig.output_formats || [];
    const newFormats = currentFormats.includes(format)
      ? currentFormats.filter(f => f !== format)
      : [...currentFormats, format];
    setEditingConfig({ ...editingConfig, output_formats: newFormats });
  };

  const handleColumnDragStart = (columnKey: string) => {
    setDraggedColumn(columnKey);
  };

  const handleColumnDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) return;
    
    const currentColumns = editingConfig?.columns || [];
    const dragIndex = currentColumns.indexOf(draggedColumn);
    const targetIndex = currentColumns.indexOf(targetKey);
    
    if (dragIndex === -1 || targetIndex === -1) return;
    
    const newColumns = [...currentColumns];
    newColumns.splice(dragIndex, 1);
    newColumns.splice(targetIndex, 0, draggedColumn);
    
    setEditingConfig(prev => prev ? { ...prev, columns: newColumns } : null);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumn(null);
  };

  const currentReportType = useMemo(() => 
    REPORT_TYPES.find(r => r.key === selectedReportType),
    [selectedReportType]
  );

  const getReportTypeLabel = (key: string) => {
    const rt = REPORT_TYPES.find(r => r.key === key);
    return rt ? (language === 'tr' ? rt.labelTr : rt.labelEn) : key;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {language === 'tr' ? 'Rapor Yapılandırmaları' : 'Report Configurations'}
            </CardTitle>
            <CardDescription>
              {language === 'tr' 
                ? 'E-posta ekleri için rapor şablonlarını yapılandırın' 
                : 'Configure report templates for email attachments'}
            </CardDescription>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'tr' ? 'Yeni Rapor' : 'New Report'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === 'tr' ? 'Henüz rapor yapılandırması yok' : 'No report configurations yet'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{language === 'tr' ? 'Rapor Adı' : 'Report Name'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Tip' : 'Type'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Sütunlar' : 'Columns'}</TableHead>
                  <TableHead>{language === 'tr' ? 'Çıktı Formatları' : 'Output Formats'}</TableHead>
                  <TableHead>{language === 'tr' ? 'İşlemler' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(config => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.name}</span>
                        {config.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            {language === 'tr' ? 'Sistem' : 'System'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getReportTypeLabel(config.report_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {config.columns?.length || 0} {language === 'tr' ? 'sütun' : 'columns'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {config.output_formats?.map(fmt => {
                          const format = OUTPUT_FORMATS.find(f => f.key === fmt);
                          if (!format) return null;
                          const Icon = format.icon;
                          return (
                            <TooltipProvider key={fmt}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="secondary" className="h-6 w-6 p-0 flex items-center justify-center">
                                    <Icon className="h-3 w-3" />
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {language === 'tr' ? format.labelTr : format.labelEn}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(config)}>
                          <Edit className="h-3 w-3 mr-1" />
                          {language === 'tr' ? 'Düzenle' : 'Edit'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(config)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        {!config.is_system && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(config.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {editingConfig?.id 
                ? (language === 'tr' ? 'Raporu Düzenle' : 'Edit Report')
                : (language === 'tr' ? 'Yeni Rapor Oluştur' : 'Create New Report')
              }
            </DialogTitle>
            <DialogDescription>
              {language === 'tr' 
                ? 'Rapor ayarlarını, sütunları ve çıktı formatlarını yapılandırın'
                : 'Configure report settings, columns, and output formats'}
            </DialogDescription>
          </DialogHeader>

          {editingConfig && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Rapor Adı' : 'Report Name'}</Label>
                  <Input
                    value={editingConfig.name || ''}
                    onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                    placeholder={language === 'tr' ? 'Rapor adını girin...' : 'Enter report name...'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'tr' ? 'Rapor Tipi' : 'Report Type'}</Label>
                  <Select value={selectedReportType} onValueChange={handleReportTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'tr' ? 'Tip seçin' : 'Select type'} />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map(rt => (
                        <SelectItem key={rt.key} value={rt.key}>
                          {language === 'tr' ? rt.labelTr : rt.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {currentReportType && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {language === 'tr' ? currentReportType.descriptionTr : currentReportType.descriptionEn}
                  </p>

                  <Separator />

                  {/* Column Selection with Drag & Drop */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Columns className="h-4 w-4" />
                      <Label className="text-base font-medium">
                        {language === 'tr' ? 'Sütunlar' : 'Columns'}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        ({language === 'tr' ? 'sıralamak için sürükleyin' : 'drag to reorder'})
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {/* Available columns */}
                      <div className="border rounded-lg p-3">
                        <p className="text-sm font-medium mb-2 text-muted-foreground">
                          {language === 'tr' ? 'Kullanılabilir Sütunlar' : 'Available Columns'}
                        </p>
                        <ScrollArea className="h-48">
                          <div className="space-y-1">
                            {currentReportType.columns.map(col => {
                              const isSelected = editingConfig.columns?.includes(col.key);
                              return (
                                <div
                                  key={col.key}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                                  }`}
                                  onClick={() => toggleColumn(col.key)}
                                >
                                  <Checkbox checked={isSelected} />
                                  <span className="text-sm">
                                    {language === 'tr' ? col.labelTr : col.labelEn}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>

                      {/* Selected columns (draggable) */}
                      <div className="border rounded-lg p-3">
                        <p className="text-sm font-medium mb-2 text-muted-foreground">
                          {language === 'tr' ? 'Seçili Sütunlar (Sıralı)' : 'Selected Columns (Ordered)'}
                        </p>
                        <ScrollArea className="h-48">
                          <div className="space-y-1">
                            {(editingConfig.columns || []).map(colKey => {
                              const col = currentReportType.columns.find(c => c.key === colKey);
                              if (!col) return null;
                              return (
                                <div
                                  key={colKey}
                                  draggable
                                  onDragStart={() => handleColumnDragStart(colKey)}
                                  onDragOver={(e) => handleColumnDragOver(e, colKey)}
                                  onDragEnd={handleColumnDragEnd}
                                  className={`flex items-center gap-2 p-2 rounded bg-muted cursor-move ${
                                    draggedColumn === colKey ? 'opacity-50' : ''
                                  }`}
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm flex-1">
                                    {language === 'tr' ? col.labelTr : col.labelEn}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleColumn(colKey)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              );
                            })}
                            {(editingConfig.columns || []).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                {language === 'tr' ? 'Sütun seçin' : 'Select columns'}
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Output Formats */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <Label className="text-base font-medium">
                        {language === 'tr' ? 'Çıktı Formatları' : 'Output Formats'}
                      </Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {OUTPUT_FORMATS.map(format => {
                        const isSelected = editingConfig.output_formats?.includes(format.key);
                        const Icon = format.icon;
                        return (
                          <Badge
                            key={format.key}
                            variant={isSelected ? 'default' : 'outline'}
                            className="cursor-pointer py-2 px-3 gap-2"
                            onClick={() => toggleOutputFormat(format.key)}
                          >
                            <Icon className="h-4 w-4" />
                            {language === 'tr' ? format.labelTr : format.labelEn}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Additional Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{language === 'tr' ? 'Karşılaştırma Dönemi' : 'Comparison Period'}</Label>
                      <Select 
                        value={editingConfig.comparison_period || 'none'} 
                        onValueChange={(v) => setEditingConfig({ ...editingConfig, comparison_period: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPARISON_PERIODS.map(p => (
                            <SelectItem key={p.value} value={p.value}>
                              {language === 'tr' ? p.labelTr : p.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <Switch
                        checked={editingConfig.include_charts || false}
                        onCheckedChange={(v) => setEditingConfig({ ...editingConfig, include_charts: v })}
                      />
                      <Label>
                        {language === 'tr' ? 'Grafikleri Dahil Et' : 'Include Charts'}
                      </Label>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {language === 'tr' ? 'İptal' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={!editingConfig?.name || !editingConfig?.report_type}>
              <Save className="h-4 w-4 mr-2" />
              {language === 'tr' ? 'Kaydet' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ReportConfigurationTab;
