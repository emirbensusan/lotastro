import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import { useViewAsRole } from '@/contexts/ViewAsRoleContext';
import GlobalSearch from '@/components/GlobalSearch';
import { 
  Home,
  PackagePlus, 
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
  ShoppingCart,
  ListOrdered,
  Timer
} from 'lucide-react';
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { language, setLanguage, t } = useLanguage();
  const { getItemCount, setIsCartOpen } = usePOCart();
  const { viewAsRole, setViewAsRole, isViewingAsOtherRole } = useViewAsRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get effective role (viewAsRole if viewing as another role, otherwise actual role)
  const effectiveRole = viewAsRole || profile?.role;
  
  // Check if user can create orders (has cart permission)
  const canCreateOrders = effectiveRole && ['accounting', 'senior_manager', 'admin'].includes(effectiveRole);
  const cartItemCount = getItemCount();

  const navigationItems = [
    { path: '/', label: t('dashboard'), icon: Home, permission: { category: 'reports', action: 'accessdashboard' } },
    { path: '/lot-intake', label: t('lotIntake'), icon: PackagePlus, permission: { category: 'inventory', action: 'createlotentries' } },
    { path: '/lot-queue', label: t('lotQueue'), icon: Timer, permission: { category: 'inventory', action: 'createlotentries' } },
    { path: '/inventory', label: t('inventory'), icon: ClipboardList, permission: { category: 'inventory', action: 'viewinventory' } },
    { path: '/orders', label: t('orders'), icon: Truck, permission: { category: 'orders', action: 'vieworders' } },
    { path: '/order-queue', label: t('orderQueue'), icon: ListOrdered, permission: { category: 'orders', action: 'createorders' } },
    { path: '/qr-scan', label: t('qrScan'), icon: QrCode, permission: { category: 'qrdocuments', action: 'scanqrcodes' } },
    { path: '/reports', label: t('reports'), icon: BarChart3, permission: { category: 'reports', action: 'viewreports' } },
    { path: '/approvals', label: 'Değişiklik Talepleri', icon: CheckCircle, permission: { category: 'approvals', action: 'viewapprovals' } },
    { path: '/suppliers', label: t('suppliers'), icon: Users, permission: { category: 'suppliers', action: 'viewsuppliers' } },
    { path: '/admin', label: t('admin'), icon: Settings, permission: { category: 'usermanagement', action: 'viewusers' } },
  ];

  // Wait for permissions to load before filtering navigation
  const filteredNavigation = permissionsLoading 
    ? [] 
    : navigationItems.filter(item => 
        hasPermission(item.permission.category, item.permission.action)
      );

  const getRoleBadgeColor = (role: string, isViewingAs = false) => {
    const baseColors = {
      'admin': 'bg-destructive text-destructive-foreground',
      'accounting': 'bg-primary text-primary-foreground', 
      'senior_manager': 'bg-yellow-500 text-yellow-50',
      'warehouse_staff': 'bg-secondary text-secondary-foreground',
    };
    
    const color = baseColors[role as keyof typeof baseColors] || 'bg-muted text-muted-foreground';
    
    // Add visual indicator when viewing as another role
    return isViewingAs ? `${color} ring-2 ring-orange-400` : color;
  };

  const roleOptions = [
    { value: 'warehouse_staff', label: 'Warehouse Staff' },
    { value: 'accounting', label: 'Accounting' },
    { value: 'senior_manager', label: 'Senior Manager' },
    { value: 'admin', label: 'Admin' }
  ];

  const handleRoleChange = (role: string) => {
    if (role === 'reset') {
      setViewAsRole(null);
    } else {
      setViewAsRole(role as any);
    }
  };

  const AppSidebar = () => {
    const { state } = useSidebar();
    const isCollapsed = state === "collapsed";
    
    return (
      <Sidebar collapsible="icon" className="flex flex-col mt-16 h-[calc(100vh-4rem)]">
        <SidebarContent>
          <SidebarGroup className="flex-1">
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {permissionsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  filteredNavigation.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;
                  
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.path)}
                        isActive={active}
                        className="flex items-center justify-start h-10"
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className={isCollapsed ? "sr-only" : "ml-2"}>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    );
  };

  const MobileNavigationContent = () => (
    <nav className="space-y-2">
      {permissionsLoading ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : (
        filteredNavigation.map((item) => {
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
      })
      )}
    </nav>
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        {/* Top Navigation */}
        <header className="fixed top-0 left-0 right-0 z-50 border-b bg-card">
          <div className="flex h-16 items-center justify-between px-4 md:px-6">
            <div className="flex items-center space-x-4">
              {/* Desktop Sidebar Toggle */}
              <SidebarTrigger className="hidden md:block" />
              
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
                  <MobileNavigationContent />
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
                <>
                  {profile.role === 'admin' ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-auto">
                          <Badge className={getRoleBadgeColor(effectiveRole!, isViewingAsOtherRole)}>
                            {isViewingAsOtherRole && (
                              <span className="text-xs mr-1">👁️</span>
                            )}
                            {(effectiveRole || '').replace('_', ' ').toUpperCase()}
                          </Badge>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56" align="start">
                        <div className="space-y-3">
                          <div className="font-medium text-sm">View as Role</div>
                          <div className="space-y-2">
                            {roleOptions.map((option) => (
                              <Button
                                key={option.value}
                                variant={effectiveRole === option.value ? "secondary" : "ghost"}
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => handleRoleChange(option.value)}
                              >
                                {option.label}
                                {effectiveRole === option.value && !isViewingAsOtherRole && (
                                  <span className="ml-auto text-xs">(Current)</span>
                                )}
                              </Button>
                            ))}
                            {isViewingAsOtherRole && (
                              <>
                                <div className="border-t pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleRoleChange('reset')}
                                  >
                                    Return to Admin View
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Badge className={getRoleBadgeColor(profile.role)}>
                      {profile.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  )}
                </>
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

        <div className="flex w-full pt-16">
          {/* Desktop Sidebar */}
          <div className="hidden md:block">
            <AppSidebar />
          </div>

          {/* Main Content */}
          <main className="flex-1">
            <div className="p-4 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;