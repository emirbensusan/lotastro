import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Shield } from 'lucide-react';

interface Permission {
  category: string;
  action: string;
  warehouse_staff: boolean;
  accounting: boolean;
  senior_manager: boolean;
  admin: boolean;
}

const permissions: Permission[] = [
  // User Management (Admin Only)
  { category: 'User Management', action: 'View Users', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'User Management', action: 'Create Users', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'User Management', action: 'Edit Users', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'User Management', action: 'Delete Users', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'User Management', action: 'Manage Roles', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'User Management', action: 'Change Permissions', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },

  // Inventory Management
  { category: 'Inventory', action: 'Create Lot Entries', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { category: 'Inventory', action: 'View Inventory', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { category: 'Inventory', action: 'Edit Lot Information', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
  { category: 'Inventory', action: 'Delete Lot Entries', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'Inventory', action: 'Generate QR Codes', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },

  // Order Management
  { category: 'Orders', action: 'View Orders', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { category: 'Orders', action: 'Create Orders', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
  { category: 'Orders', action: 'Edit Orders', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
  { category: 'Orders', action: 'Delete Orders', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
  { category: 'Orders', action: 'Fulfill Orders', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { category: 'Orders', action: 'Print Order Documents', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },

  // Supplier Management (Admin Only)
  { category: 'Suppliers', action: 'View Suppliers', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { category: 'Suppliers', action: 'Create Suppliers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'Suppliers', action: 'Edit Suppliers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'Suppliers', action: 'Delete Suppliers', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },

  // Reporting & Analytics (Admin Only)
  { category: 'Reports', action: 'View Reports', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'Reports', action: 'Export Reports', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },
  { category: 'Reports', action: 'Access Dashboard Analytics', warehouse_staff: false, accounting: false, senior_manager: false, admin: true },

  // QR Code & Document Management
  { category: 'QR & Documents', action: 'Scan QR Codes', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { category: 'QR & Documents', action: 'Print Lot Labels', warehouse_staff: true, accounting: true, senior_manager: true, admin: true },
  { category: 'QR & Documents', action: 'Bulk QR Generation', warehouse_staff: false, accounting: true, senior_manager: true, admin: true },
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
  const categories = [...new Set(permissions.map(p => p.category))];
  const roles = ['warehouse_staff', 'accounting', 'senior_manager', 'admin'] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Hierarchy & Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {roles.map(role => (
                <div key={role} className="text-center">
                  <Badge className={getRoleColor(role)}>
                    {role.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {role === 'warehouse_staff' && 'Basic operations'}
                    {role === 'accounting' && 'Financial operations'}
                    {role === 'senior_manager' && 'All operations except user management'}
                    {role === 'admin' && 'Full system access'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {categories.map(category => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-center">Warehouse Staff</TableHead>
                  <TableHead className="text-center">Accounting</TableHead>
                  <TableHead className="text-center">Senior Manager</TableHead>
                  <TableHead className="text-center">Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions
                  .filter(p => p.category === category)
                  .map((permission, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{permission.action}</TableCell>
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