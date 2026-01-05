import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import GlobalSearch from '@/components/GlobalSearch';
import { NetworkStatusIndicator } from '@/components/ui/network-status-indicator';
import { SyncStatusBadge } from '@/components/offline/SyncStatusBadge';
import { ConflictResolutionDialog } from '@/components/offline/ConflictResolutionDialog';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { CommandPalette } from '@/components/keyboard/CommandPalette';
import { ShortcutsHelp } from '@/components/keyboard/ShortcutsHelp';
import { HelpPanel } from '@/components/help/HelpPanel';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
// useTour removed for debugging
import { useOffline } from '@/contexts/OfflineContext';
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
  Calendar,
  Menu,
  CheckCircle,
  ShoppingCart,
  ListOrdered,
  Timer,
  History,
  TruckIcon,
  PackageCheck,
  Factory,
  TrendingUp,
  BookOpen,
  ClipboardCheck,
  FileSearch,
  HelpCircle,
  Keyboard
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
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const { conflicts, showConflictDialog, setShowConflictDialog, syncStatus, resolveConflict } = useOffline();
  
  // Tour context removed for debugging
  const tourContext = null;
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: () => setCommandPaletteOpen(true),
    onShowShortcuts: () => setShortcutsHelpOpen(true),
    onClose: () => {
      setCommandPaletteOpen(false);
      setShortcutsHelpOpen(false);
      setHelpPanelOpen(false);
    },
    enabled: true
  });

  // Get effective role (viewAsRole if viewing as another role, otherwise actual role)
  const effectiveRole = viewAsRole || profile?.role;
  
  // Check if user can create orders (has cart permission)
  const canCreateOrders = effectiveRole && ['accounting', 'senior_manager', 'admin'].includes(effectiveRole);
  const cartItemCount = getItemCount();

  interface NavigationGroup {
    label: string;
    items: Array<{
      path: string;
      label: string;
      icon: any;
      permission: { category: string; action: string };
      tourId?: string;
    }>;
  }

  const navigationGroups: NavigationGroup[] = [
    {
      label: String(t('overview')),
      items: [
        { path: '/', label: String(t('dashboard')), icon: Home, permission: { category: 'reports', action: 'accessdashboard' }, tourId: 'dashboard' },
      ]
    },
    {
      label: String(t('inventoryManagement')),
      items: [
        { path: '/catalog', label: String(t('catalog.title')), icon: BookOpen, permission: { category: 'catalog', action: 'view' }, tourId: 'catalog' },
        { path: '/lot-intake', label: String(t('lotIntake')), icon: PackagePlus, permission: { category: 'inventory', action: 'createlotentries' }, tourId: 'lot-intake' },
        { path: '/lot-queue', label: String(t('lotQueue')), icon: Timer, permission: { category: 'inventory', action: 'viewlotqueue' } },
        { path: '/inventory', label: String(t('inventory')), icon: ClipboardList, permission: { category: 'inventory', action: 'viewinventory' }, tourId: 'inventory' },
        { path: '/incoming-stock', label: String(t('incomingStockLabel')), icon: TruckIcon, permission: { category: 'inventory', action: 'viewincoming' }, tourId: 'incoming-stock' },
        { path: '/manufacturing-orders', label: String(t('mo.title')), icon: Factory, permission: { category: 'inventory', action: 'viewincoming' } },
        { path: '/forecast', label: String(t('forecast.title') || 'Forecast'), icon: TrendingUp, permission: { category: 'forecasting', action: 'viewforecasts' }, tourId: 'forecast' },
        { path: '/goods-receipt', label: String(t('goodsReceipt')), icon: PackageCheck, permission: { category: 'inventory', action: 'receiveincoming' } },
      ]
    },
    {
      label: String(t('ordersAndReservations')),
      items: [
        { path: '/orders', label: String(t('orders')), icon: Truck, permission: { category: 'orders', action: 'vieworders' }, tourId: 'orders' },
        { path: '/reservations', label: String(t('reservations')), icon: Calendar, permission: { category: 'orders', action: 'vieworders' }, tourId: 'reservations' },
        { path: '/order-queue', label: String(t('orderQueue')), icon: ListOrdered, permission: { category: 'orders', action: 'createorders' }, tourId: 'order-queue' },
      ]
    },
    {
      label: String(t('toolsAndUtilities')),
      items: [
        { path: '/stock-take', label: String(t('stocktake.title')), icon: ClipboardCheck, permission: { category: 'stocktake', action: 'startsession' }, tourId: 'stock-take' },
        { path: '/stock-take-review', label: String(t('stocktake.review.navLabel')), icon: FileSearch, permission: { category: 'stocktake', action: 'reviewsessions' } },
        { path: '/qr-scan', label: String(t('qrScan')), icon: QrCode, permission: { category: 'qrdocuments', action: 'scanqrcodes' }, tourId: 'qr-scan' },
        { path: '/approvals', label: String(t('approvalRequests')), icon: CheckCircle, permission: { category: 'approvals', action: 'viewapprovals' }, tourId: 'approvals' },
      ]
    },
    {
      label: String(t('reportsAndAdmin')),
      items: [
        { path: '/reports', label: String(t('reports')), icon: BarChart3, permission: { category: 'reports', action: 'viewreports' }, tourId: 'reports' },
        { path: '/audit-logs', label: String(t('actionHistory')), icon: History, permission: { category: 'auditlogs', action: 'viewalllogs' }, tourId: 'audit-logs' },
        { path: '/suppliers', label: String(t('suppliers')), icon: Users, permission: { category: 'suppliers', action: 'viewsuppliers' } },
        { path: '/admin', label: String(t('settings')), icon: Settings, permission: { category: 'usermanagement', action: 'viewusers' }, tourId: 'admin' },
      ]
    }
  ];

  // Wait for permissions to load before filtering navigation
  const filteredNavigationGroups = permissionsLoading 
    ? [] 
    : navigationGroups.map(group => ({
        ...group,
        items: group.items.filter(item => hasPermission(item.permission.category, item.permission.action))
      })).filter(group => group.items.length > 0);

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
      <Sidebar collapsible="icon" className="flex flex-col h-full border-r">
        <SidebarContent>
          {permissionsLoading ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            filteredNavigationGroups.map((group) => (
              <SidebarGroup key={group.label}>
                {!isCollapsed && (
                  <SidebarGroupLabel className="text-xs text-muted-foreground">
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = location.pathname === item.path;
                      
                      return (
                        <SidebarMenuItem key={item.path} data-tour={item.tourId}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            size="sm"
                            className="flex items-center justify-start"
                          >
                            <Link 
                              to={item.path}
                              title={isCollapsed ? item.label : undefined}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className={isCollapsed ? "sr-only" : "ml-2"}>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
          )}
        </SidebarContent>
      </Sidebar>
    );
  };

  const MobileNavigationContent = () => (
    <nav className="space-y-4">
      {permissionsLoading ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : (
        filteredNavigationGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground px-2">
              {group.label}
            </h3>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center w-full justify-start min-h-touch px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-secondary text-secondary-foreground' 
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))
      )}
    </nav>
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen-safe bg-background flex w-full">
        {/* Desktop Sidebar - direct flex child, no wrapper */}
        <AppSidebar />

        {/* Main content area including header */}
        <div className="flex-1 flex flex-col min-h-screen-safe min-w-0 overflow-hidden">
          {/* Top Navigation - sticky within content flow */}
          <header className="sticky top-0 z-50 border-b bg-card shrink-0 pt-safe">
            <div className="flex h-11 sm:h-12 items-center justify-between px-2 sm:px-3 md:px-4 gap-1 sm:gap-2">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink">
                {/* Desktop Sidebar Toggle */}
                <SidebarTrigger className="hidden md:flex h-8 w-8" />
                
                {/* Mobile menu button */}
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden h-10 w-10 sm:h-8 sm:w-8 flex-shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0">
                      <Menu className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64 p-4 pt-safe">
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold text-primary">LotAstro</h2>
                    </div>
                    <MobileNavigationContent />
                  </SheetContent>
                </Sheet>

                {/* LotAstro Logo */}
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <img 
                    src="/lotastro-logo.svg" 
                    alt="LotAstro Logo" 
                    className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0"
                  />
                  <h1 className="text-base sm:text-lg md:text-xl font-semibold text-primary truncate hidden xs:block sm:block">LotAstro</h1>
                </div>
                
                {profile && (
                  <>
                    {profile.role === 'admin' ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-auto flex-shrink-0">
                            <Badge className={`${getRoleBadgeColor(effectiveRole!, isViewingAsOtherRole)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`}>
                              {isViewingAsOtherRole && (
                                <span className="text-[10px] mr-0.5 sm:mr-1">👁️</span>
                              )}
                              <span className="hidden sm:inline">{(effectiveRole || '').replace('_', ' ').toUpperCase()}</span>
                              <span className="sm:hidden">{(effectiveRole || '').charAt(0).toUpperCase()}</span>
                            </Badge>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56" align="start">
                          <div className="space-y-3">
                            <div className="font-medium text-sm">{t('viewAsRole')}</div>
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
                                    <span className="ml-auto text-xs">{t('currentRole')}</span>
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
                                      {t('returnToAdminView')}
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Badge className={`${getRoleBadgeColor(profile.role)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 flex-shrink-0`}>
                        <span className="hidden sm:inline">{profile.role.replace('_', ' ').toUpperCase()}</span>
                        <span className="sm:hidden">{profile.role.charAt(0).toUpperCase()}</span>
                      </Badge>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                {/* Sync Status Badge */}
                <div data-tour="sync-status">
                  <SyncStatusBadge compact />
                </div>
                
                {/* Network status - show on mobile */}
                {isMobile && <NetworkStatusIndicator compact />}
                
                <div data-tour="global-search">
                  <GlobalSearch />
                </div>
                
                {/* Notification Center */}
                <NotificationCenter />
                
                {/* Help Menu */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" data-tour="help">
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48" align="end">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setShortcutsHelpOpen(true)}
                      >
                        <Keyboard className="h-4 w-4 mr-2" />
                        {language === 'tr' ? 'Kısayollar' : 'Shortcuts'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setHelpPanelOpen(true)}
                      >
                        <HelpCircle className="h-4 w-4 mr-2" />
                        {language === 'tr' ? 'Yardım' : 'Help'}
                      </Button>
                      {tourContext && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            const tourId = tourContext!.getRoleTourId();
                            tourContext!.startTour(tourId);
                          }}
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          {language === 'tr' ? 'Tura Başla' : 'Start Tour'}
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Select value={language} onValueChange={(value: 'en' | 'tr') => setLanguage(value)}>
                  <SelectTrigger className="w-12 sm:w-14 md:w-16 h-8 text-xs sm:text-sm">
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
                    size="icon"
                    onClick={() => setIsCartOpen(true)}
                    className="relative h-8 w-8"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {cartItemCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px]"
                      >
                        {cartItemCount}
                      </Badge>
                    )}
                  </Button>
                )}
                
                <span className="text-xs text-muted-foreground hidden lg:block max-w-24 truncate">
                  {profile?.full_name || profile?.email}
                </span>
                <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">{t('signOut')}</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-4 md:p-6">
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t bg-card py-3 px-4 shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>© {new Date().getFullYear()} LotAstro. {language === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}</span>
              <nav className="flex items-center gap-4">
                <a href="/terms" className="hover:text-foreground transition-colors">
                  {language === 'tr' ? 'Kullanım Koşulları' : 'Terms'}
                </a>
                <a href="/privacy" className="hover:text-foreground transition-colors">
                  {language === 'tr' ? 'Gizlilik' : 'Privacy'}
                </a>
                <a href="/cookies" className="hover:text-foreground transition-colors">
                  {language === 'tr' ? 'Çerezler' : 'Cookies'}
                </a>
                <a href="/kvkk" className="hover:text-foreground transition-colors">
                  KVKK
                </a>
              </nav>
            </div>
          </footer>
        </div>
        
        {/* All overlays temporarily disabled for debugging */}
      </div>
    </SidebarProvider>
  );
};

export default Layout;
