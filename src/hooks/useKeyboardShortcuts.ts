import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Shortcut {
  key: string;
  action: string;
  label: string;
  labelTr: string;
  global: boolean;
  category: 'navigation' | 'actions' | 'help';
}

export const shortcuts: Shortcut[] = [
  // Navigation
  { key: 'g i', action: 'goInventory', label: 'Go to Inventory', labelTr: 'Envantere Git', global: true, category: 'navigation' },
  { key: 'g o', action: 'goOrders', label: 'Go to Orders', labelTr: 'Siparişlere Git', global: true, category: 'navigation' },
  { key: 'g c', action: 'goCatalog', label: 'Go to Catalog', labelTr: 'Kataloğa Git', global: true, category: 'navigation' },
  { key: 'g r', action: 'goReports', label: 'Go to Reports', labelTr: 'Raporlara Git', global: true, category: 'navigation' },
  { key: 'g d', action: 'goDashboard', label: 'Go to Dashboard', labelTr: 'Panoya Git', global: true, category: 'navigation' },
  { key: 'g a', action: 'goAdmin', label: 'Go to Admin', labelTr: 'Yönetime Git', global: true, category: 'navigation' },
  
  // Actions
  { key: 'mod+k', action: 'openCommandPalette', label: 'Command Palette', labelTr: 'Komut Paleti', global: true, category: 'actions' },
  { key: 'mod+/', action: 'showShortcuts', label: 'Show Shortcuts', labelTr: 'Kısayolları Göster', global: true, category: 'help' },
  { key: 'mod+p', action: 'print', label: 'Print Page', labelTr: 'Sayfayı Yazdır', global: true, category: 'actions' },
  { key: 'n', action: 'newItem', label: 'New Item', labelTr: 'Yeni Öğe', global: true, category: 'actions' },
  { key: 'f', action: 'focusSearch', label: 'Focus Search', labelTr: 'Aramaya Odaklan', global: true, category: 'actions' },
  { key: '?', action: 'showShortcuts', label: 'Show Shortcuts', labelTr: 'Kısayolları Göster', global: true, category: 'help' },
  { key: 'Escape', action: 'close', label: 'Close Dialog', labelTr: 'Diyaloğu Kapat', global: true, category: 'actions' },
];

interface UseKeyboardShortcutsOptions {
  onCommandPalette?: () => void;
  onShowShortcuts?: () => void;
  onClose?: () => void;
  onPrint?: () => void;
  onNewItem?: () => void;
  onFocusSearch?: () => void;
  onPendingKeyChange?: (key: string | null) => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const navigate = useNavigate();
  const { 
    onCommandPalette, 
    onShowShortcuts, 
    onClose, 
    onPrint,
    onNewItem,
    onFocusSearch,
    onPendingKeyChange,
    enabled = true 
  } = options;
  const [pendingKey, setPendingKeyInternal] = useState<string | null>(null);
  
  // Wrapper to also call the callback when pending key changes
  const setPendingKey = useCallback((key: string | null) => {
    setPendingKeyInternal(key);
    onPendingKeyChange?.(key);
  }, [onPendingKeyChange]);

  const handleAction = useCallback((action: string) => {
    switch (action) {
      case 'goInventory':
        navigate('/inventory');
        break;
      case 'goOrders':
        navigate('/orders');
        break;
      case 'goCatalog':
        navigate('/catalog');
        break;
      case 'goReports':
        navigate('/reports');
        break;
      case 'goDashboard':
        navigate('/dashboard');
        break;
      case 'goAdmin':
        navigate('/admin');
        break;
      case 'openCommandPalette':
        onCommandPalette?.();
        break;
      case 'showShortcuts':
        onShowShortcuts?.();
        break;
      case 'close':
        onClose?.();
        break;
      case 'print':
        onPrint?.();
        break;
      case 'newItem':
        onNewItem?.();
        break;
      case 'focusSearch':
        onFocusSearch?.();
        break;
    }
  }, [navigate, onCommandPalette, onShowShortcuts, onClose, onPrint, onNewItem, onFocusSearch]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const isMod = event.metaKey || event.ctrlKey;

      // Handle mod+key shortcuts
      if (isMod) {
        if (key === 'k') {
          event.preventDefault();
          handleAction('openCommandPalette');
          return;
        }
        if (key === '/') {
          event.preventDefault();
          handleAction('showShortcuts');
          return;
        }
        if (key === 'p') {
          event.preventDefault();
          handleAction('print');
          return;
        }
      }

      // Handle escape - also clear pending key
      if (key === 'escape') {
        if (pendingKey) {
          setPendingKey(null);
        }
        handleAction('close');
        return;
      }

      // Handle ? for shortcuts help
      if (event.key === '?') {
        event.preventDefault();
        handleAction('showShortcuts');
        return;
      }

      // Handle single-key shortcuts
      if (key === 'n' && !isMod) {
        event.preventDefault();
        handleAction('newItem');
        return;
      }

      if (key === 'f' && !isMod) {
        event.preventDefault();
        handleAction('focusSearch');
        return;
      }

      // Handle two-key sequences (g + letter)
      if (pendingKey === 'g') {
        setPendingKey(null);
        switch (key) {
          case 'i':
            event.preventDefault();
            handleAction('goInventory');
            break;
          case 'o':
            event.preventDefault();
            handleAction('goOrders');
            break;
          case 'c':
            event.preventDefault();
            handleAction('goCatalog');
            break;
          case 'r':
            event.preventDefault();
            handleAction('goReports');
            break;
          case 'd':
            event.preventDefault();
            handleAction('goDashboard');
            break;
          case 'a':
            event.preventDefault();
            handleAction('goAdmin');
            break;
        }
        return;
      }

      // Start a sequence
      if (key === 'g') {
        setPendingKey('g');
        // Clear pending after 1 second
        setTimeout(() => setPendingKey(null), 1000);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, pendingKey, handleAction]);

  return { shortcuts, pendingKey };
}

export function formatShortcut(key: string, isMac: boolean = false): string {
  return key
    .replace('mod+', isMac ? '⌘' : 'Ctrl+')
    .replace('Escape', 'Esc')
    .split(' ')
    .map(k => k.charAt(0).toUpperCase() + k.slice(1))
    .join(' then ');
}
