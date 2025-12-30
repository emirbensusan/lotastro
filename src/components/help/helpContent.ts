interface HelpTopic {
  id: string;
  titleEn: string;
  titleTr: string;
  overviewEn: string;
  overviewTr: string;
  stepsEn?: string[];
  stepsTr?: string[];
  tipsEn?: string[];
  tipsTr?: string[];
  relatedTopics?: string[];
  docsUrl?: string;
}

export const helpContent: Record<string, HelpTopic> = {
  'lot-intake': {
    id: 'lot-intake',
    titleEn: 'Lot Intake',
    titleTr: 'Lot Girişi',
    overviewEn: 'Register new fabric lots as they arrive at the warehouse. Each lot receives a unique identifier and QR code for tracking throughout its lifecycle.',
    overviewTr: 'Depoya gelen yeni kumaş lotlarını kaydedin. Her lot, yaşam döngüsü boyunca takip için benzersiz bir tanımlayıcı ve QR kodu alır.',
    stepsEn: [
      'Select the quality and color from the catalog',
      'Enter the lot number (or scan existing QR code)',
      'Input the total meters/kilos received',
      'Add supplier information if applicable',
      'Confirm and print QR label'
    ],
    stepsTr: [
      'Katalogdan kalite ve rengi seçin',
      'Lot numarasını girin (veya mevcut QR kodunu tarayın)',
      'Alınan toplam metre/kilogramı girin',
      'Varsa tedarikçi bilgilerini ekleyin',
      'Onaylayın ve QR etiketini yazdırın'
    ],
    tipsEn: [
      'Use the camera to scan existing lot labels for faster entry',
      'Double-check meter counts before confirming',
      'Print QR labels immediately to avoid losing track'
    ],
    tipsTr: [
      'Daha hızlı giriş için kamerayı kullanarak mevcut lot etiketlerini tarayın',
      'Onaylamadan önce metre sayımlarını iki kez kontrol edin',
      'Takibi kaybetmemek için QR etiketlerini hemen yazdırın'
    ],
    relatedTopics: ['qr-scanning', 'inventory', 'stock-take'],
    docsUrl: '/docs/lot-intake'
  },
  'order-creation': {
    id: 'order-creation',
    titleEn: 'Creating Orders',
    titleTr: 'Sipariş Oluşturma',
    overviewEn: 'Create customer orders by specifying products, quantities, and delivery requirements. Orders can be entered manually, via AI-assisted input, or imported from Excel.',
    overviewTr: 'Ürünleri, miktarları ve teslimat gereksinimlerini belirleyerek müşteri siparişleri oluşturun. Siparişler manuel olarak, yapay zeka destekli giriş yoluyla veya Excel\'den içe aktarılarak girilebilir.',
    stepsEn: [
      'Click "New Order" to start',
      'Enter customer information',
      'Add order lines with product, color, and quantity',
      'Set delivery date and priority',
      'Review and submit for processing'
    ],
    stepsTr: [
      'Başlamak için "Yeni Sipariş"e tıklayın',
      'Müşteri bilgilerini girin',
      'Ürün, renk ve miktar ile sipariş satırları ekleyin',
      'Teslimat tarihi ve önceliği belirleyin',
      'İşleme için gözden geçirin ve gönderin'
    ],
    tipsEn: [
      'Use AI input for handwritten or PDF orders',
      'Check inventory availability before promising delivery dates',
      'Orders over certain thresholds may require approval'
    ],
    tipsTr: [
      'El yazısı veya PDF siparişler için yapay zeka girişini kullanın',
      'Teslimat tarihlerini taahhüt etmeden önce envanter durumunu kontrol edin',
      'Belirli eşiklerin üzerindeki siparişler onay gerektirebilir'
    ],
    relatedTopics: ['reservations', 'order-queue', 'inventory'],
    docsUrl: '/docs/orders'
  },
  'reservations': {
    id: 'reservations',
    titleEn: 'Managing Reservations',
    titleTr: 'Rezervasyon Yönetimi',
    overviewEn: 'Reserve specific lots for customer orders to ensure availability. Reservations hold inventory until the order is fulfilled or released.',
    overviewTr: 'Kullanılabilirliği sağlamak için müşteri siparişleri için belirli lotları rezerve edin. Rezervasyonlar, sipariş yerine getirilene veya serbest bırakılana kadar envanteri tutar.',
    stepsEn: [
      'Open an order with pending reservations',
      'Select lots to fulfill each order line',
      'Confirm the reservation',
      'Convert to shipment when ready to dispatch'
    ],
    stepsTr: [
      'Bekleyen rezervasyonları olan bir siparişi açın',
      'Her sipariş satırını karşılamak için lotları seçin',
      'Rezervasyonu onaylayın',
      'Gönderi hazır olduğunda sevkiyata dönüştürün'
    ],
    tipsEn: [
      'FIFO (First In, First Out) is recommended for fabric',
      'Check lot age and condition before reserving',
      'Release unused reservations to free up inventory'
    ],
    tipsTr: [
      'Kumaş için FIFO (İlk Giren, İlk Çıkar) önerilir',
      'Rezerve etmeden önce lot yaşını ve durumunu kontrol edin',
      'Envanteri serbest bırakmak için kullanılmayan rezervasyonları iptal edin'
    ],
    relatedTopics: ['order-creation', 'inventory', 'lot-details'],
    docsUrl: '/docs/reservations'
  },
  'qr-scanning': {
    id: 'qr-scanning',
    titleEn: 'QR Code Scanning',
    titleTr: 'QR Kod Tarama',
    overviewEn: 'Use your device camera to scan QR codes on lot labels for instant access to lot information, status, and history.',
    overviewTr: 'Lot bilgilerine, durumuna ve geçmişine anında erişmek için lot etiketlerindeki QR kodlarını taramak için cihaz kameranızı kullanın.',
    stepsEn: [
      'Navigate to QR Scanner page',
      'Allow camera access when prompted',
      'Point camera at QR code on lot label',
      'View lot details automatically'
    ],
    stepsTr: [
      'QR Tarayıcı sayfasına gidin',
      'İstendiğinde kamera erişimine izin verin',
      'Kamerayı lot etiketindeki QR koduna doğrultun',
      'Lot detaylarını otomatik olarak görüntüleyin'
    ],
    tipsEn: [
      'Ensure good lighting for best scan results',
      'Clean camera lens if scanning is slow',
      'Manual entry is available if QR code is damaged'
    ],
    tipsTr: [
      'En iyi tarama sonuçları için iyi aydınlatma sağlayın',
      'Tarama yavaşsa kamera lensini temizleyin',
      'QR kodu hasarlıysa manuel giriş mevcuttur'
    ],
    relatedTopics: ['lot-intake', 'inventory', 'stock-take'],
    docsUrl: '/docs/qr-scanning'
  },
  'stock-take': {
    id: 'stock-take',
    titleEn: 'Stock Take Process',
    titleTr: 'Sayım Süreci',
    overviewEn: 'Perform physical inventory counts using photo capture and OCR. The system automatically extracts lot information from labels and flags discrepancies.',
    overviewTr: 'Fotoğraf çekme ve OCR kullanarak fiziksel envanter sayımları yapın. Sistem, etiketlerden lot bilgilerini otomatik olarak çıkarır ve tutarsızlıkları işaretler.',
    stepsEn: [
      'Start a new stock take session',
      'Photograph each lot label',
      'Verify or correct OCR results',
      'Mark lots as counted',
      'Review and submit session for approval'
    ],
    stepsTr: [
      'Yeni bir sayım oturumu başlatın',
      'Her lot etiketini fotoğraflayın',
      'OCR sonuçlarını doğrulayın veya düzeltin',
      'Lotları sayıldı olarak işaretleyin',
      'Oturumu gözden geçirin ve onay için gönderin'
    ],
    tipsEn: [
      'Take clear, well-lit photos for best OCR accuracy',
      'Count in sections to avoid missing any lots',
      'Report damaged labels for replacement'
    ],
    tipsTr: [
      'En iyi OCR doğruluğu için net, iyi aydınlatılmış fotoğraflar çekin',
      'Hiçbir lotu kaçırmamak için bölümler halinde sayın',
      'Değiştirme için hasarlı etiketleri bildirin'
    ],
    relatedTopics: ['inventory', 'lot-intake', 'qr-scanning'],
    docsUrl: '/docs/stock-take'
  },
  'forecast': {
    id: 'forecast',
    titleEn: 'Demand Forecasting',
    titleTr: 'Talep Tahmini',
    overviewEn: 'View demand predictions based on historical order data. The forecast engine analyzes trends and seasonality to predict future needs.',
    overviewTr: 'Geçmiş sipariş verilerine dayalı talep tahminlerini görüntüleyin. Tahmin motoru, gelecekteki ihtiyaçları tahmin etmek için trendleri ve mevsimselliği analiz eder.',
    stepsEn: [
      'Navigate to Forecast page',
      'Select quality/color combinations to analyze',
      'Review projected demand vs current stock',
      'Identify stockout risks and overstock situations',
      'Adjust forecast parameters if needed'
    ],
    stepsTr: [
      'Tahmin sayfasına gidin',
      'Analiz edilecek kalite/renk kombinasyonlarını seçin',
      'Mevcut stoka karşı öngörülen talebi gözden geçirin',
      'Stok tükenmesi risklerini ve fazla stok durumlarını belirleyin',
      'Gerekirse tahmin parametrelerini ayarlayın'
    ],
    tipsEn: [
      'Run forecasts weekly for best accuracy',
      'Consider seasonal patterns when reviewing results',
      'Per-quality overrides can fine-tune predictions'
    ],
    tipsTr: [
      'En iyi doğruluk için tahminleri haftalık olarak çalıştırın',
      'Sonuçları incelerken mevsimsel kalıpları göz önünde bulundurun',
      'Kalite başına geçersiz kılmalar tahminleri ince ayarlayabilir'
    ],
    relatedTopics: ['inventory', 'orders', 'reports'],
    docsUrl: '/docs/forecasting'
  },
  'keyboard-shortcuts': {
    id: 'keyboard-shortcuts',
    titleEn: 'Keyboard Shortcuts',
    titleTr: 'Klavye Kısayolları',
    overviewEn: 'Navigate and perform actions faster using keyboard shortcuts. Available shortcuts depend on your current page context.',
    overviewTr: 'Klavye kısayollarını kullanarak daha hızlı gezinin ve işlemler gerçekleştirin. Mevcut kısayollar, mevcut sayfa bağlamınıza bağlıdır.',
    tipsEn: [
      'Ctrl/Cmd + K opens command palette',
      'Ctrl/Cmd + / shows all shortcuts',
      'Press G then I to go to Inventory',
      'Press G then O to go to Orders',
      'Escape closes dialogs and panels'
    ],
    tipsTr: [
      'Ctrl/Cmd + K komut paletini açar',
      'Ctrl/Cmd + / tüm kısayolları gösterir',
      'Envantere gitmek için G ardından I tuşlarına basın',
      'Siparişlere gitmek için G ardından O tuşlarına basın',
      'Escape diyalogları ve panelleri kapatır'
    ],
    relatedTopics: [],
    docsUrl: '/docs/keyboard-shortcuts'
  }
};

export function getHelpContent(topic: string, language: 'en' | 'tr'): HelpTopic | null {
  const content = helpContent[topic];
  if (!content) return null;
  return content;
}

export function getHelpTitle(topic: string, language: 'en' | 'tr'): string {
  const content = helpContent[topic];
  if (!content) return topic;
  return language === 'tr' ? content.titleTr : content.titleEn;
}

export function getHelpOverview(topic: string, language: 'en' | 'tr'): string {
  const content = helpContent[topic];
  if (!content) return '';
  return language === 'tr' ? content.overviewTr : content.overviewEn;
}
