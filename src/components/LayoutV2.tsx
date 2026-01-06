import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePOCart } from '@/contexts/POCartProvider';
import { useViewAsRole } from '@/contexts/ViewAsRoleContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ShortcutHintsProvider, useShortcutHints } from '@/contexts/ShortcutHintsContext';
import GlobalSearch from '@/components/GlobalSearch';
import { NetworkStatusIndicator } from '@/components/ui/network-status-indicator';
import { SyncStatusBadge } from '@/components/offline/SyncStatusBadge';
import { ConflictResolutionDialog } from '@/components/offline/ConflictResolutionDialog';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { CommandPalette } from '@/components/keyboard/CommandPalette';
import { ShortcutsHelp } from '@/components/keyboard/ShortcutsHelp';
import { HelpPanel } from '@/components/help/HelpPanel';
import { useOffline } from '@/contexts/OfflineContext';
import { DesktopNav, MobileNav } from '@/components/SidebarV2';
import { 
  LogOut, 
  Menu,
  ShoppingCart,
  HelpCircle,
  Keyboard
} from 'lucide-react';
import { 
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

// Inner layout component that uses the shortcut hints context
const LayoutInner: React.FC<LayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { getItemCount, setIsCartOpen } = usePOCart();
  const { viewAsRole, setViewAsRole, isViewingAsOtherRole } = useViewAsRole();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const { conflicts, showConflictDialog, setShowConflictDialog, resolveConflict } = useOffline();
  const { setPendingKey } = useShortcutHints();

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Initialize keyboard shortcuts with pending key callback
  useKeyboardShortcuts({
    onCommandPalette: () => setCommandPaletteOpen(true),
    onShowShortcuts: () => setShortcutsHelpOpen(true),
    onClose: () => {
      setCommandPaletteOpen(false);
      setShortcutsHelpOpen(false);
      setHelpPanelOpen(false);
    },
    onPendingKeyChange: setPendingKey,
    enabled: true
  });

  // Get effective role (viewAsRole if viewing as another role, otherwise actual role)
  const effectiveRole = viewAsRole || profile?.role;
  
  // Check if user can create orders (has cart permission)
  const canCreateOrders = effectiveRole && ['accounting', 'senior_manager', 'admin'].includes(effectiveRole);
  const cartItemCount = getItemCount();

  const getRoleBadgeColor = (role: string, isViewingAs = false) => {
    const baseColors: Record<string, string> = {
      'admin': 'bg-destructive text-destructive-foreground',
      'accounting': 'bg-primary text-primary-foreground', 
      'senior_manager': 'bg-yellow-500 text-yellow-50',
      'warehouse_staff': 'bg-secondary text-secondary-foreground',
    };
    
    const color = baseColors[role] || 'bg-muted text-muted-foreground';
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

  return (
    <SidebarProvider>
      <div className="min-h-screen-safe bg-background flex w-full">
        {/* Desktop Sidebar */}
        <DesktopNav />

        {/* Main content area including header */}
        <div className="flex-1 flex flex-col min-h-screen-safe min-w-0 overflow-hidden">
          {/* Top Navigation */}
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
                    <MobileNav onNavigate={() => setSidebarOpen(false)} />
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
        
        {/* Dialogs/Sheets */}
        {commandPaletteOpen && (
          <CommandPalette 
            open={commandPaletteOpen} 
            onOpenChange={setCommandPaletteOpen} 
          />
        )}
        {shortcutsHelpOpen && (
          <ShortcutsHelp 
            open={shortcutsHelpOpen} 
            onOpenChange={setShortcutsHelpOpen} 
          />
        )}
        {helpPanelOpen && (
          <HelpPanel 
            open={helpPanelOpen} 
            onOpenChange={setHelpPanelOpen} 
          />
        )}
        {showConflictDialog && conflicts.length > 0 && (
          <ConflictResolutionDialog
            open={showConflictDialog}
            onOpenChange={setShowConflictDialog}
            conflicts={conflicts}
            onResolve={resolveConflict}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

// Main layout component wrapping with providers
const LayoutV2: React.FC<LayoutProps> = ({ children }) => {
  return (
    <ShortcutHintsProvider>
      <LayoutInner>{children}</LayoutInner>
    </ShortcutHintsProvider>
  );
};

export default LayoutV2;
