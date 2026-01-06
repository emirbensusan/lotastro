import React from 'react';
import { NavLink } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { useShortcutHints } from '@/contexts/ShortcutHintsContext';
import { 
  Home,
  PackagePlus, 
  ClipboardList, 
  BarChart3, 
  Settings, 
  QrCode,
  Users,
  Truck,
  Calendar,
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
  CheckCircle,
} from 'lucide-react';
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: { category: string; action: string };
  tourId?: string;
  shortcutKey?: string; // e.g., "i" for Inventory (used with G+key)
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

// Navigation configuration - extracted for reuse
export const useNavigationGroups = (): NavigationGroup[] => {
  const { t } = useLanguage();
  
  return [
    {
      label: String(t('overview')),
      items: [
        { path: '/', label: String(t('dashboard')), icon: Home, permission: { category: 'reports', action: 'accessdashboard' }, tourId: 'dashboard', shortcutKey: 'd' },
      ]
    },
    {
      label: String(t('inventoryManagement')),
      items: [
        { path: '/catalog', label: String(t('catalog.title')), icon: BookOpen, permission: { category: 'catalog', action: 'view' }, tourId: 'catalog', shortcutKey: 'c' },
        { path: '/lot-intake', label: String(t('lotIntake')), icon: PackagePlus, permission: { category: 'inventory', action: 'createlotentries' }, tourId: 'lot-intake' },
        { path: '/lot-queue', label: String(t('lotQueue')), icon: Timer, permission: { category: 'inventory', action: 'viewlotqueue' } },
        { path: '/inventory', label: String(t('inventory')), icon: ClipboardList, permission: { category: 'inventory', action: 'viewinventory' }, tourId: 'inventory', shortcutKey: 'i' },
        { path: '/incoming-stock', label: String(t('incomingStockLabel')), icon: TruckIcon, permission: { category: 'inventory', action: 'viewincoming' }, tourId: 'incoming-stock' },
        { path: '/manufacturing-orders', label: String(t('mo.title')), icon: Factory, permission: { category: 'inventory', action: 'viewincoming' } },
        { path: '/forecast', label: String(t('forecast.title') || 'Forecast'), icon: TrendingUp, permission: { category: 'forecasting', action: 'viewforecasts' }, tourId: 'forecast' },
        { path: '/goods-receipt', label: String(t('goodsReceipt')), icon: PackageCheck, permission: { category: 'inventory', action: 'receiveincoming' } },
      ]
    },
    {
      label: String(t('ordersAndReservations')),
      items: [
        { path: '/orders', label: String(t('orders')), icon: Truck, permission: { category: 'orders', action: 'vieworders' }, tourId: 'orders', shortcutKey: 'o' },
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
        { path: '/reports', label: String(t('reports')), icon: BarChart3, permission: { category: 'reports', action: 'viewreports' }, tourId: 'reports', shortcutKey: 'r' },
        { path: '/audit-logs', label: String(t('actionHistory')), icon: History, permission: { category: 'auditlogs', action: 'viewalllogs' }, tourId: 'audit-logs' },
        { path: '/suppliers', label: String(t('suppliers')), icon: Users, permission: { category: 'suppliers', action: 'viewsuppliers' } },
        { path: '/admin', label: String(t('settings')), icon: Settings, permission: { category: 'usermanagement', action: 'viewusers' }, tourId: 'admin', shortcutKey: 'a' },
      ]
    }
  ];
};

// Filter navigation groups based on permissions
export const useFilteredNavigationGroups = () => {
  const navigationGroups = useNavigationGroups();
  const { hasPermission, loading } = usePermissions();
  
  if (loading) return { groups: [], loading: true };
  
  const filtered = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => 
        hasPermission(item.permission.category, item.permission.action)
      )
    }))
    .filter(group => group.items.length > 0);
  
  return { groups: filtered, loading: false };
};

// Shortcut hint badge component
const ShortcutHintBadge: React.FC<{ shortcutKey: string }> = ({ shortcutKey }) => (
  <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-mono bg-primary/10 text-primary rounded border border-primary/20 animate-pulse">
    {shortcutKey.toUpperCase()}
  </kbd>
);

// Desktop Sidebar Component
export const DesktopNav: React.FC = () => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { groups, loading } = useFilteredNavigationGroups();
  const { pendingKey } = useShortcutHints();
  const showHints = pendingKey === 'g';
  
  return (
    <Sidebar collapsible="icon" className="flex flex-col h-full border-r">
      <SidebarContent>
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          groups.map((group) => (
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
                    
                    return (
                      <SidebarMenuItem key={item.path} data-tour={item.tourId}>
                        <NavLink
                          to={item.path}
                          title={isCollapsed ? item.label : undefined}
                          className={({ isActive }) =>
                            `flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${
                              isActive
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                            }`
                          }
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className={isCollapsed ? "sr-only" : "flex-1"}>{item.label}</span>
                          {showHints && item.shortcutKey && !isCollapsed && (
                            <ShortcutHintBadge shortcutKey={item.shortcutKey} />
                          )}
                          {showHints && item.shortcutKey && isCollapsed && (
                            <span className="absolute left-full ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-primary text-primary-foreground rounded shadow-lg z-50">
                              {item.shortcutKey.toUpperCase()}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>
      
      {/* Hint banner at bottom when G is pressed */}
      {showHints && (
        <div className="mt-auto p-2 bg-primary/10 text-xs text-center text-primary border-t border-primary/20">
          Press letter to navigate • Esc to cancel
        </div>
      )}
    </Sidebar>
  );
};

// Mobile Navigation Component
interface MobileNavProps {
  onNavigate: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onNavigate }) => {
  const { groups, loading } = useFilteredNavigationGroups();
  const { pendingKey } = useShortcutHints();
  const showHints = pendingKey === 'g';
  
  return (
    <nav className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground px-2">
                {group.label}
              </h3>
              {group.items.map((item) => {
                const Icon = item.icon;
                
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center w-full justify-start min-h-[44px] px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-secondary text-secondary-foreground' 
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    <span className="flex-1">{item.label}</span>
                    {showHints && item.shortcutKey && (
                      <ShortcutHintBadge shortcutKey={item.shortcutKey} />
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
          
          {/* Mobile hint banner */}
          {showHints && (
            <div className="p-2 bg-primary/10 text-xs text-center text-primary rounded-md border border-primary/20 mx-2">
              Press letter to navigate • Esc to cancel
            </div>
          )}
        </>
      )}
    </nav>
  );
};
