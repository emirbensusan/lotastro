import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Package, QrCode, Printer, Upload, Download, FileText, CheckCircle, XCircle } from 'lucide-react';
import { generateExcelTemplate, parseCSVFile, importLotsToDatabase, generateErrorReport, ImportLotData, ImportResult, ParseError } from '@/utils/excelImport';

interface Supplier {
  id: string;
  name: string;
}

interface LotFormData {
  quality: string;
  color: string;
  rollCount: string;
  meters: string;
  lotNumber: string;
  entryDate: string;
  supplierId: string;
  productionDate: string;
  invoiceDate: string;
  invoiceNumber: string;
  warehouseLocation: string;
  notes: string;
}

const LotIntake = () => {
  const { profile } = useAuth();
  const { logAction } = useAuditLog();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LotFormData>({
    quality: '',
    color: '',
    rollCount: '1',
    meters: '',
    lotNumber: '',
    entryDate: new Date().toISOString().split('T')[0],
    supplierId: '',
    productionDate: '',
    invoiceDate: '',
    invoiceNumber: '',
    warehouseLocation: '',
    notes: '',
  });
  const [createdLot, setCreatedLot] = useState<any>(null);
  
  // Bulk import states
  const [bulkImporting, setBulkImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: t('error') as string,
        description: "Failed to load suppliers",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof LotFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateQRCodeUrl = (lotNumber: string) => {
    return `${window.location.origin}/qr/${lotNumber}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form
      if (!formData.quality || !formData.color || !formData.rollCount || !formData.meters || !formData.lotNumber || !formData.supplierId || !formData.invoiceNumber || !formData.invoiceDate) {
        throw new Error('Please fill in all required fields');
      }

      const meters = parseFloat(formData.meters);
      const rollCount = parseInt(formData.rollCount);
      if (isNaN(meters) || meters <= 0) {
        throw new Error('Please enter a valid number for meters');
      }
      if (isNaN(rollCount) || rollCount <= 0) {
        throw new Error('Please enter a valid number for roll count');
      }

      // Generate QR code URL
      const qrCodeUrl = generateQRCodeUrl(formData.lotNumber);

      // Insert Lot into database
      const { data, error } = await supabase
        .from('lots')
        .insert({
          quality: formData.quality,
          color: formData.color,
          roll_count: 1, // Always 1 for single entry
          meters: meters,
          lot_number: formData.lotNumber,
          entry_date: formData.entryDate,
          supplier_id: formData.supplierId,
          invoice_number: formData.invoiceNumber,
          invoice_date: formData.invoiceDate,
          production_date: formData.productionDate || null,
          warehouse_location: formData.warehouseLocation || null,
          notes: formData.notes || null,
          qr_code_url: qrCodeUrl,
          status: 'in_stock',
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('Lot number already exists. Please use a different Lot number.');
        }
        throw error;
      }

      // Create a single roll entry for this lot
      const { error: rollError } = await supabase
        .from('rolls')
        .insert({
          lot_id: data.id,
          meters: meters,
          position: 1
        });

      if (rollError) {
        console.error('Error creating roll entry:', rollError);
        // Don't fail the entire operation for roll creation error
      }

      setCreatedLot(data);
      
      // Log audit action
      await logAction(
        'CREATE',
        'lot',
        data.id,
        data.lot_number,
        null,
        data,
        `Created lot with ${meters}m in ${rollCount} roll(s)`
      );

      toast({
        title: t('lotCreated') as string,
        description: `Lot ${formData.lotNumber} has been added to inventory`,
      });

      // Reset form
      setFormData({
        quality: '',
        color: '',
        rollCount: '1',
        meters: '',
        lotNumber: '',
        entryDate: new Date().toISOString().split('T')[0],
        supplierId: '',
        productionDate: '',
        invoiceDate: '',
        invoiceNumber: '',
        warehouseLocation: '',
        notes: '',
      });

    } catch (error: any) {
      toast({
        title: t('failedToCreateLot') as string,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintQR = () => {
    if (!createdLot) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - Lot ${createdLot.lot_number}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .qr-container { margin: 20px 0; }
              .lot-info { margin: 10px 0; font-size: 14px; }
            </style>
          </head>
          <body>
            <h2>Lot ${createdLot.lot_number}</h2>
            <div class="lot-info">Quality: ${createdLot.quality}</div>
            <div class="lot-info">Color: ${createdLot.color}</div>
            <div class="lot-info">Meters: ${createdLot.meters}</div>
            <div class="qr-container">
              <div id="qrcode"></div>
              <p>Scan to view Lot details</p>
              <p style="font-size: 10px; word-break: break-all;">${createdLot.qr_code_url}</p>
            </div>
          </body>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            QRCode.toCanvas(document.getElementById('qrcode'), '${createdLot.qr_code_url}', { width: 200 }, function (error) {
              if (error) console.error(error);
              setTimeout(() => window.print(), 500);
            });
          </script>
        </html>
      `);
    }
  };

  // Bulk import functions
  const handleDownloadTemplate = () => {
    generateExcelTemplate();
      toast({
        title: t('success') as string,
        description: t('templateDownloaded') as string,
      });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResults(null);
    }
  };

  const handleBulkImport = async () => {
    if (!selectedFile) {
      toast({
        title: t('error') as string,
        description: t('selectFileToImport'),
        variant: 'destructive',
      });
      return;
    }

    setBulkImporting(true);
    setImportProgress(0);
    setImportResults(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvText = e.target?.result as string;
          
          toast({
            title: t('importStarted') as string,
            description: t('processingFile'),
          });
          
          setImportProgress(25);

          // Parse CSV
          const parseResult = parseCSVFile(csvText);
          setImportProgress(50);
          
          const totalRows = parseResult.lots.length + parseResult.errors.length;
          toast({
            title: t('validatingData') as string || 'Validating data...',
            description: `Found ${parseResult.lots.length} valid lots, ${parseResult.errors.length} errors (${totalRows} total rows)`,
          });
          
          setImportProgress(75);

          // Check if there are any parsing errors - if so, stop processing
          if (parseResult.errors.length > 0) {
            console.log(`Validation failed: ${parseResult.errors.length} errors found`);
            setImportProgress(100); // Validation complete
            
            // Create import result with only parsing errors (no database import)
            const result = {
              success: false,
              message: `${t('validationFailed')}: ${parseResult.errors.length} ${t('errorsFoundInFile')}`,
              processedCount: 0,
              totalCount: parseResult.lots.length,
              parsingErrors: parseResult.errors,
              databaseErrors: []
            };
            
            setImportResults(result);
            
            toast({
              title: t('validationFailed') as string || 'Validation Failed',
              description: `${parseResult.errors.length} errors found. Download the error report to see details.`,
              variant: 'destructive',
              duration: 0, // Keep visible
            });
            
            return; // Stop processing here
          }

          // Only proceed to database import if there are NO parsing errors
          console.log(`Validation passed: Processing ${parseResult.lots.length} lots`);
          
          // Import to database (only valid lots) with progress tracking
          const result = await importLotsToDatabase(
            parseResult.lots, 
            parseResult.errors,
            (current, total, currentLot) => {
              const dbProgress = 75 + Math.floor((current / total) * 25); // 75-100%
              setImportProgress(dbProgress);
              console.log(`Database progress: ${current}/${total} (${dbProgress}%) - Processing: ${currentLot}`);
            }
          );
          setImportProgress(100);
          
          setImportResults(result);
          
          if (result.success) {
            // Success toast that doesn't auto-dismiss
            toast({
              title: t('success') as string,
              description: result.message,
              duration: 0, // Don't auto-dismiss
            });
          } else {
            // Error toast that stays visible
            toast({
              title: t('importError') as string,
              description: result.message,
              variant: 'destructive',
              duration: 0, // Don't auto-dismiss
            });
          }

          // Always show error summary if there are errors
          const totalErrors = (result.parsingErrors?.length || 0) + (result.databaseErrors?.length || 0);
          if (totalErrors > 0) {
            toast({
              title: `Import completed with ${totalErrors} errors`,
              description: `${result.parsingErrors?.length || 0} parsing errors, ${result.databaseErrors?.length || 0} database errors. Click "Download Error Report" below for details.`,
              variant: 'destructive',
              duration: 0, // Keep visible
            });
          }
          
        } catch (error: any) {
          console.error('Import error:', error);
          toast({
            title: t('importError') as string,
            description: error.message,
            variant: 'destructive',
            duration: 0, // Keep error visible
          });
          setImportResults({
            success: false,
            message: error.message,
          });
        } finally {
          setBulkImporting(false);
        }
      };
      
      reader.readAsText(selectedFile);
    } catch (error: any) {
      console.error('File reading error:', error);
      setBulkImporting(false);
      toast({
        title: t('importError') as string,
        description: error.message,
        variant: 'destructive',
        duration: 0, // Keep error visible
      });
    }
  };

  // Permissions
  if (permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPermission('inventory', 'createlotentries')) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('lotIntake')}</h1>
        <Package className="h-8 w-8 text-primary" />
      </div>

      <Tabs defaultValue="single" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('singleLotEntry')}
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {t('bulkLotImport')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Single Lot Entry Form */}
            <Card>
              <CardHeader>
                <CardTitle>{t('newLotEntry')}</CardTitle>
                <CardDescription>
                  {t('singleEntryDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quality">{t('intakeQuality')} *</Label>
                <Input
                  id="quality"
                  value={formData.quality}
                  onChange={(e) => handleInputChange('quality', e.target.value)}
                  placeholder="e.g., Cotton, Polyester, Blend"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">{t('intakeColor')} *</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  placeholder="e.g., Red, Blue, White"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rollCount">{t('rollCount')} *</Label>
                <Input
                  id="rollCount"
                  type="number"
                  min="1"
                  value="1"
                  disabled
                  className="bg-muted"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meters">{t('meters')} *</Label>
                <Input
                  id="meters"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.meters}
                  onChange={(e) => handleInputChange('meters', e.target.value)}
                  placeholder="e.g., 100.50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lotNumber">{t('lotIntakeNumber')} *</Label>
                <Input
                  id="lotNumber"
                  value={formData.lotNumber}
                  onChange={(e) => handleInputChange('lotNumber', e.target.value)}
                  placeholder="e.g., Lot001, WH-2024-001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entryDate">{t('entryDate')} *</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => handleInputChange('entryDate', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">{t('intakeSupplier')} *</Label>
                <Select value={formData.supplierId} onValueChange={(value) => handleInputChange('supplierId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">{t('invoiceNumber')} *</Label>
                <Input
                  id="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                  placeholder="e.g., INV-2024-001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceDate">{t('invoiceDate')} *</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                  required
                />
              </div>

              {/* Optional Fields */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-muted-foreground">{t('optionalFields')}</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="productionDate">{t('productionDate')}</Label>
                  <Input
                    id="productionDate"
                    type="date"
                    value={formData.productionDate}
                    onChange={(e) => handleInputChange('productionDate', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warehouseLocation">{t('warehouseLocation')}</Label>
                  <Input
                    id="warehouseLocation"
                    value={formData.warehouseLocation}
                    onChange={(e) => handleInputChange('warehouseLocation', e.target.value)}
                    placeholder="e.g., A1-B2-C3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t('notes')}</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('creatingLot')}
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    {t('createLot')}
                  </>
                )}
              </Button>
                </form>
              </CardContent>
            </Card>

            {/* QR Code Preview */}
            {createdLot && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <QrCode className="mr-2 h-5 w-5" />
                    {t('qrCodeGenerated')}
                  </CardTitle>
                  <CardDescription>
                    Lot {createdLot.lot_number} {t('lotCreatedSuccessMessage')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div id="qr-display" className="mb-4"></div>
                    <div className="space-y-2 text-sm">
                      <p><strong>{t('quality')}:</strong> {createdLot.quality}</p>
                      <p><strong>{t('color')}:</strong> {createdLot.color}</p>
                      <p><strong>{t('meters')}:</strong> {createdLot.meters}</p>
                      <p><strong>{t('lotNumber')}:</strong> {createdLot.lot_number}</p>
                    </div>
                  </div>
                  
                  <Button onClick={handlePrintQR} className="w-full">
                    <Printer className="mr-2 h-4 w-4" />
                    {t('printQrCode')}
                  </Button>
                  
                  <div className="text-xs text-muted-foreground break-all">
                    QR URL: {createdLot.qr_code_url}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bulk">
          <div className="space-y-6">

            {/* Bulk Import Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="mr-2 h-5 w-5" />
                  {t('bulkLotImport')}
                </CardTitle>
                <CardDescription>
                  {t('bulkImportInstructions')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    onClick={handleDownloadTemplate} 
                    variant="outline" 
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t('downloadTemplate')}
                  </Button>
                  
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Sadece CSV dosya tipi kabul edilir, tarih formatı GG.AA.YYYY veya YYYY-AA-GG olmalı, örneğin 11 Eylül 2025 tarihi için 11.09.2025 veya 2025-09-11 olarak tarih girilmelidir
                    </p>
                  </div>
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{selectedFile.name}</span>
                      <Badge variant="outline">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </Badge>
                    </div>
                    <Button
                      onClick={handleBulkImport}
                      disabled={bulkImporting}
                      size="sm"
                    >
                        {bulkImporting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('importing') as string}
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            {t('importFile') as string}
                          </>
                        )}
                    </Button>
                  </div>
                )}

                {bulkImporting && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t('progress') as string}</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="w-full" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Import Results */}
            {importResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    {importResults.success ? (
                      <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="mr-2 h-5 w-5 text-red-600" />
                    )}
                    {t('importResults') as string}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={importResults.success ? 'default' : 'destructive'}>
                        {importResults.success ? t('success') : t('failed')}
                      </Badge>
                      <span className="text-sm">{importResults.message}</span>
                    </div>
                    
                    {(importResults.parsingErrors && importResults.parsingErrors.length > 0) || 
                     (importResults.databaseErrors && importResults.databaseErrors.length > 0) ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-destructive">
                            {(importResults.parsingErrors?.length || 0) + (importResults.databaseErrors?.length || 0)} {t('errorsFound')}
                          </Badge>
                          <Button
                            onClick={() => generateErrorReport(
                              importResults.parsingErrors || [], 
                              importResults.databaseErrors
                            )}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {t('downloadErrorReport')}
                          </Button>
                        </div>
                        
                        {importResults.parsingErrors && importResults.parsingErrors.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">{t('parsingErrors')} ({importResults.parsingErrors.length}):</h4>
                            <div className="bg-destructive/10 p-3 rounded-lg max-h-32 overflow-y-auto">
                              {importResults.parsingErrors.slice(0, 5).map((error, index) => (
                                <div key={index} className="text-xs text-destructive">
                                  {t('rowError')} {error.rowNumber}: {error.message}
                                </div>
                              ))}
                              {importResults.parsingErrors.length > 5 && (
                                <div className="text-xs text-muted-foreground">
                                  ... and {importResults.parsingErrors.length - 5} {t('moreParsingErrors')}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {importResults.databaseErrors && importResults.databaseErrors.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">{t('databaseErrors')} ({importResults.databaseErrors.length}):</h4>
                            <div className="bg-destructive/10 p-3 rounded-lg max-h-32 overflow-y-auto">
                              {importResults.databaseErrors.slice(0, 3).map((error, index) => (
                                <div key={index} className="text-xs text-destructive">
                                  {error}
                                </div>
                              ))}
                              {importResults.databaseErrors.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  ... and {importResults.databaseErrors.length - 3} {t('moreDatabaseErrors')}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LotIntake;