import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_COUNT_KEY = 'pwa-install-dismiss-count';
const LAST_DISMISS_KEY = 'pwa-install-last-dismiss';
const MAX_DISMISSES = 3;
const DISMISS_COOLDOWN_DAYS = 7;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canShow, setCanShow] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true;
    
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check dismiss count
    const dismissCount = parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || '0', 10);
    const lastDismiss = localStorage.getItem(LAST_DISMISS_KEY);
    
    if (dismissCount >= MAX_DISMISSES) {
      // Check if cooldown has passed
      if (lastDismiss) {
        const daysSince = (Date.now() - parseInt(lastDismiss, 10)) / (1000 * 60 * 60 * 24);
        if (daysSince < DISMISS_COOLDOWN_DAYS) {
          return; // Still in cooldown
        }
        // Reset after cooldown
        localStorage.setItem(DISMISS_COUNT_KEY, '0');
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanShow(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setCanShow(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setCanShow(false);
      }
      
      setDeferredPrompt(null);
      return outcome === 'accepted';
    } catch (error) {
      console.error('Error prompting install:', error);
      return false;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setCanShow(false);
    
    const currentCount = parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || '0', 10);
    localStorage.setItem(DISMISS_COUNT_KEY, String(currentCount + 1));
    localStorage.setItem(LAST_DISMISS_KEY, String(Date.now()));
  }, []);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    canShow: canShow && !isInstalled,
    isInstalled,
    promptInstall,
    dismiss,
  };
}
