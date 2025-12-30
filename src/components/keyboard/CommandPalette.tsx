import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Command, 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  FileText, 
  Users, 
  Settings,
  Search,
  BarChart3,
  ClipboardList,
  Truck,
  QrCode,
  Camera,
  BookOpen
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  labelEn: string;
  labelTr: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category: 'navigation' | 'actions' | 'recent';
  permission?: { category: string; action: string };
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { hasPermission } = usePermissions();
  const isEnglish = language === 'en';

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'dashboard',
      labelEn: 'Dashboard',
      labelTr: 'Panel',
      icon: <LayoutDashboard className="h-4 w-4 mr-2" />,
      action: () => navigate('/dashboard'),
      keywords: ['home', 'ana sayfa'],
      category: 'navigation',
      permission: { category: 'dashboard', action: 'view' }
    },
    {
      id: 'inventory',
      labelEn: 'Inventory',
      labelTr: 'Envanter',
      icon: <Package className="h-4 w-4 mr-2" />,
      action: () => navigate('/inventory'),
      keywords: ['stock', 'stok', 'lots'],
      category: 'navigation',
      permission: { category: 'inventory', action: 'view' }
    },
    {
      id: 'orders',
      labelEn: 'Orders',
      labelTr: 'Siparişler',
      icon: <ShoppingCart className="h-4 w-4 mr-2" />,
      action: () => navigate('/orders'),
      keywords: ['sipariş', 'order'],
      category: 'navigation',
      permission: { category: 'orders', action: 'view' }
    },
    {
      id: 'catalog',
      labelEn: 'Catalog',
      labelTr: 'Katalog',
      icon: <BookOpen className="h-4 w-4 mr-2" />,
      action: () => navigate('/catalog'),
      keywords: ['products', 'ürünler'],
      category: 'navigation',
      permission: { category: 'catalog', action: 'view' }
    },
    {
      id: 'reports',
      labelEn: 'Reports',
      labelTr: 'Raporlar',
      icon: <BarChart3 className="h-4 w-4 mr-2" />,
      action: () => navigate('/reports'),
      keywords: ['analytics', 'analitik'],
      category: 'navigation',
      permission: { category: 'reports', action: 'view' }
    },
    {
      id: 'reservations',
      labelEn: 'Reservations',
      labelTr: 'Rezervasyonlar',
      icon: <ClipboardList className="h-4 w-4 mr-2" />,
      action: () => navigate('/reservations'),
      keywords: ['reserve', 'rezerve'],
      category: 'navigation',
      permission: { category: 'reservations', action: 'view' }
    },
    {
      id: 'suppliers',
      labelEn: 'Suppliers',
      labelTr: 'Tedarikçiler',
      icon: <Truck className="h-4 w-4 mr-2" />,
      action: () => navigate('/suppliers'),
      keywords: ['vendor', 'satıcı'],
      category: 'navigation',
      permission: { category: 'suppliers', action: 'view' }
    },
    {
      id: 'lot-intake',
      labelEn: 'Lot Intake',
      labelTr: 'Lot Girişi',
      icon: <Package className="h-4 w-4 mr-2" />,
      action: () => navigate('/lot-intake'),
      keywords: ['new lot', 'yeni lot'],
      category: 'navigation',
      permission: { category: 'lots', action: 'create' }
    },
    {
      id: 'qr-scan',
      labelEn: 'QR Scanner',
      labelTr: 'QR Tarayıcı',
      icon: <QrCode className="h-4 w-4 mr-2" />,
      action: () => navigate('/qr-scan'),
      keywords: ['scan', 'tara'],
      category: 'navigation',
      permission: { category: 'lots', action: 'view' }
    },
    {
      id: 'stock-take',
      labelEn: 'Stock Take',
      labelTr: 'Sayım',
      icon: <Camera className="h-4 w-4 mr-2" />,
      action: () => navigate('/stock-take-capture'),
      keywords: ['count', 'sayım'],
      category: 'navigation',
      permission: { category: 'stock_take', action: 'create' }
    },
    {
      id: 'admin',
      labelEn: 'Settings',
      labelTr: 'Ayarlar',
      icon: <Settings className="h-4 w-4 mr-2" />,
      action: () => navigate('/admin'),
      keywords: ['admin', 'yönetim'],
      category: 'navigation',
      permission: { category: 'settings', action: 'view' }
    },
  ], [navigate]);

  const filteredCommands = commands.filter(cmd => {
    if (!cmd.permission) return true;
    return hasPermission(cmd.permission.category, cmd.permission.action);
  });

  const handleSelect = (commandId: string) => {
    const command = filteredCommands.find(c => c.id === commandId);
    if (command) {
      command.action();
      onOpenChange(false);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder={isEnglish ? 'Type a command or search...' : 'Komut yazın veya arayın...'} 
      />
      <CommandList>
        <CommandEmpty>
          {isEnglish ? 'No results found.' : 'Sonuç bulunamadı.'}
        </CommandEmpty>
        <CommandGroup heading={isEnglish ? 'Navigation' : 'Navigasyon'}>
          {filteredCommands
            .filter(c => c.category === 'navigation')
            .map(command => (
              <CommandItem
                key={command.id}
                value={command.id}
                onSelect={() => handleSelect(command.id)}
                keywords={command.keywords}
              >
                {command.icon}
                <span>{isEnglish ? command.labelEn : command.labelTr}</span>
              </CommandItem>
            ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
