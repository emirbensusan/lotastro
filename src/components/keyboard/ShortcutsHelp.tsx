import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { shortcuts, formatShortcut } from '@/hooks/useKeyboardShortcuts';
import { Keyboard } from 'lucide-react';

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  const { language } = useLanguage();
  const isEnglish = language === 'en';
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const categories = {
    navigation: isEnglish ? 'Navigation' : 'Navigasyon',
    actions: isEnglish ? 'Actions' : 'İşlemler',
    help: isEnglish ? 'Help' : 'Yardım',
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            {isEnglish ? 'Keyboard Shortcuts' : 'Klavye Kısayolları'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {categories[category as keyof typeof categories]}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut) => (
                  <div 
                    key={shortcut.key} 
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm">
                      {isEnglish ? shortcut.label : shortcut.labelTr}
                    </span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                      {formatShortcut(shortcut.key, isMac)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          {isEnglish 
            ? 'Tip: Press Ctrl+K (or ⌘K on Mac) anytime to open command palette'
            : 'İpucu: Komut paletini açmak için istediğiniz zaman Ctrl+K (veya Mac\'te ⌘K) tuşlarına basın'}
        </div>
      </DialogContent>
    </Dialog>
  );
}
