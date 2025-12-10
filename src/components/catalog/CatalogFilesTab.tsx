import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Image as ImageIcon, 
  Upload, 
  ExternalLink, 
  Download,
  X,
  Eye
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CatalogItem {
  id: string;
  spec_sheet_url: string | null;
  spec_sheet_file: string | null;
  test_report_url: string | null;
  test_report_file: string | null;
  shade_range_image_url: string | null;
  photo_of_design_url: string | null;
}

interface CatalogFilesTabProps {
  item: CatalogItem;
  onChange: (updates: Partial<CatalogItem>) => void;
  canEdit: boolean;
}

const CatalogFilesTab: React.FC<CatalogFilesTabProps> = ({
  item,
  onChange,
  canEdit,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);

  const handleFileUpload = async (
    file: File,
    bucket: string,
    field: keyof CatalogItem
  ) => {
    setUploading(field);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${item.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      onChange({ [field]: fileName });
      toast({ title: 'Success', description: 'File uploaded successfully' });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(null);
    }
  };

  const handleFileRemove = async (bucket: string, field: keyof CatalogItem) => {
    const filePath = item[field] as string;
    if (!filePath) return;

    try {
      const { error } = await supabase.storage.from(bucket).remove([filePath]);
      if (error) throw error;

      onChange({ [field]: null });
      toast({ title: 'Success', description: 'File removed' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getPublicUrl = (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const FileField: React.FC<{
    label: string;
    urlField: string;
    fileField: string;
    bucket: string;
    acceptedTypes: string;
    icon: React.ReactNode;
    isImage?: boolean;
  }> = ({ label, urlField, fileField, bucket, acceptedTypes, icon, isImage }) => {
    const urlValue = item[urlField as keyof CatalogItem] as string | null;
    const fileValue = item[fileField as keyof CatalogItem] as string | null;
    const hasFile = fileValue || urlValue;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label>{t('catalog.externalUrl')}</Label>
            <div className="flex gap-2">
              <Input
                value={urlValue || ''}
                onChange={(e) => onChange({ [urlField]: e.target.value || null } as Partial<CatalogItem>)}
                placeholder="https://..."
                disabled={!canEdit || !!fileValue}
              />
              {urlValue && (
                <Button variant="outline" size="icon" asChild>
                  <a href={urlValue} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* OR Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('catalog.or')}</span>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>{t('catalog.uploadFile')}</Label>
            {fileValue ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                {isImage && (
                  <img
                    src={getPublicUrl(bucket, fileValue)}
                    alt={label}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{fileValue.split('/').pop()}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                  >
                    <a
                      href={getPublicUrl(bucket, fileValue)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  </Button>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFileRemove(bucket, fileField as keyof CatalogItem)}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              canEdit && (
                <div className="relative">
                  <input
                    type="file"
                    accept={acceptedTypes}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, bucket, fileField as keyof CatalogItem);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading === fileField || !!urlValue}
                  />
                  <div className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                    {uploading === fileField ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {t('catalog.clickToUpload')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FileField
        label={t('catalog.specSheet') as string}
        urlField="spec_sheet_url"
        fileField="spec_sheet_file"
        bucket="catalog-spec-sheets"
        acceptedTypes=".pdf,.doc,.docx"
        icon={<FileText className="h-5 w-5" />}
      />

      <FileField
        label={t('catalog.testReport') as string}
        urlField="test_report_url"
        fileField="test_report_file"
        bucket="catalog-test-reports"
        acceptedTypes=".pdf,.doc,.docx"
        icon={<FileText className="h-5 w-5" />}
      />

      <FileField
        label={t('catalog.shadeRangeImage') as string}
        urlField="shade_range_image_url"
        fileField="shade_range_image_url"
        bucket="catalog-images"
        acceptedTypes="image/*"
        icon={<ImageIcon className="h-5 w-5" />}
        isImage
      />

      <FileField
        label={t('catalog.photoOfDesign') as string}
        urlField="photo_of_design_url"
        fileField="photo_of_design_url"
        bucket="catalog-images"
        acceptedTypes="image/*"
        icon={<ImageIcon className="h-5 w-5" />}
        isImage
      />
    </div>
  );
};

export default CatalogFilesTab;
