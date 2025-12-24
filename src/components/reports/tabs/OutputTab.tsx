import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { OUTPUT_FORMATS } from '../reportBuilderTypes';
import { FileSpreadsheet, FileText, BarChart3, Layout, Image, Printer } from 'lucide-react';

export interface PageLayoutConfig {
  orientation: 'portrait' | 'landscape';
  pageSize: 'a4' | 'letter' | 'legal';
  margins: 'normal' | 'narrow' | 'wide';
  showPageNumbers: boolean;
  showDate: boolean;
  showTotalRecords: boolean;
}

export interface BrandingConfig {
  showLogo: boolean;
  logoUrl?: string;
  companyName: string;
  reportFooter: string;
  primaryColor: string;
}

export interface ChartConfig {
  chartType: 'bar' | 'line' | 'pie' | 'area';
  chartColumn?: string;
  groupByColumn?: string;
  showLegend: boolean;
  showDataLabels: boolean;
}

interface OutputTabProps {
  outputFormats: string[];
  includeCharts: boolean;
  pageLayout?: PageLayoutConfig;
  branding?: BrandingConfig;
  chartConfig?: ChartConfig;
  onOutputFormatsChange: (formats: string[]) => void;
  onIncludeChartsChange: (include: boolean) => void;
  onPageLayoutChange?: (layout: PageLayoutConfig) => void;
  onBrandingChange?: (branding: BrandingConfig) => void;
  onChartConfigChange?: (config: ChartConfig) => void;
}

const DEFAULT_PAGE_LAYOUT: PageLayoutConfig = {
  orientation: 'portrait',
  pageSize: 'a4',
  margins: 'normal',
  showPageNumbers: true,
  showDate: true,
  showTotalRecords: true,
};

const DEFAULT_BRANDING: BrandingConfig = {
  showLogo: false,
  companyName: '',
  reportFooter: '',
  primaryColor: '#1e40af',
};

const DEFAULT_CHART_CONFIG: ChartConfig = {
  chartType: 'bar',
  showLegend: true,
  showDataLabels: false,
};

export const OutputTab: React.FC<OutputTabProps> = ({
  outputFormats,
  includeCharts,
  pageLayout = DEFAULT_PAGE_LAYOUT,
  branding = DEFAULT_BRANDING,
  chartConfig = DEFAULT_CHART_CONFIG,
  onOutputFormatsChange,
  onIncludeChartsChange,
  onPageLayoutChange,
  onBrandingChange,
  onChartConfigChange,
}) => {
  const { language, t } = useLanguage();

  const toggleFormat = (formatKey: string) => {
    const isSelected = outputFormats.includes(formatKey);
    onOutputFormatsChange(
      isSelected
        ? outputFormats.filter(f => f !== formatKey)
        : [...outputFormats, formatKey]
    );
  };

  const updatePageLayout = (updates: Partial<PageLayoutConfig>) => {
    onPageLayoutChange?.({ ...pageLayout, ...updates });
  };

  const updateBranding = (updates: Partial<BrandingConfig>) => {
    onBrandingChange?.({ ...branding, ...updates });
  };

  const updateChartConfig = (updates: Partial<ChartConfig>) => {
    onChartConfigChange?.({ ...chartConfig, ...updates });
  };

  // Extended formats with PDF
  const allFormats = [
    ...OUTPUT_FORMATS,
    { key: 'pdf', labelEn: 'PDF Document', labelTr: 'PDF Belgesi', icon: FileText },
  ];

  return (
    <Tabs defaultValue="formats" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="formats" className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          <span className="hidden sm:inline">{language === 'tr' ? 'Formatlar' : 'Formats'}</span>
        </TabsTrigger>
        <TabsTrigger value="layout" className="flex items-center gap-2">
          <Layout className="h-4 w-4" />
          <span className="hidden sm:inline">{language === 'tr' ? 'Sayfa' : 'Layout'}</span>
        </TabsTrigger>
        <TabsTrigger value="branding" className="flex items-center gap-2">
          <Image className="h-4 w-4" />
          <span className="hidden sm:inline">{language === 'tr' ? 'Marka' : 'Branding'}</span>
        </TabsTrigger>
        <TabsTrigger value="charts" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">{language === 'tr' ? 'Grafik' : 'Charts'}</span>
        </TabsTrigger>
      </TabsList>

      {/* Output Formats Tab */}
      <TabsContent value="formats" className="space-y-6 mt-4">
        <div className="space-y-3">
          <Label>{language === 'tr' ? 'Çıktı Formatları' : 'Output Formats'}</Label>
          <p className="text-sm text-muted-foreground">
            {language === 'tr' 
              ? 'Raporun hangi formatlarda oluşturulacağını seçin' 
              : 'Select which formats the report should be generated in'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allFormats.map((format) => {
              const Icon = format.icon;
              const isSelected = outputFormats.includes(format.key);
              return (
                <div
                  key={format.key}
                  className={`flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                  onClick={() => toggleFormat(format.key)}
                >
                  <div className={`p-2 rounded-full ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <span className="text-sm font-medium text-center">
                    {language === 'tr' ? format.labelTr : format.labelEn}
                  </span>
                  <Checkbox checked={isSelected} className="mt-1" />
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        <div className="bg-muted/30 border rounded-lg p-4">
          <h4 className="font-medium mb-2">{language === 'tr' ? 'Format Bilgileri' : 'Format Information'}</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>HTML:</strong> {language === 'tr' ? 'E-posta gövdesinde tablo olarak' : 'As table in email body'}</li>
            <li>• <strong>Excel:</strong> {language === 'tr' ? 'Formüller ve filtrelerle' : 'With formulas and filters'}</li>
            <li>• <strong>CSV:</strong> {language === 'tr' ? 'Basit veri aktarımı için' : 'For simple data export'}</li>
            <li>• <strong>PDF:</strong> {language === 'tr' ? 'Yazdırma ve arşivleme için' : 'For printing and archiving'}</li>
          </ul>
        </div>
      </TabsContent>

      {/* Page Layout Tab */}
      <TabsContent value="layout" className="space-y-6 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{language === 'tr' ? 'Sayfa Yönü' : 'Page Orientation'}</Label>
            <Select
              value={pageLayout.orientation}
              onValueChange={(val) => updatePageLayout({ orientation: val as 'portrait' | 'landscape' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">{language === 'tr' ? 'Dikey' : 'Portrait'}</SelectItem>
                <SelectItem value="landscape">{language === 'tr' ? 'Yatay' : 'Landscape'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{language === 'tr' ? 'Sayfa Boyutu' : 'Page Size'}</Label>
            <Select
              value={pageLayout.pageSize}
              onValueChange={(val) => updatePageLayout({ pageSize: val as 'a4' | 'letter' | 'legal' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4</SelectItem>
                <SelectItem value="letter">Letter</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{language === 'tr' ? 'Kenar Boşlukları' : 'Margins'}</Label>
          <Select
            value={pageLayout.margins}
            onValueChange={(val) => updatePageLayout({ margins: val as 'normal' | 'narrow' | 'wide' })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="narrow">{language === 'tr' ? 'Dar' : 'Narrow'}</SelectItem>
              <SelectItem value="normal">{language === 'tr' ? 'Normal' : 'Normal'}</SelectItem>
              <SelectItem value="wide">{language === 'tr' ? 'Geniş' : 'Wide'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base">{language === 'tr' ? 'Sayfa Öğeleri' : 'Page Elements'}</Label>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{language === 'tr' ? 'Sayfa Numaraları' : 'Page Numbers'}</Label>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Her sayfanın altında sayfa numarası göster' : 'Show page number at bottom of each page'}
              </p>
            </div>
            <Switch
              checked={pageLayout.showPageNumbers}
              onCheckedChange={(val) => updatePageLayout({ showPageNumbers: val })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{language === 'tr' ? 'Tarih' : 'Date'}</Label>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Rapor tarihini başlıkta göster' : 'Show report date in header'}
              </p>
            </div>
            <Switch
              checked={pageLayout.showDate}
              onCheckedChange={(val) => updatePageLayout({ showDate: val })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{language === 'tr' ? 'Toplam Kayıt Sayısı' : 'Total Records'}</Label>
              <p className="text-sm text-muted-foreground">
                {language === 'tr' ? 'Rapordaki toplam kayıt sayısını göster' : 'Show total record count in report'}
              </p>
            </div>
            <Switch
              checked={pageLayout.showTotalRecords}
              onCheckedChange={(val) => updatePageLayout({ showTotalRecords: val })}
            />
          </div>
        </div>
      </TabsContent>

      {/* Branding Tab */}
      <TabsContent value="branding" className="space-y-6 mt-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{language === 'tr' ? 'Logo Göster' : 'Show Logo'}</Label>
            <p className="text-sm text-muted-foreground">
              {language === 'tr' ? 'Rapor başlığında şirket logosunu göster' : 'Display company logo in report header'}
            </p>
          </div>
          <Switch
            checked={branding.showLogo}
            onCheckedChange={(val) => updateBranding({ showLogo: val })}
          />
        </div>

        {branding.showLogo && (
          <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
            <Label>{language === 'tr' ? 'Logo URL' : 'Logo URL'}</Label>
            <Input
              value={branding.logoUrl || ''}
              onChange={(e) => updateBranding({ logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted-foreground">
              {language === 'tr' ? 'PNG veya SVG formatında logo URL\'si girin' : 'Enter logo URL in PNG or SVG format'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>{language === 'tr' ? 'Şirket Adı' : 'Company Name'}</Label>
          <Input
            value={branding.companyName}
            onChange={(e) => updateBranding({ companyName: e.target.value })}
            placeholder={language === 'tr' ? 'Şirket adını girin...' : 'Enter company name...'}
          />
        </div>

        <div className="space-y-2">
          <Label>{language === 'tr' ? 'Rapor Alt Bilgisi' : 'Report Footer'}</Label>
          <Input
            value={branding.reportFooter}
            onChange={(e) => updateBranding({ reportFooter: e.target.value })}
            placeholder={language === 'tr' ? 'Alt bilgi metni...' : 'Footer text...'}
          />
        </div>

        <div className="space-y-2">
          <Label>{language === 'tr' ? 'Birincil Renk' : 'Primary Color'}</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={branding.primaryColor}
              onChange={(e) => updateBranding({ primaryColor: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={branding.primaryColor}
              onChange={(e) => updateBranding({ primaryColor: e.target.value })}
              className="flex-1"
              placeholder="#1e40af"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {language === 'tr' ? 'Başlık ve vurgu rengi için kullanılır' : 'Used for headers and accents'}
          </p>
        </div>

        {/* Branding Preview */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <Label className="mb-3 block">{language === 'tr' ? 'Önizleme' : 'Preview'}</Label>
          <div className="border rounded bg-background p-4">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b" style={{ borderColor: branding.primaryColor }}>
              {branding.showLogo && branding.logoUrl && (
                <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
              )}
              {branding.companyName && (
                <span className="font-bold" style={{ color: branding.primaryColor }}>{branding.companyName}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{language === 'tr' ? 'Rapor içeriği burada görünür...' : 'Report content appears here...'}</p>
            {branding.reportFooter && (
              <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">{branding.reportFooter}</p>
            )}
          </div>
        </div>
      </TabsContent>

      {/* Charts Tab */}
      <TabsContent value="charts" className="space-y-6 mt-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{language === 'tr' ? 'Grafikler Dahil' : 'Include Charts'}</Label>
            <p className="text-sm text-muted-foreground">
              {language === 'tr' ? 'Raporun üstüne grafik ekle' : 'Add chart visualization to the report'}
            </p>
          </div>
          <Switch
            checked={includeCharts}
            onCheckedChange={onIncludeChartsChange}
          />
        </div>

        {includeCharts && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{language === 'tr' ? 'Grafik Türü' : 'Chart Type'}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'bar', labelEn: 'Bar', labelTr: 'Çubuk' },
                    { key: 'line', labelEn: 'Line', labelTr: 'Çizgi' },
                    { key: 'pie', labelEn: 'Pie', labelTr: 'Pasta' },
                    { key: 'area', labelEn: 'Area', labelTr: 'Alan' },
                  ].map((type) => (
                    <div
                      key={type.key}
                      className={`p-3 border rounded-lg text-center cursor-pointer transition-all ${
                        chartConfig.chartType === type.key
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => updateChartConfig({ chartType: type.key as ChartConfig['chartType'] })}
                    >
                      <span className="text-sm">{language === 'tr' ? type.labelTr : type.labelEn}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label>{language === 'tr' ? 'Lejant Göster' : 'Show Legend'}</Label>
                  <Switch
                    checked={chartConfig.showLegend}
                    onCheckedChange={(val) => updateChartConfig({ showLegend: val })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>{language === 'tr' ? 'Veri Etiketleri' : 'Data Labels'}</Label>
                  <Switch
                    checked={chartConfig.showDataLabels}
                    onCheckedChange={(val) => updateChartConfig({ showDataLabels: val })}
                  />
                </div>
              </div>

              <div className="bg-muted/30 border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  {language === 'tr' 
                    ? 'Grafik, sayısal sütunlarınızdan otomatik olarak oluşturulacaktır. Gruplama için sıralama ayarlarını kullanın.' 
                    : 'Chart will be automatically generated from your numeric columns. Use sorting settings for grouping.'}
                </p>
              </div>
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
};