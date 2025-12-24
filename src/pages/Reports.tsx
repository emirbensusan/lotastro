import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Calendar, FileText, Mail, Settings, History, PlusCircle } from 'lucide-react';
import ViewReportsTab from '@/components/reports/ViewReportsTab';
import ReportSettingsTab from '@/components/reports/ReportSettingsTab';
import ReportTemplatesTab from '@/components/reports/ReportTemplatesTab';
import DigestsTab from '@/components/reports/DigestsTab';
import ScheduledReportsTab from '@/components/reports/ScheduledReportsTab';
import ReportExecutionHistory from '@/components/reports/ReportExecutionHistory';
import ReportBuilderTab from '@/components/reports/ReportBuilderTab';

const Reports: React.FC = () => {
  const { loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { t, language } = useLanguage();

  if (authLoading || permissionsLoading) {
    return <div className="text-sm text-muted-foreground">{t('loading')}</div>;
  }

  if (!hasPermission('reports', 'viewreports')) {
    return <div className="text-sm text-muted-foreground">{t('noPermission')}</div>;
  }

  const canManageReports = hasPermission('reports', 'managereports');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('reportsAndAnalytics')}</h1>
      </div>

      <Tabs defaultValue="view" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex md:grid-cols-none">
          <TabsTrigger value="view" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('viewReportsTab')}</span>
            <span className="sm:hidden">{t('view')}</span>
          </TabsTrigger>
          {canManageReports && (
            <>
              <TabsTrigger value="builder" className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline">{language === 'tr' ? 'Rapor Oluştur' : 'Build Report'}</span>
                <span className="sm:hidden">{language === 'tr' ? 'Oluştur' : 'Build'}</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">{t('executionHistory')}</span>
                <span className="sm:hidden">{t('history')}</span>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">{t('scheduledReports')}</span>
                <span className="sm:hidden">{t('scheduled')}</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reportTemplates')}</span>
                <span className="sm:hidden">{t('templates')}</span>
              </TabsTrigger>
              <TabsTrigger value="digests" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">{t('emailDigests')}</span>
                <span className="sm:hidden">{t('digests')}</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reportSettings')}</span>
                <span className="sm:hidden">{t('settingsPanel')}</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="view" className="mt-6">
          <ViewReportsTab />
        </TabsContent>

        {canManageReports && (
          <>
            <TabsContent value="builder" className="mt-6">
              <ReportBuilderTab />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <ReportExecutionHistory />
            </TabsContent>

            <TabsContent value="scheduled" className="mt-6">
              <ScheduledReportsTab />
            </TabsContent>

            <TabsContent value="templates" className="mt-6">
              <ReportTemplatesTab />
            </TabsContent>

            <TabsContent value="digests" className="mt-6">
              <DigestsTab />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <ReportSettingsTab />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default Reports;
