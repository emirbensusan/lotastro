import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import GlobalSearch from '@/components/GlobalSearch';
import { 
  Package, 
  ClipboardList, 
  BarChart3, 
  Settings, 
  LogOut, 
  QrCode,
  Users,
  Truck,
  Clock,
  Menu,
  CheckCircle,
  ShoppingCart
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { getItemCount, setIsCartOpen } = usePOCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check if user can create orders (has cart permission)
  const canCreateOrders = profile?.role && ['accounting', 'senior_manager', 'admin'].includes(profile.role);
  const cartItemCount = getItemCount();

  const navigationItems = [
    { path: '/', label: t('dashboard'), icon: Package, roles: ['warehouse_staff', 'accounting', 'senior_manager', 'admin'] },
    { path: '/lot-intake', label: t('lotIntake'), icon: Package, roles: ['warehouse_staff', 'senior_manager', 'admin'] },
    { path: '/lot-queue', label: t('lotQueue'), icon: Clock, roles: ['accounting', 'senior_manager', 'admin'] },
    { path: '/inventory', label: t('inventory'), icon: ClipboardList, roles: ['warehouse_staff', 'accounting', 'senior_manager', 'admin'] },
    { path: '/orders', label: t('orders'), icon: Truck, roles: ['accounting', 'senior_manager', 'admin'] },
    { path: '/order-queue', label: t('orderQueue'), icon: Clock, roles: ['accounting', 'senior_manager', 'admin'] },
    { path: '/qr-scan', label: t('qrScan'), icon: QrCode, roles: ['warehouse_staff', 'accounting', 'senior_manager', 'admin'] },
    { path: '/reports', label: t('reports'), icon: BarChart3, roles: ['accounting', 'senior_manager', 'admin'] },
    { path: '/approvals', label: t('approvals'), icon: CheckCircle, roles: ['senior_manager', 'admin'] },
    { path: '/suppliers', label: t('suppliers'), icon: Users, roles: ['admin'] },
    { path: '/admin', label: t('admin'), icon: Settings, roles: ['admin'] },
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

  const NavigationContent = () => (
    <nav className="space-y-2">
      {filteredNavigation.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        
        return (
          <Button
            key={item.path}
            variant={isActive ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => {
              navigate(item.path);
              setSidebarOpen(false);
            }}
          >
            <Icon className="h-4 w-4 mr-2" />
            {item.label}
          </Button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-primary">LotAstro</h2>
                </div>
                <NavigationContent />
              </SheetContent>
            </Sheet>

            {/* LotAstro Logo */}
            <div className="flex items-center space-x-2">
            <img 
              src="/lotastro-logo.svg" 
              alt="LotAstro Logo" 
              className="w-8 h-8 object-contain"
            />
              <h1 className="text-xl font-semibold text-primary">LotAstro</h1>
            </div>
            
            {profile && (
              <Badge className={getRoleBadgeColor(profile.role)}>
                {profile.role.replace('_', ' ').toUpperCase()}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <GlobalSearch />
            
            <Select value={language} onValueChange={(value: 'en' | 'tr') => setLanguage(value)}>
              <SelectTrigger className="w-16 md:w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">🇺🇸</SelectItem>
                <SelectItem value="tr">🇹🇷</SelectItem>
              </SelectContent>
            </Select>

            {/* Cart Icon - Only visible to users who can create orders */}
            {canCreateOrders && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsCartOpen(true)}
                className="relative"
              >
                <ShoppingCart className="h-4 w-4" />
                {cartItemCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {cartItemCount}
                  </Badge>
                )}
              </Button>
            )}
            
            <span className="text-sm text-muted-foreground hidden md:block">
              {profile?.full_name || profile?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{t('signOut')}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:block w-64 border-r bg-card">
          <div className="p-4">
            <NavigationContent />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;