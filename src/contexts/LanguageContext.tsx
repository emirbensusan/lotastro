import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LanguageContextType {
  language: 'en' | 'tr';
  setLanguage: (lang: 'en' | 'tr') => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    lotIntake: 'LOT Intake',
    inventory: 'Inventory',
    orders: 'Orders',
    qrScan: 'QR Scan',
    reports: 'Reports',
    suppliers: 'Suppliers',
    admin: 'Admin',
    signOut: 'Sign Out',
    
    // Common
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    create: 'Create',
    update: 'Update',
    loading: 'Loading...',
    
    // Dashboard
    welcomeMessage: 'Welcome to Warehouse LOT Tracking',
    totalLots: 'Total Lots',
    totalOrders: 'Total Orders',
    pendingOrders: 'Pending Orders',
    recentActivity: 'Recent Activity',
    
    // Inventory
    qualityFilter: 'Filter by Quality',
    colorFilter: 'Filter by Color',
    searchPlaceholder: 'Search lots, quality, color...',
    importExcel: 'Import Excel',
    
    // Orders
    orderNumber: 'Order Number',
    customerName: 'Customer Name',
    createOrder: 'Create Order',
    
    // Lot Intake
    lotNumber: 'Lot Number',
    meters: 'Meters',
    rollCount: 'Roll Count',
    quality: 'Quality',
    color: 'Color',
    supplier: 'Supplier',
  },
  tr: {
    // Navigation
    dashboard: 'Kontrol Paneli',
    lotIntake: 'LOT Girişi',
    inventory: 'Envanter',
    orders: 'Siparişler',
    qrScan: 'QR Tarama',
    reports: 'Raporlar',
    suppliers: 'Tedarikçiler',
    admin: 'Yönetici',
    signOut: 'Çıkış Yap',
    
    // Common
    search: 'Ara',
    filter: 'Filtrele',
    export: 'Dışa Aktar',
    save: 'Kaydet',
    cancel: 'İptal',
    edit: 'Düzenle',
    delete: 'Sil',
    create: 'Oluştur',
    update: 'Güncelle',
    loading: 'Yükleniyor...',
    
    // Dashboard
    welcomeMessage: 'Depo LOT Takip Sistemine Hoş Geldiniz',
    totalLots: 'Toplam Lot',
    totalOrders: 'Toplam Sipariş',
    pendingOrders: 'Bekleyen Siparişler',
    recentActivity: 'Son Aktiviteler',
    
    // Inventory
    qualityFilter: 'Kaliteye Göre Filtrele',
    colorFilter: 'Renge Göre Filtrele',
    searchPlaceholder: 'Lot, kalite, renk ara...',
    importExcel: 'Excel İçe Aktar',
    
    // Orders
    orderNumber: 'Sipariş Numarası',
    customerName: 'Müşteri Adı',
    createOrder: 'Sipariş Oluştur',
    
    // Lot Intake
    lotNumber: 'Lot Numarası',
    meters: 'Metre',
    rollCount: 'Rulo Sayısı',
    quality: 'Kalite',
    color: 'Renk',
    supplier: 'Tedarikçi',
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<'en' | 'tr'>('en');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};