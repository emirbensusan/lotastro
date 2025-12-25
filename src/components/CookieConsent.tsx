import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'lotastro-cookie-consent';

interface ConsentState {
  essential: boolean;
  analytics: boolean;
  timestamp: string;
}

const CookieConsent: React.FC = () => {
  const { language } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay to avoid flash on page load
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const consent: ConsentState = {
      essential: true,
      analytics: true,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    setShowBanner(false);
  };

  const handleAcceptEssential = () => {
    const consent: ConsentState = {
      essential: true,
      analytics: false,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    setShowBanner(false);
  };

  const handleDismiss = () => {
    // Treat dismiss as accepting essential only
    handleAcceptEssential();
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-5 duration-300">
      <Card className="max-w-4xl mx-auto p-4 shadow-lg border bg-card">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {language === 'tr' ? 'Çerez Kullanımı' : 'Cookie Usage'}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === 'tr' 
                  ? 'Deneyiminizi iyileştirmek için çerezler kullanıyoruz. '
                  : 'We use cookies to improve your experience. '}
                <Link to="/cookies" className="underline hover:text-primary">
                  {language === 'tr' ? 'Daha fazla bilgi' : 'Learn more'}
                </Link>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAcceptEssential}
              className="flex-1 md:flex-none"
            >
              {language === 'tr' ? 'Sadece Gerekli' : 'Essential Only'}
            </Button>
            <Button
              size="sm"
              onClick={handleAcceptAll}
              className="flex-1 md:flex-none"
            >
              {language === 'tr' ? 'Tümünü Kabul Et' : 'Accept All'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8 flex-shrink-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CookieConsent;
