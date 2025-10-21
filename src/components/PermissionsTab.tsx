import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Permission {
  categoryKey: string;
  actionKey: string;
  warehouse_staff: boolean;
  accounting: boolean;
  senior_manager: boolean;
  admin: boolean;
}

const permissions: Permission[] = [
  // User Management (Admin Only)
  { categoryKey: 'categoryUserManagement', actionKey: 'actionViewUsers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionCreateUsers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionEditUsers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionDeleteUsers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionManageRoles', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categoryUserManagement', actionKey: 'actionChangePermissions', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },

  // Inventory Management
  { categoryKey: 'categoryInventory', actionKey: 'actionCreateLotEntries', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionViewInventory', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionEditLotInfo', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionDeleteLotEntries', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionGenerateQrCodes', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionReceiveIncoming', warehouse_staff: true, accounting: true, senior_manager: false, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionUnreceiveIncoming', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categoryInventory', actionKey: 'actionDeleteIncoming', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },

  // Order Management
  { categoryKey: 'categoryOrders', actionKey: 'actionViewOrders', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionCreateOrders', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionEditOrders', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionDeleteOrders', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionFulfillOrders', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryOrders', actionKey: 'actionPrintOrderDocs', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },

  // Supplier Management (Admin Only)
  { categoryKey: 'categorySuppliers', actionKey: 'actionViewSuppliers', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categorySuppliers', actionKey: 'actionCreateSuppliers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categorySuppliers', actionKey: 'actionEditSuppliers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categorySuppliers', actionKey: 'actionDeleteSuppliers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },

  // Reporting & Analytics (Admin Only)
  { categoryKey: 'categoryReports', actionKey: 'actionViewReports', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categoryReports', actionKey: 'actionExportReports', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { categoryKey: 'categoryReports', actionKey: 'actionAccessDashboard', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },

  // QR Code & Document Management
  { categoryKey: 'categoryQrDocuments', actionKey: 'actionScanQrCodes', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryQrDocuments', actionKey: 'actionPrintLotLabels', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryQrDocuments', actionKey: 'actionBulkQrGeneration', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
  
  // Audit Logs
  { categoryKey: 'categoryAuditLogs', actionKey: 'actionViewOwnLogs', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { categoryKey: 'categoryAuditLogs', actionKey: 'actionViewAllLogs', warehouse_staff: false, accounting: false, senior_manager: true, admin: true },
  { categoryKey: 'categoryAuditLogs', actionKey: 'actionReverseActions', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
];

const getRoleColor = (role: string) => {
  switch (role) {
    case 'admin': return 'bg-red-100 text-red-800';
    case 'senior_manager': return 'bg-blue-100 text-blue-800';
    case 'accounting': return 'bg-green-100 text-green-800';
    case 'warehouse_staff': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const PermissionsTab: React.FC = () => {
  const { t } = useLanguage();
  const categories = [...new Set(permissions.map(p => p.categoryKey))];
  const roles = ['warehouse_staff', 'accounting', 'senior_manager', 'admin'] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('permissionsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {roles.map(role => {
                const roleKey = role.split('_').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join('');
                return (
                  <div key={role} className="text-center">
                    <Badge className={getRoleColor(role)}>
                      {t(`role${roleKey}`)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t(`roleDesc${roleKey}`)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {categories.map(category => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{t(category)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('tableHeaderAction')}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderWarehouseStaff')}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderAccounting')}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderSeniorManager')}</TableHead>
                    <TableHead className="text-center">{t('tableHeaderAdmin')}</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {permissions
                  .filter(p => p.categoryKey === category)
                  .map((permission, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{t(permission.actionKey)}</TableCell>
                      <TableCell className="text-center">
                        {permission.warehouse_staff ? (
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
                        {permission.senior_manager ? (
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PermissionsTab;