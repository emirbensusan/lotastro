import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Shield, Save, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Permission {
  categoryKey: string;
  actionKey: string;
  warehouse_staff: boolean;
  accounting: boolean;
  senior_manager: boolean;
  admin: boolean;
}

interface RolePermission {
  id: string;
  role: string;
  permission_category: string;
  permission_action: string;
  is_allowed: boolean;
}

const defaultPermissions: Permission[] = [
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

  // Approvals (Change Request Management)
  { categoryKey: 'categoryApprovals', actionKey: 'actionViewApprovals', warehouse_staff: false, accounting: false, senior_manager: true, admin: true },
  { categoryKey: 'categoryApprovals', actionKey: 'actionApproveChanges', warehouse_staff: false, accounting: false, senior_manager: true, admin: true },
  { categoryKey: 'categoryApprovals', actionKey: 'actionRejectChanges', warehouse_staff: false, accounting: false, senior_manager: true, admin: true },
  
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

const InteractivePermissionsTab: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>(defaultPermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const categories = [...new Set(permissions.map(p => p.categoryKey))];
  const roles = ['warehouse_staff', 'accounting', 'senior_manager', 'admin'] as const;

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        // Convert database data to permission format
        const updatedPermissions = defaultPermissions.map(defaultPerm => {
          const dbPermissions: Record<string, boolean> = {};
          
          roles.forEach(role => {
            const dbPerm = data.find(d => 
              d.role === role && 
              d.permission_category === defaultPerm.categoryKey.replace('category', '').toLowerCase() &&
              d.permission_action === defaultPerm.actionKey.replace('action', '').toLowerCase()
            );
            
            dbPermissions[role] = dbPerm ? dbPerm.is_allowed : defaultPerm[role as keyof Permission] as boolean;
          });

          return {
            ...defaultPerm,
            ...dbPermissions
          };
        });

        setPermissions(updatedPermissions);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load permissions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (categoryKey: string, actionKey: string, role: string) => {
    if (!hasRole('admin')) return;

    setPermissions(prev => 
      prev.map(p => 
        p.categoryKey === categoryKey && p.actionKey === actionKey
          ? { ...p, [role]: !p[role as keyof Permission] }
          : p
      )
    );
    setHasChanges(true);
  };

  const savePermissions = async () => {
    if (!hasRole('admin')) return;

    setSaving(true);
    try {
      // Clear existing permissions
      await supabase.from('role_permissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Insert updated permissions
      const permissionsToInsert: any[] = [];
      
      permissions.forEach(perm => {
        roles.forEach(role => {
          permissionsToInsert.push({
            role,
            permission_category: perm.categoryKey.replace('category', '').toLowerCase(),
            permission_action: perm.actionKey.replace('action', '').toLowerCase(),
            is_allowed: perm[role as keyof Permission]
          });
        });
      });

      const { error } = await supabase
        .from('role_permissions')
        .insert(permissionsToInsert);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Permissions updated successfully'
      });
      
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to save permissions',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (!hasRole('admin')) return;
    
    setPermissions(defaultPermissions);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>{t('permissionsTitle')}</CardTitle>
            </div>
            {hasRole('admin') && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>
                <Button
                  size="sm"
                  onClick={savePermissions}
                  disabled={!hasChanges || saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
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
                      {roles.map(role => (
                        <TableCell key={role} className="text-center">
                          <Switch
                            checked={permission[role as keyof Permission] as boolean}
                            onCheckedChange={() => togglePermission(permission.categoryKey, permission.actionKey, role)}
                            disabled={!hasRole('admin')}
                          />
                        </TableCell>
                      ))}
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

export default InteractivePermissionsTab;