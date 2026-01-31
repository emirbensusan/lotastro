import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Shield, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Permission matrix aligned with WMS_IMPLEMENTATION_PLAN_v1_0_23.md
 * 
 * Role Taxonomy:
 * - CRM-defined roles (from org_access.updated grants): sales_owner, sales_manager, pricing, accounting, admin
 * - WMS operational roles (from profiles.role): warehouse_staff, senior_manager, admin
 * 
 * Multi-Org UI Policy (per plan Section "MULTI-ORG UI RULES (LOCKED)"):
 * - Can toggle "All Orgs": sales_manager, accounting, pricing, admin
 * - Cannot toggle "All Orgs": sales_owner (even if multi-org grants exist)
 * - Warehouse roles: org toggle hidden, org badges/columns hidden (minimized UI)
 */

interface Permission {
  categoryKey: string;
  actionKey: string;
  warehouse_staff: boolean;
  sales_owner: boolean;
  sales_manager: boolean;
  pricing: boolean;
  accounting: boolean;
  admin: boolean;
}

const permissions: Permission[] = [
  // User Management (Admin Only)
  { categoryKey: 'categoryUserManagement', actionKey: 'actionViewUsers', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionCreateUsers', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionEditUsers', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionDeleteUsers', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionManageRoles', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionChangePermissions', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },

  // Multi-Org Access (per WMS plan)
  { categoryKey: 'categoryMultiOrg', actionKey: 'actionToggleAllOrgs', warehouse_staff: false, sales_owner: false, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryMultiOrg', actionKey: 'actionViewOrgLabels', warehouse_staff: false, sales_owner: false, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryMultiOrg', actionKey: 'actionSwitchOrgContext', warehouse_staff: false, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },

  // Inventory Management
  { categoryKey: 'categoryInventory', actionKey: 'actionCreateLotEntries', warehouse_staff: true, sales_owner: false, sales_manager: true, pricing: false, accounting: true, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionViewInventory', warehouse_staff: true, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionEditLotInfo', warehouse_staff: false, sales_owner: false, sales_manager: true, pricing: false, accounting: true, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionDeleteLotEntries', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionGenerateQrCodes', warehouse_staff: true, sales_owner: false, sales_manager: true, pricing: false, accounting: true, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionReceiveIncoming', warehouse_staff: true, sales_owner: false, sales_manager: true, pricing: false, accounting: true, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionUnreceiveIncoming', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionDeleteIncoming', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },

  // Order Management
  { categoryKey: 'categoryOrders', actionKey: 'actionViewOrders', warehouse_staff: true, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionCreateOrders', warehouse_staff: false, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionEditOrders', warehouse_staff: false, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionDeleteOrders', warehouse_staff: false, sales_owner: false, sales_manager: true, pricing: false, accounting: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionFulfillOrders', warehouse_staff: true, sales_owner: false, sales_manager: true, pricing: false, accounting: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionPrintOrderDocs', warehouse_staff: true, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },

  // Pricing Management (per WMS plan - pricing role specific)
  { categoryKey: 'categoryPricing', actionKey: 'actionViewPricing', warehouse_staff: false, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryPricing', actionKey: 'actionEditPricing', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: true, accounting: false, admin: true },
  { categoryKey: 'categoryPricing', actionKey: 'actionApproveDiscounts', warehouse_staff: false, sales_owner: false, sales_manager: true, pricing: true, accounting: false, admin: true },
  { categoryKey: 'categoryPricing', actionKey: 'actionOverrideThresholds', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: true, accounting: false, admin: true },

  // Supplier Management
  { categoryKey: 'categorySuppliers', actionKey: 'actionViewSuppliers', warehouse_staff: true, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categorySuppliers', actionKey: 'actionCreateSuppliers', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categorySuppliers', actionKey: 'actionEditSuppliers', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categorySuppliers', actionKey: 'actionDeleteSuppliers', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },

  // Reporting & Analytics
  { categoryKey: 'categoryReports', actionKey: 'actionViewReports', warehouse_staff: false, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryReports', actionKey: 'actionExportReports', warehouse_staff: false, sales_owner: false, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryReports', actionKey: 'actionAccessDashboard', warehouse_staff: false, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },

  // QR Code & Document Management
  { categoryKey: 'categoryQrDocuments', actionKey: 'actionScanQrCodes', warehouse_staff: true, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryQrDocuments', actionKey: 'actionPrintLotLabels', warehouse_staff: true, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryQrDocuments', actionKey: 'actionBulkQrGeneration', warehouse_staff: false, sales_owner: false, sales_manager: true, pricing: false, accounting: true, admin: true },
  
  // Audit Logs
  { categoryKey: 'categoryAuditLogs', actionKey: 'actionViewOwnLogs', warehouse_staff: true, sales_owner: true, sales_manager: true, pricing: true, accounting: true, admin: true },
  { categoryKey: 'categoryAuditLogs', actionKey: 'actionViewAllLogs', warehouse_staff: false, sales_owner: false, sales_manager: true, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categoryAuditLogs', actionKey: 'actionReverseActions', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },

  // Integration & CRM (per WMS plan)
  { categoryKey: 'categoryIntegration', actionKey: 'actionViewIntegrationLogs', warehouse_staff: false, sales_owner: false, sales_manager: true, pricing: false, accounting: true, admin: true },
  { categoryKey: 'categoryIntegration', actionKey: 'actionRetryFailedEvents', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
  { categoryKey: 'categoryIntegration', actionKey: 'actionViewContractViolations', warehouse_staff: false, sales_owner: false, sales_manager: false, pricing: false, accounting: false, admin: true },
];

const getRoleColor = (role: string) => {
  switch (role) {
    case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'sales_manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'pricing': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'accounting': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'sales_owner': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    case 'warehouse_staff': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};

// Role descriptions per WMS plan
const roleDescriptions: Record<string, { canToggleOrg: boolean; showOrgLabels: boolean }> = {
  warehouse_staff: { canToggleOrg: false, showOrgLabels: false },
  sales_owner: { canToggleOrg: false, showOrgLabels: false },
  sales_manager: { canToggleOrg: true, showOrgLabels: true },
  pricing: { canToggleOrg: true, showOrgLabels: true },
  accounting: { canToggleOrg: true, showOrgLabels: true },
  admin: { canToggleOrg: true, showOrgLabels: true },
};

const PermissionsTab: React.FC = () => {
  const { t } = useLanguage();
  const categories = [...new Set(permissions.map(p => p.categoryKey))];
  
  // Role order: WMS operational first, then CRM roles by privilege level
  const roles = ['warehouse_staff', 'sales_owner', 'sales_manager', 'pricing', 'accounting', 'admin'] as const;

  const getRoleDisplayName = (role: string) => {
    const roleKey = role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    return t(`role${roleKey}`) || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getRoleDescription = (role: string) => {
    const roleKey = role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    return t(`roleDesc${roleKey}`) || '';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('permissionsTitle') || 'Role Permissions Matrix'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('permissionsSubtitle') || 'Aligned with WMS Implementation Plan v1.0.23'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {roles.map(role => {
                const orgPolicy = roleDescriptions[role];
                return (
                  <div key={role} className="text-center p-3 rounded-lg border">
                    <Badge className={getRoleColor(role)}>
                      {getRoleDisplayName(role)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      {getRoleDescription(role)}
                    </p>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      {orgPolicy.canToggleOrg ? (
                        <Eye className="h-3 w-3 text-green-600" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {orgPolicy.canToggleOrg 
                          ? (t('canToggleAllOrgs') || 'Multi-org') 
                          : (t('singleOrgOnly') || 'Single-org')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Org UI Policy Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('categoryMultiOrgPolicy') || 'Multi-Org UI Policy'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('multiOrgPolicyDesc') || 'Per WMS_IMPLEMENTATION_PLAN_v1_0_23.md Section "MULTI-ORG UI RULES (LOCKED)"'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <h4 className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {t('canToggleAllOrgsTitle') || 'Can Toggle "All Orgs"'}
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                sales_manager, accounting, pricing, admin
              </p>
            </div>
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                {t('cannotToggleAllOrgsTitle') || 'Cannot Toggle "All Orgs"'}
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                sales_owner, warehouse_staff (even with multi-org grants)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {categories.map(category => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{t(category) || category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">{t('tableHeaderAction') || 'Action'}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderWarehouseStaff') || 'Warehouse'}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderSalesOwner') || 'Sales Owner'}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderSalesManager') || 'Sales Mgr'}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderPricing') || 'Pricing'}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderAccounting') || 'Accounting'}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderAdmin') || 'Admin'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions
                    .filter(p => p.categoryKey === category)
                    .map((permission, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{t(permission.actionKey) || permission.actionKey}</TableCell>
                        <TableCell className="text-center">
                          {permission.warehouse_staff ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {permission.sales_owner ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {permission.sales_manager ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {permission.pricing ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {permission.accounting ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {permission.admin ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PermissionsTab;
