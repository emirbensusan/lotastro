import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { 
  Package, 
  ClipboardList, 
  BarChart3, 
  Settings, 
  LogOut, 
  QrCode,
  Users,
  Truck
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { path: '/', label: 'Dashboard', icon: Package, roles: ['warehouse_staff', 'accounting', 'admin'] },
    { path: '/lot-intake', label: 'LOT Intake', icon: Package, roles: ['warehouse_staff', 'admin'] },
    { path: '/inventory', label: 'Inventory', icon: ClipboardList, roles: ['warehouse_staff', 'accounting', 'admin'] },
    { path: '/orders', label: 'Orders', icon: Truck, roles: ['accounting', 'admin'] },
    { path: '/qr-scan', label: 'QR Scan', icon: QrCode, roles: ['warehouse_staff', 'accounting', 'admin'] },
    { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['accounting', 'admin'] },
    { path: '/suppliers', label: 'Suppliers', icon: Users, roles: ['admin'] },
    { path: '/admin', label: 'Admin', icon: Settings, roles: ['admin'] },
  ];

  const filteredNavigation = navigationItems.filter(item => 
    item.roles.includes(profile?.role || '')
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'accounting': return 'bg-primary text-primary-foreground';
      case 'warehouse_staff': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">Warehouse LOT Tracking</h1>
            {profile && (
              <Badge className={getRoleBadgeColor(profile.role)}>
                {profile.role.replace('_', ' ').toUpperCase()}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {profile?.full_name || profile?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r bg-card">
          <nav className="p-4 space-y-2">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => navigate(item.path)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;