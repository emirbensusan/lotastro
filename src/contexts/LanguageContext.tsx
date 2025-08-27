import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LanguageContextType {
  language: 'en' | 'tr';
  setLanguage: (lang: 'en' | 'tr') => void;
  t: (key: string) => string | string[];
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
    error: 'Error',
    success: 'Success',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    selected: 'selected',
    
    // Dashboard
    welcomeMessage: 'Welcome to Warehouse LOT Tracking',
    totalLots: 'Total Lots',
    totalOrders: 'Total Orders',
    pendingOrders: 'Pending Orders',
    recentActivity: 'Recent Activity',
    welcomeBack: 'Welcome back',
    lotAgingAlert: 'LOT Aging Alert',
    monitorOldInventory: 'Monitor old inventory',
    oldestLot: 'Oldest LOT in inventory',
    quickActions: 'Quick Actions',
    commonTasks: 'Common tasks for your role',
    days: 'days',
    noLotsInInventory: 'No LOTs in inventory',
    considerReviewing: 'Consider reviewing old stock',
    
    // Inventory
    qualityFilter: 'Filter by Quality',
    colorFilter: 'Filter by Color',
    searchPlaceholder: 'Search lots, quality, color...',
    importExcel: 'Import Excel',
    stockOverview: 'Stock Overview',
    expandableView: 'Expandable view of inventory grouped by quality and color',
    filtersSearch: 'Filters & Search',
    filterInventory: 'Filter inventory by quality, color, or search terms',
    allQualities: 'All Qualities',
    allColors: 'All Colors',
    allStatus: 'All Status',
    exportExcel: 'Export Excel',
    noInventoryItems: 'No inventory items found matching your filters.',
    rolls: 'rolls',
    meters: 'meters',
    lots: 'LOTs',
    age: 'Age',
    status: 'Status',
    entryDate: 'Entry Date',
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    partiallyFulfilled: 'Partially Fulfilled',
    downloadTemplate: 'Download Template',
    uploadFile: 'Upload File',
    importStarted: 'Import Started',
    processingRows: 'Processing rows from CSV file...',
    importError: 'Import Error',
    failedToParse: 'Failed to parse CSV file.',
    showing: 'Showing',
    addToOrder: 'Add to Order',
    clear: 'Clear',
    
    // Orders
    orderNumber: 'Order Number',
    customerName: 'Customer Name',
    createOrder: 'Create Order',
    selectLots: 'Select Lots',
    addLot: 'Add LOT',
    createNewOrder: 'Create New Order',
    orderCreated: 'Order Created',
    orderCreatedSuccessfully: 'Order created successfully',
    failedToCreateOrder: 'Failed to create order',
    orderManagement: 'Order Management',
    viewAllOrders: 'View and manage all orders in the system',
    createdBy: 'Created By',
    createdAt: 'Created At',
    fulfilledBy: 'Fulfilled By',
    fulfilledAt: 'Fulfilled At',
    pending: 'Pending',
    fulfilled: 'Fulfilled',
    noOrdersFound: 'No orders found.',
    
    // Lot Intake
    lotIntakeNumber: 'Lot Number',
    intakeMeters: 'Meters',
    intakeRollCount: 'Roll Count',
    intakeQuality: 'Quality',
    intakeColor: 'Color',
    intakeSupplier: 'Supplier',
    createLot: 'Create LOT',
    lotIntakeForm: 'LOT Intake Form',
    enterNewLot: 'Enter new LOT details into the system',
    lotCreated: 'LOT Created',
    lotCreatedSuccessfully: 'LOT created successfully',
    failedToCreateLot: 'Failed to create LOT',
    required: 'Required',
    
    // QR Scanner
    qrCodeScanner: 'QR Code Scanner',
    lotLookup: 'LOT Lookup',
    searchForLot: 'Search for LOT details by number or scan QR code',
    enterLotNumber: 'Enter LOT number (e.g., LOT001)',
    searching: 'Searching...',
    lotDetails: 'LOT Details',
    lotNotFound: 'LOT number not found',
    failedToFetch: 'Failed to fetch LOT details',
    oldLotWarning: 'This LOT is over {days} days old. Consider reviewing for aging inventory.',
    howToUse: 'How to Use QR Scanner',
    qrInstructions: [
      'Use any QR code scanner app on your mobile device',
      'Scan the QR code printed on the textile roll',
      "You'll be redirected to this page with LOT details",
      'Alternatively, you can manually enter the LOT number above'
    ],
    scanQrCode: 'Scan QR Code',
    uploadQrImage: 'Upload QR Image',
    selectLotFrom: 'Select LOT from inventory',
    qrCodeScanned: 'QR Code Scanned',
    pleaseLogin: 'Please log in to view LOT details',
    signInToView: 'Sign In to View Details',
    
    // Reports
    reportsAnalytics: 'Reports & Analytics',
    generateReports: 'Generate comprehensive reports and analytics',
    
    // Admin
    adminPanel: 'Admin Panel',
    systemAdministration: 'System administration and management tools',
    
    // Suppliers
    supplierManagement: 'Supplier Management',
    manageSuppliers: 'Manage all suppliers in the system',
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
    error: 'Hata',
    success: 'Başarılı',
    previous: 'Önceki',
    next: 'Sonraki',
    page: 'Sayfa',
    of: 'of',
    selected: 'seçili',
    
    // Dashboard
    welcomeMessage: 'Depo LOT Takip Sistemine Hoş Geldiniz',
    totalLots: 'Toplam Lot',
    totalOrders: 'Toplam Sipariş',
    pendingOrders: 'Bekleyen Siparişler',
    recentActivity: 'Son Aktiviteler',
    welcomeBack: 'Tekrar hoş geldiniz',
    lotAgingAlert: 'LOT Yaşlanma Uyarısı',
    monitorOldInventory: 'Eski envanteri izle',
    oldestLot: 'Envanterdeki en eski LOT',
    quickActions: 'Hızlı İşlemler',
    commonTasks: 'Rolünüz için genel görevler',
    days: 'gün',
    noLotsInInventory: 'Envanterde LOT yok',
    considerReviewing: 'Eski stoku gözden geçirmeyi düşünün',
    
    // Inventory
    qualityFilter: 'Kaliteye Göre Filtrele',
    colorFilter: 'Renge Göre Filtrele',
    searchPlaceholder: 'Lot, kalite, renk ara...',
    importExcel: 'Excel İçe Aktar',
    stockOverview: 'Stok Genel Görünümü',
    expandableView: 'Kalite ve renge göre gruplanmış envanterin genişletilebilir görünümü',
    filtersSearch: 'Filtreler ve Arama',
    filterInventory: 'Envanteri kalite, renk veya arama terimlerine göre filtrele',
    allQualities: 'Tüm Kaliteler',
    allColors: 'Tüm Renkler',
    allStatus: 'Tüm Durumlar',
    exportExcel: 'Excel Dışa Aktar',
    noInventoryItems: 'Filtrelerinizle eşleşen envanter öğesi bulunamadı.',
    rolls: 'rulo',
    meters: 'metre',
    lots: 'LOT',
    age: 'Yaş',
    status: 'Durum',
    entryDate: 'Giriş Tarihi',
    inStock: 'Stokta',
    outOfStock: 'Stok Yok',
    partiallyFulfilled: 'Kısmen Karşılandı',
    downloadTemplate: 'Şablon İndir',
    uploadFile: 'Dosya Yükle',
    importStarted: 'İçe Aktarma Başladı',
    processingRows: 'CSV dosyasından satırlar işleniyor...',
    importError: 'İçe Aktarma Hatası',
    failedToParse: 'CSV dosyası ayrıştırılamadı.',
    showing: 'Gösteriliyor',
    addToOrder: 'Siparişe Ekle',
    clear: 'Temizle',
    
    // Orders
    orderNumber: 'Sipariş Numarası',
    customerName: 'Müşteri Adı',
    createOrder: 'Sipariş Oluştur',
    selectLots: 'LOT Seç',
    addLot: 'LOT Ekle',
    createNewOrder: 'Yeni Sipariş Oluştur',
    orderCreated: 'Sipariş Oluşturuldu',
    orderCreatedSuccessfully: 'Sipariş başarıyla oluşturuldu',
    failedToCreateOrder: 'Sipariş oluşturulamadı',
    orderManagement: 'Sipariş Yönetimi',
    viewAllOrders: 'Sistemdeki tüm siparişleri görüntüle ve yönet',
    createdBy: 'Oluşturan',
    createdAt: 'Oluşturulma Tarihi',
    fulfilledBy: 'Karşılayan',
    fulfilledAt: 'Karşılanma Tarihi',
    pending: 'Beklemede',
    fulfilled: 'Karşılandı',
    noOrdersFound: 'Sipariş bulunamadı.',
    
    // Lot Intake
    lotIntakeNumber: 'Lot Numarası',
    intakeMeters: 'Metre',
    intakeRollCount: 'Rulo Sayısı',
    intakeQuality: 'Kalite',
    intakeColor: 'Renk',
    intakeSupplier: 'Tedarikçi',
    createLot: 'LOT Oluştur',
    lotIntakeForm: 'LOT Giriş Formu',
    enterNewLot: 'Sisteme yeni LOT detayları girin',
    lotCreated: 'LOT Oluşturuldu',
    lotCreatedSuccessfully: 'LOT başarıyla oluşturuldu',
    failedToCreateLot: 'LOT oluşturulamadı',
    required: 'Gerekli',
    
    // QR Scanner
    qrCodeScanner: 'QR Kod Tarayıcısı',
    lotLookup: 'LOT Arama',
    searchForLot: 'Numara ile LOT detaylarını ara veya QR kod tara',
    enterLotNumber: 'LOT numarası girin (örn: LOT001)',
    searching: 'Aranıyor...',
    lotDetails: 'LOT Detayları',
    lotNotFound: 'LOT numarası bulunamadı',
    failedToFetch: 'LOT detayları getirilemedi',
    oldLotWarning: 'Bu LOT {days} günlükten eski. Yaşlanan envanter için gözden geçirmeyi düşünün.',
    howToUse: 'QR Tarayıcısı Nasıl Kullanılır',
    qrInstructions: [
      'Mobil cihazınızda herhangi bir QR kod tarayıcı uygulaması kullanın',
      'Tekstil rulosunda basılı QR kodu tarayın',
      'LOT detayları ile bu sayfaya yönlendirileceksiniz',
      'Alternatif olarak, yukarıda LOT numarasını manuel olarak girebilirsiniz'
    ],
    scanQrCode: 'QR Kod Tara',
    uploadQrImage: 'QR Resmi Yükle',
    selectLotFrom: 'Envanterden LOT seç',
    qrCodeScanned: 'QR Kod Tarandı',
    pleaseLogin: 'LOT detaylarını görüntülemek için lütfen giriş yapın',
    signInToView: 'Detayları Görüntülemek İçin Giriş Yap',
    
    // Reports
    reportsAnalytics: 'Raporlar ve Analitik',
    generateReports: 'Kapsamlı raporlar ve analitik oluştur',
    
    // Admin
    adminPanel: 'Yönetici Paneli',
    systemAdministration: 'Sistem yönetimi ve yönetim araçları',
    
    // Suppliers
    supplierManagement: 'Tedarikçi Yönetimi',
    manageSuppliers: 'Sistemdeki tüm tedarikçileri yönet',
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<'en' | 'tr'>('en');

  const t = (key: string): string | string[] => {
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