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
    orderQueue: 'Order Queue',
    reports: 'Reports',
    suppliers: 'Suppliers',
    admin: 'Admin',
    signOut: 'Sign Out',
    overview: 'Overview',
    inventoryManagement: 'Inventory Management',
    incomingStockLabel: 'Incoming Stock',
    goodsReceipt: 'Goods Receipt',
    ordersAndReservations: 'Orders & Reservations',
    toolsAndUtilities: 'Tools & Utilities',
    reportsAndAdmin: 'Reports & Admin',
    
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

    // Auth
    email: 'Email',
    password: 'Password',
    signIn: 'Sign In',
    register: 'Register',
    signOutConfirmation: 'Are you sure you want to sign out?',
    signOutAction: 'Sign Out',
    
    // Form
    fillAllFields: 'Please fill in all fields.',
    
    // Orders - specific fields
    allOrders: 'All Orders',
    viewManageOrders: 'View and manage existing orders',
    orderNumberField: 'Order Number',
    customer: 'Customer',
    lotsCount: 'Lots Count',
    status: 'Status',
    created: 'Created',
    actions: 'Actions',
    fulfilled: 'Fulfilled',
    view: 'View',
    print: 'Print',
    orderMarkedFulfilled: 'Order marked as fulfilled',
    createOrder: 'Create Order',
    standardOrder: 'Standard Order',
    multiQualityOrder: 'Multi-Quality Order',
    bulkUpload: 'Bulk Upload',
    sampleOrder: 'Sample Order',
    customerNameField: 'Customer Name',
    selectedLots: 'Selected Lots',
    orderCreatedSuccessfully: 'Order created successfully',
    createdOrderNote: 'Created order {orderNumber} for {customerName} with {lotCount} lots, {rollCount} rolls, and {meters} meters',
    fulfilledOrderNote: 'Fulfilled order {orderNumber} for {customerName}',
    deletedOrderNote: 'Deleted order {orderNumber} with {rollCount} rolls',
    deleteOrder: 'Delete Order',
    confirmDelete: 'Confirm Delete',
    actionCannotBeUndone: 'This action cannot be undone.',
    cancelDelete: 'Cancel Delete',
    noSearchResults: 'No search results found.',
    noInventoryData: 'No inventory data available.',
    differentColors: 'Different Colors',
    stockOverview: 'Stock Overview',
    searchPlaceholder: 'Search by quality...',
    viewQuality: 'View Quality',
    deleteMode: 'Delete Mode',
    deleteSelected: 'Delete Selected',
    selectForSample: 'Select for Sample',
    rolls: 'rolls',
    
    // Reservation
    newReservation: 'New Reservation',
    reservationNumber: 'Reservation Number',
    reservedDate: 'Reserved Date',
    totalReservedMeters: 'Total Reserved Meters',
    lines: 'Lines',
    active: 'Active',
    converted: 'Converted',
    reserve: 'Reserve',
    reserveFromIncoming: 'Reserve from Incoming',
    viewReservations: 'View Reservations',
    reservationsForIncoming: 'Reservations for Incoming Stock',
    noReservationsFound: 'No reservations found',
    
    // Orders & Reservations
    allReservations: 'All Reservations',
    activeReservationsTab: 'Active',
    convertedReservationsTab: 'Converted',
    canceledReservationsTab: 'Canceled',
    releasedReservationsTab: 'Released',
    customerId: 'Customer ID',
    holdUntil: 'Hold Until',
    releaseReservation: 'Release Reservation',
    viewDetails: 'View Details',
    cancelReservation: 'Cancel Reservation',
    convertToOrder: 'Convert to Order',
    noReservations: 'No reservations found',
    createReservationFor: 'Create Reservation',
    physicalInventory: 'Physical Inventory',
    incomingStock: 'Incoming Stock',
    customerInformation: 'Customer Information',
    selectItemsToReserve: 'Select Items to Reserve',
    selectedItems: 'Selected Items',
    totalReservedLabel: 'Total Reserved',
    cancelDialog: 'Cancel',
    createReservationButton: 'Create Reservation ({count} items)',
    creating: 'Creating...',
    pleaseAddAtLeastOneLine: 'Please add at least one line item',
    reservationCreated: 'Reservation created successfully',
    optionalCustomerId: 'Customer ID (Optional)',
    optionalHoldUntil: 'Hold Until (Optional)',
    additionalNotes: 'Additional Notes (Optional)',
    totalReserved: 'Total Reserved',
    lineItems: 'Line Items',
    reservationDetails: 'Reservation Details',
    reservedItems: 'Reserved Items',
    scope: 'Scope',
    source: 'Source',
    rollsCount: 'Rolls',
    canceledOn: 'Canceled On',
    canceledBy: 'Canceled By',
    cancelReason: 'Cancel Reason',
    convertedOn: 'Converted On',
    convertedBy: 'Converted By',
    statusHistory: 'Status History',
    closeDialog: 'Close',
    releaseStock: 'Release Stock',
    cancelReservationTitle: 'Cancel Reservation',
    cancelReservationDesc: 'Cancel reservation {reservationNumber} for {customerName}',
    thisWillReleaseStock: 'This will release all reserved stock',
    metersWillBeReleased: '{meters}m will become available again',
    cancellationReason: 'Cancellation Reason',
    selectReason: 'Select a reason',
    customerCanceled: 'Customer Canceled',
    incorrectEntry: 'Incorrect Entry',
    noPayment: 'No Payment Received',
    otherReason: 'Other',
    additionalDetails: 'Additional Details (Required for "Other")',
    explainReason: 'Please explain the reason...',
    keepReservation: 'Keep Reservation',
    confirmCancel: 'Cancel Reservation',
    canceling: 'Canceling...',
    selectCancelReason: 'Please select a cancellation reason',
    provideAdditionalDetails: 'Please provide additional details',
    reservationCanceled: 'Reservation canceled successfully',
    convertReservationTitle: 'Convert to Order',
    convertReservationDesc: 'Convert reservation {reservationNumber} to a sales order',
    noteIncomingLinesWont: 'Note: Incoming lines will not be converted',
    incomingLineCount: '{count} incoming line(s) will remain in the reservation',
    inventoryLineWillConvert: '{count} inventory line(s) will be converted',
    leaveEmptyToUse: 'Leave empty to use: {customerName}',
    createOrderButton: 'Create Order',
    creatingOrder: 'Creating...',
    cannotConvert: 'Cannot convert: reservation contains only incoming stock',
    orderCreated: 'Order created successfully from reservation',
    releaseReservationTitle: 'Release Reservation',
    releaseReservationDesc: 'Release reservation {reservationNumber} for {customerName}',
    releaseInfo: 'This will release reserved stock back to available inventory',
    metersWillBeAvailable: '{meters}m will become available again',
    recordKeepingNote: 'The reservation will remain in the system with status "Released" for record keeping.',
    releaseButton: 'Release Reservation',
    releasing: 'Releasing...',
    reservationReleased: 'Reservation released successfully',
    
    // Audit Logs
    actionCreate: 'Create',
    actionUpdate: 'Update',
    actionDelete: 'Delete',
    actionStatusChange: 'Status Change',
    actionFulfill: 'Fulfill',
    actionApprove: 'Approve',
    actionReject: 'Reject',
    lotsEntity: 'Lots',
    ordersEntity: 'Orders',
    rollsEntity: 'Rolls',
    suppliersEntity: 'Suppliers',
    profilesEntity: 'Profiles',
    lotQueue: 'Lot Queue',
    fieldEditQueue: 'Field Edit Queue',
    rolePermission: 'Role Permission',
    searchByIdentifierOrUser: 'Search by identifier or user...',
    filterByAction: 'Filter by Action',
    filterByEntity: 'Filter by Entity',
    allActions: 'All Actions',
    allEntities: 'All Entities',
    actionDetails: 'Action Details',
    reverseAction: 'Reverse Action',
    reverseActionConfirm: 'Are you sure you want to reverse this action?',
    
    // Lot
    lotNumber: 'Lot Number',
    differentLotCount: 'Different Lot Count',
    
    // Admin
    adminDashboard: 'Admin Dashboard',
    userManagement: 'User Management',
    role: 'Role',
    
    // Supplier
    supplierName: 'Supplier Name',
    addSupplier: 'Add Supplier',
    editSupplier: 'Edit Supplier',
    
    // Lot Intake
    lotIntakeForm: 'Lot Intake Form',
    quality: 'Quality',
    color: 'Color',
    meters: 'Meters',
    entryDate: 'Entry Date',
    supplier: 'Supplier',
    warehouseLocation: 'Warehouse Location',
    notes: 'Notes',
    addLot: 'Add Lot',
    
    // QR Scan
    scanQRCode: 'Scan QR Code',
    
    // Order Queue
    orderQueueManagement: 'Order Queue Management',
    
    // User Management
    createUser: 'Create User',
    editUser: 'Edit User',
    
    // Field Labels
    emailField: 'Email',
    passwordField: 'Password',
    roleField: 'Role',
    fullNameField: 'Full Name',
    
    // Role Options
    adminRole: 'Admin',
    seniorManagerRole: 'Senior Manager',
    accountingRole: 'Accounting',
    warehouseStaffRole: 'Warehouse Staff',
    
    // Permissions
    permissions: 'Permissions',
    
    // Inventory
    allQualities: 'All Qualities',
    physicalLots: 'Physical Lots',
    physicalMeters: 'Physical Meters',
    physicalRolls: 'Physical Rolls',
    incomingMeters: 'Incoming Meters',
    reservedMeters: 'Reserved Meters',
    availableMeters: 'Available Meters',
    
    // Incoming Stock
    totalIncomingMeters: 'Total Incoming Meters',
    awaitingArrival: 'Awaiting Arrival',
    inProgress: 'In Progress',
    pastExpectedDate: 'Past Expected Date',
    allStatusFilter: 'All Status',
    allSuppliers: 'All Suppliers',
    incomingStockEntries: 'Incoming Stock Entries',
    partiallyReceived: 'Partially Received',
    fullyReceived: 'Fully Received',
    filterBySupplier: 'Filter by Supplier',
    filterByStatus: 'Filter by Status',
    pendingInbound: 'Pending Inbound',
    partial: 'Partial',
    complete: 'Complete',
    receive: 'Receive',
    open: 'Open',
    progressLabel: 'Progress',
    arrivalDate: 'Arrival Date',
    invoiceNumber: 'Invoice Number',
    newEntry: 'New Entry',
    noIncomingStockFound: 'No incoming stock found',
    failedToFetchIncomingStock: 'Failed to fetch incoming stock',
    confirmDeleteIncomingStock: 'Are you sure you want to delete this incoming stock?',
    incomingStockDeletedSuccess: 'Incoming stock deleted successfully',
    failedToDeleteIncomingStock: 'Failed to delete incoming stock',
    noPermissionIncomingStock: 'You do not have permission to view incoming stock',
    loadingEllipsis: 'Loading...',
    
    // Audit Log
    auditLog: 'Audit Log',
    actionHistory: 'Action History',
    user: 'User',
    action: 'Action',
    timestamp: 'Timestamp',
    description: 'Description',
    entity: 'Entity',
    identifier: 'Identifier',
    reversed: 'Reversed',
    auditActions: 'Actions',
    fulfill: 'Fulfill',
    refresh: 'Refresh',
    
    // Audit Detail Keys
    auditOrderNumber: 'Order Number:',
    auditCustomer: 'Customer:',
    auditLot: 'Lot',
    auditRollsCount: 'rolls',
    auditTotalRolls: 'Total Rolls:',
    auditLots: 'Lots:',
    auditFulfilled: 'Fulfilled:',
    auditLotNumber: 'Lot Number:',
    auditQuality: 'Quality:',
    auditColor: 'Color:',
    auditMeters: 'Meters:',
    auditRollCount: 'Roll Count:',
    auditLocation: 'Location:',
    auditSupplier: 'Supplier:',
    auditEntryDate: 'Entry Date:',
    auditInvoice: 'Invoice:',
    auditRollPosition: 'Roll Position:',
    auditStatus: 'Status:',
    auditSupplierName: 'Supplier Name:',
    auditEmail: 'Email:',
    auditName: 'Name:',
    auditRole: 'Role:',
    auditActive: 'Active',
    auditInactive: 'Inactive',
    detailsNotAvailable: 'Details not available',
    empty: 'Empty',
    yes: 'Yes',
    no: 'No',
    errorFetchingReversalReason: 'Error fetching reversal reason',
    loadingReason: 'Loading reason...',
    reason: 'Reason:',
    noFieldsChanged: 'No fields were changed',
    failedToLoadAuditLogs: 'Failed to load audit logs',
    thisActionWasReversed: 'This action was reversed',
    reversedAt: 'Reversed At:',
    previousState: 'Previous State',
    createdWith: 'Created With',
    newState: 'New State',
    changesMade: 'Changes Made',
    viewTechnicalDetails: 'View Technical Details',
    oldDataJson: 'Old Data (JSON)',
    newDataJson: 'New Data (JSON)',
    reasonForReversal: 'Reason for Reversal',
    enterReasonForReversal: 'Enter reason for reversal...',
    reversing: 'Reversing...',
    reverseActionButton: 'Reverse Action',
    
    // Settings
    settings: 'Settings',
    languageSettings: 'Language Settings',
    
    // Actions
    saveChanges: 'Save Changes',
    
    // Placeholders
    enterEmail: 'Enter email',
    enterPassword: 'Enter password',
    enterFullName: 'Enter full name',
    selectRole: 'Select role',
    
    // Validation Messages
    emailRequired: 'Email is required',
    passwordRequired: 'Password is required',
    fullNameRequired: 'Full name is required',
    roleRequired: 'Role is required',
    
    // Success Messages
    userCreatedSuccessfully: 'User created successfully',
    userUpdatedSuccessfully: 'User updated successfully',
    
    // Error Messages
    failedToCreateUser: 'Failed to create user',
    failedToUpdateUser: 'Failed to update user',
    
    // Confirmation Messages
    confirmDeleteUser: 'Are you sure you want to delete this user?',
    
    // Button Labels
    createUserButton: 'Create User',
    updateUserButton: 'Update User',
    deleteUserButton: 'Delete User',
    
    // Table Headers
    idHeader: 'ID',
    emailHeader: 'Email',
    fullNameHeader: 'Full Name',
    roleHeader: 'Role',
    actionsHeader: 'Actions',
    
    // Admin Dashboard
    totalUsers: 'Total Users',
    activeLots: 'Active Lots',
    pendingOrders: 'Pending Orders',
    
    // Admin Dashboard Descriptions
    totalUsersDescription: 'Number of registered users',
    activeLotsDescription: 'Number of active lots in the system',
    pendingOrdersDescription: 'Number of orders currently pending',
    
    // Admin Dashboard Cards
    usersCardTitle: 'Users',
    lotsCardTitle: 'Lots',
    ordersCardTitle: 'Orders',
    
    // Admin Dashboard Button
    manageUsersButton: 'Manage Users',
    manageLotsButton: 'Manage Lots',
    manageOrdersButton: 'Manage Orders',
    
    // Admin Dashboard Section Titles
    systemOverview: 'System Overview',
    userActivity: 'User Activity',
    
    // Admin Dashboard Placeholders
    noActivityPlaceholder: 'No user activity to display',
    
    // Admin Dashboard Labels
    lastLoginLabel: 'Last Login',
    
    // Admin Dashboard Messages
    welcomeAdmin: 'Welcome, Admin!',
    
    // Admin Dashboard Tooltips
    viewUserDetailsTooltip: 'View user details',
    editUserDetailsTooltip: 'Edit user details',
    deleteUserTooltip: 'Delete user',
    
    // Admin Dashboard Alerts
    userDeletedAlert: 'User deleted successfully',
    
    // Admin Dashboard Confirmations
    confirmUserDeletion: 'Are you sure you want to delete this user?',
    
    // Admin Dashboard Buttons
    confirmDeleteButton: 'Confirm Delete',
    cancelDeleteButton: 'Cancel Delete',
    
    // Admin Dashboard Forms
    editUserFormTitle: 'Edit User',
    createUserFormTitle: 'Create User',
    
    // Admin Dashboard Inputs
    emailInputLabel: 'Email',
    passwordInputLabel: 'Password',
    fullNameInputLabel: 'Full Name',
    roleSelectLabel: 'Role',
    
    // Admin Dashboard Select Options
    adminRoleOption: 'Admin',
    managerRoleOption: 'Manager',
    staffRoleOption: 'Staff',
    
    // Admin Dashboard Buttons
    submitFormButton: 'Submit',
    cancelFormButton: 'Cancel',
    
    // Admin Dashboard Messages
    userCreatedMessage: 'User created successfully',
    userUpdatedMessage: 'User updated successfully',
    
    // Admin Dashboard Errors
    createUserError: 'Failed to create user',
    updateUserError: 'Failed to update user',
    
    // Admin Dashboard Placeholders
    enterEmailPlaceholder: 'Enter email',
    enterPasswordPlaceholder: 'Enter password',
    enterFullNamePlaceholder: 'Enter full name',
    selectRolePlaceholder: 'Select role',
    
    // Admin Dashboard Validation
    emailValidationMessage: 'Please enter a valid email',
    passwordValidationMessage: 'Password must be at least 6 characters',
    fullNameValidationMessage: 'Please enter your full name',
    roleValidationMessage: 'Please select a role',
    
    // Admin Dashboard Validation
    emailValidationMessageText: 'Please enter a valid email',
    passwordValidationMessageText: 'Password must be at least 6 characters',
    fullNameValidationMessageText: 'Please enter your full name',
    roleValidationMessageText: 'Please select a role',
  },
  tr: {
    // Navigation
    dashboard: 'Panel',
    lotIntake: 'LOT Girişi',
    inventory: 'Envanter',
    orders: 'Siparişler',
    qrScan: 'QR Tarama',
    orderQueue: 'Sipariş Sırası',
    reports: 'Raporlar',
    suppliers: 'Tedarikçiler',
    admin: 'Yönetici',
    signOut: 'Çıkış Yap',

    // Navigation and sections
    overview: 'Genel Bakış',
    inventoryManagement: 'Stok Yönetimi',
    incomingStockLabel: 'Yoldaki Envanter',
    goodsReceipt: 'Gelen Envanteri Stoğa Al',
    ordersAndReservations: 'Siparişler ve Rezerveler',
    toolsAndUtilities: 'Araçlar',
    reportsAndAdmin: 'Raporlar ve Yönetici',
    
    // Orders Tab
    reservations: 'Rezerve /Opsiyonlu Siparişler',
    
    // Inventory Stats
    physicalLots: 'Fiziki Lot Sayısı',
    physicalMeters: 'Fiziksel Olarak Mevcut Metraj',
    physicalRolls: 'Fiziksel Mevcut Top Sayısı',
    incomingMeters: 'Yoldaki Metraj',
    expectedStockOnTheWay: 'Yolda gelmesi beklenen metraj',
    reservedMeters: 'Rezerve Metraj',
    activeReservations: 'Aktif Rezervasyonlar',
    availableMeters: 'Satılabilir Toplam Metraj',
    physicalPlusIncomingMinusReserved: 'Fiziki + Yoldaki - Rezerve',
    incoming: 'Yolda',
    reserved: 'Rezerve',
    available: 'Satılabilir',
    
    // Goods Receipt
    pendingShipments: 'Bekleyen Gönderiler',
    totalPendingMeters: 'Gönderim Bekleyen Metraj',
    expectedToday: 'Bugüne Beklenen',
    overdue: 'Tarihi Geçmiş',
    pendingReceipts: 'Stoğa Alınmayı Bekleyen',
    receiptHistory: 'Stoğa Alınma Geçmişi',
    pending: 'Beklemede',
    invoice: 'Fatura:',
    expected: 'Beklenen:',
    received: 'Gelen:',
    remaining: 'Kalan:',
    receiveStock: 'Stoğa al',
    
    // Incoming Stock
    totalIncomingMeters: 'Toplam Yoldaki Metraj',
    awaitingArrival: 'Gelmesi Bekleniyor',
    inProgress: 'Devam Ediyor',
    pastExpectedDate: 'Tarihi Geçmiş',
    allStatusFilter: 'Tüm Durumlar',
    allSuppliers: 'Tüm Tedarikçiler',
    incomingStockEntries: 'Yoldaki Envanter Kayıtları',
    partiallyReceived: 'Kısmen Alındı',
    fullyReceived: 'Tamamen Alındı',
    filterBySupplier: 'Tedarikçiye Göre Filtrele',
    filterByStatus: 'Duruma Göre Filtrele',
    pendingInbound: 'Gelmesi Bekleniyor',
    partial: 'Kısmi',
    complete: 'Tamamlandı',
    receive: 'Al',
    open: 'Açık',
    progressLabel: 'İlerleme',
    arrivalDate: 'Varış Tarihi',
    invoiceNumber: 'Fatura Numarası',
    newEntry: 'Yeni Giriş',
    noIncomingStockFound: 'Yoldaki envanter bulunamadı',
    failedToFetchIncomingStock: 'Yoldaki envanter getirilemedi',
    confirmDeleteIncomingStock: 'Bu yoldaki envanteri silmek istediğinizden emin misiniz?',
    incomingStockDeletedSuccess: 'Yoldaki envanter başarıyla silindi',
    failedToDeleteIncomingStock: 'Yoldaki envanter silinemedi',
    noPermissionIncomingStock: 'Yoldaki envanteri görüntüleme izniniz yok',
    loadingEllipsis: 'Yükleniyor...',
    
    // Reports
    reportsAndAnalytics: 'Raporlar ve Analitik',
    pickDateRange: 'Tarih aralığı seç',
    totalLots: 'Lot Sayısı',
    totalOrders: 'Sipariş Sayısı',
    totalMeters: 'Toplam Metraj',
    totalRolls: 'Toplam Top sayısı',
    totalQualities: 'Toplam Kaliteler',
    lotsByQuality: 'Kalite bazında Lot sayısı',
    orderStatus: 'Siparişi Durumu',
    inventoryAnalysis: 'Envanter Analizi',
    orderPerformance: 'Sipariş Performansı',
    salesReport: 'Satış Raporu',
    supplierAnalysis: 'Tedarikçi Analizi',
    
    // Common
    search: 'Ara',
    filter: 'Filtre',
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
    of: '/',

    // Auth
    email: 'E-posta',
    password: 'Şifre',
    signIn: 'Giriş Yap',
    register: 'Kayıt Ol',
    signOutConfirmation: 'Çıkış yapmak istediğinizden emin misiniz?',
    signOutAction: 'Çıkış Yap',
    
    // Form
    fillAllFields: 'Lütfen tüm alanları doldurun.',
    
    // Orders - specific fields
    allOrders: 'Tüm Siparişler',
    viewManageOrders: 'Mevcut siparişleri görüntüleyin ve yönetin',
    orderNumberField: 'Sipariş Numarası',
    customer: 'Müşteri',
    lotsCount: 'Lot Sayısı',
    status: 'Durum',
    created: 'Oluşturuldu',
    actions: 'Eylemler',
    fulfilled: 'Tamamlandı',
    view: 'Görüntüle',
    print: 'Yazdır',
    orderMarkedFulfilled: 'Sipariş tamamlandı olarak işaretlendi',
    createOrder: 'Sipariş Oluştur',
    standardOrder: 'Standart Sipariş',
    multiQualityOrder: 'Çok Kaliteli Sipariş',
    bulkUpload: 'Toplu Yükleme',
    sampleOrder: 'Numune Siparişi',
    customerNameField: 'Müşteri Adı',
    selectedLots: 'Seçilen Lotlar',
    orderCreatedSuccessfully: 'Sipariş başarıyla oluşturuldu',
    createdOrderNote: '{orderNumber} siparişi {customerName} adına {lotCount} lot, {rollCount} top ve {meters} metre ile oluşturuldu',
    fulfilledOrderNote: '{orderNumber} siparişi {customerName} adına tamamlandı',
    deletedOrderNote: '{orderNumber} siparişi {rollCount} top ile silindi',
    deleteOrder: 'Siparişi Sil',
    confirmDelete: 'Silmeyi Onayla',
    actionCannotBeUndone: 'Bu işlem geri alınamaz.',
    cancelDelete: 'Silmeyi İptal Et',
    noSearchResults: 'Arama sonucu bulunamadı.',
    noInventoryData: 'Envanter verisi bulunamadı.',
    differentColors: 'Farklı Renkler',
    stockOverview: 'Stok Genel Bakışı',
    searchPlaceholder: 'Kaliteye göre ara...',
    viewQuality: 'Kaliteyi Görüntüle',
    deleteMode: 'Silme Modu',
    deleteSelected: 'Seçileni Sil',
    selectForSample: 'Numune İçin Seç',
    rolls: 'toplar',
    
    // Reservation
    newReservation: 'Yeni Rezervasyon',
    reservationNumber: 'Rezervasyon Numarası',
    reservedDate: 'Rezerve Tarihi',
    totalReservedMeters: 'Toplam Rezerve Metre',
    lines: 'Satırlar',
    active: 'Aktif',
    converted: 'Dönüştürüldü',
    reserve: 'Rezerve Et',
    reserveFromIncoming: 'Yoldaki Envanterden Rezerve Et',
    viewReservations: 'Rezervasyonları Görüntüle',
    reservationsForIncoming: 'Yoldaki Envanter Rezervasyonları',
    noReservationsFound: 'Rezervasyon bulunamadı',
    
    // Orders & Reservations
    allReservations: 'Tüm Rezervasyonlar',
    activeReservationsTab: 'Aktif',
    convertedReservationsTab: 'Dönüştürüldü',
    canceledReservationsTab: 'İptal Edildi',
    releasedReservationsTab: 'Serbest Bırakıldı',
    customerId: 'Müşteri No',
    holdUntil: 'Şu Tarihe Kadar Tut',
    releaseReservation: 'Rezervasyonu Serbest Bırak',
    viewDetails: 'Detayları Görüntüle',
    cancelReservation: 'Rezervasyonu İptal Et',
    convertToOrder: 'Siparişe Dönüştür',
    noReservations: 'Rezervasyon bulunamadı',
    createReservationFor: 'Rezervasyon Oluştur',
    physicalInventory: 'Fiziksel Envanter',
    incomingStock: 'Yoldaki Envanter',
    customerInformation: 'Müşteri Bilgileri',
    selectItemsToReserve: 'Rezerve Edilecek Öğeleri Seç',
    selectedItems: 'Seçilen Öğeler',
    totalReservedLabel: 'Toplam Rezerve',
    cancelDialog: 'İptal',
    createReservationButton: 'Rezervasyon Oluştur ({count} öğe)',
    creating: 'Oluşturuluyor...',
    pleaseAddAtLeastOneLine: 'Lütfen en az bir satır ekleyin',
    reservationCreated: 'Rezervasyon başarıyla oluşturuldu',
    optionalCustomerId: 'Müşteri No (Opsiyonel)',
    optionalHoldUntil: 'Şu Tarihe Kadar Tut (Opsiyonel)',
    additionalNotes: 'Ek Notlar (Opsiyonel)',
    totalReserved: 'Toplam Rezerve',
    lineItems: 'Satır Öğeleri',
    reservationDetails: 'Rezervasyon Detayları',
    reservedItems: 'Rezerve Edilen Öğeler',
    scope: 'Kapsam',
    source: 'Kaynak',
    rollsCount: 'Toplar',
    canceledOn: 'İptal Tarihi',
    canceledBy: 'İptal Eden',
    cancelReason: 'İptal Nedeni',
    convertedOn: 'Dönüştürme Tarihi',
    convertedBy: 'Dönüştüren',
    statusHistory: 'Durum Geçmişi',
    closeDialog: 'Kapat',
    releaseStock: 'Stoğu Serbest Bırak',
    cancelReservationTitle: 'Rezervasyonu İptal Et',
    cancelReservationDesc: '{customerName} için {reservationNumber} rezervasyonunu iptal et',
    thisWillReleaseStock: 'Bu tüm rezerve edilmiş stoğu serbest bırakacak',
    metersWillBeReleased: '{meters}m tekrar kullanılabilir olacak',
    cancellationReason: 'İptal Nedeni',
    selectReason: 'Neden seçin',
    customerCanceled: 'Müşteri İptal Etti',
    incorrectEntry: 'Yanlış Giriş',
    noPayment: 'Ödeme Alınmadı',
    otherReason: 'Diğer',
    additionalDetails: 'Ek Detaylar ("Diğer" için Gerekli)',
    explainReason: 'Lütfen nedeni açıklayın...',
    keepReservation: 'Rezervasyonu Koru',
    confirmCancel: 'Rezervasyonu İptal Et',
    canceling: 'İptal Ediliyor...',
    selectCancelReason: 'Lütfen iptal nedeni seçin',
    provideAdditionalDetails: 'Lütfen ek detaylar sağlayın',
    reservationCanceled: 'Rezervasyon başarıyla iptal edildi',
    convertReservationTitle: 'Siparişe Dönüştür',
    convertReservationDesc: '{reservationNumber} rezervasyonunu satış siparişine dönüştür',
    noteIncomingLinesWont: 'Not: Yoldaki satırlar dönüştürülmeyecek',
    incomingLineCount: '{count} yoldaki satır rezervasyonda kalacak',
    inventoryLineWillConvert: '{count} envanter satırı dönüştürülecek',
    leaveEmptyToUse: 'Kullanmak için boş bırakın: {customerName}',
    createOrderButton: 'Sipariş Oluştur',
    creatingOrder: 'Oluşturuluyor...',
    cannotConvert: 'Dönüştürülemiyor: rezervasyon yalnızca yoldaki envanter içeriyor',
    orderCreated: 'Rezervasyondan sipariş başarıyla oluşturuldu',
    releaseReservationTitle: 'Rezervasyonu Serbest Bırak',
    releaseReservationDesc: '{customerName} için {reservationNumber} rezervasyonunu serbest bırak',
    releaseInfo: 'Bu, rezerve edilen stoğu mevcut envantere geri döndürecektir',
    metersWillBeAvailable: '{meters}m tekrar kullanılabilir olacak',
    recordKeepingNote: 'Rezervasyon, kayıt tutma için "Serbest Bırakıldı" durumu ile sistemde kalacaktır.',
    releaseButton: 'Rezervasyonu Serbest Bırak',
    releasing: 'Serbest Bırakılıyor...',
    reservationReleased: 'Rezervasyon başarıyla serbest bırakıldı',
    
    // Audit Logs
    actionCreate: 'Oluştur',
    actionUpdate: 'Güncelle',
    actionDelete: 'Sil',
    actionStatusChange: 'Durum Değişikliği',
    actionFulfill: 'Teslim Et',
    actionApprove: 'Onayla',
    actionReject: 'Reddet',
    lotsEntity: 'Lotlar',
    ordersEntity: 'Siparişler',
    rollsEntity: 'Toplar',
    suppliersEntity: 'Tedarikçiler',
    profilesEntity: 'Profiller',
    lotQueue: 'Lot Kuyruğu',
    fieldEditQueue: 'Alan Düzenleme Kuyruğu',
    rolePermission: 'Rol İzni',
    searchByIdentifierOrUser: 'Tanımlayıcı veya kullanıcıya göre ara...',
    filterByAction: 'Eyleme göre filtrele',
    filterByEntity: 'Varlığa göre filtrele',
    allActions: 'Tüm Eylemler',
    allEntities: 'Tüm Varlıklar',
    actionDetails: 'Eylem Detayları',
    reverseAction: 'Eylemi Geri Al',
    reverseActionConfirm: 'Bu eylemi geri almak istediğinizden emin misiniz?',
    
    // Lot
    lotNumber: 'Lot Numarası',
    differentLotCount: 'Farklı Lot Sayısı',
    
    // Admin
    adminDashboard: 'Yönetici Paneli',
    userManagement: 'Kullanıcı Yönetimi',
    role: 'Rol',
    
    // Supplier
    supplierName: 'Tedarikçi Adı',
    addSupplier: 'Tedarikçi Ekle',
    editSupplier: 'Tedarikçi Düzenle',
    
    // Lot Intake
    lotIntakeForm: 'Lot Giriş Formu',
    quality: 'Kalite',
    color: 'Renk',
    meters: 'Metre',
    entryDate: 'Giriş Tarihi',
    supplier: 'Tedarikçi',
    warehouseLocation: 'Depo Konumu',
    notes: 'Notlar',
    addLot: 'Lot Ekle',
    
    // QR Scan
    scanQRCode: 'QR Kodu Tara',
    
    // Order Queue
    orderQueueManagement: 'Sipariş Sırası Yönetimi',
    
    // User Management
    createUser: 'Kullanıcı Oluştur',
    editUser: 'Kullanıcı Düzenle',
    
    // Field Labels
    emailField: 'E-posta',
    passwordField: 'Şifre',
    roleField: 'Rol',
    fullNameField: 'Ad Soyad',
    
    // Role Options
    adminRole: 'Yönetici',
    seniorManagerRole: 'Üst Düzey Yönetici',
    accountingRole: 'Muhasebe',
    warehouseStaffRole: 'Depo Personeli',
    
    // Permissions
    permissions: 'İzinler',
    
    // Audit Log
    auditLog: 'Denetim Kaydı',
    actionHistory: 'İşlem Geçmişi',
    user: 'Kullanıcı',
    action: 'Eylem',
    timestamp: 'Zaman Damgası',
    description: 'Açıklama',
    entity: 'Varlık',
    identifier: 'Tanımlayıcı',
    reversed: 'Geri Alındı',
    auditActions: 'Eylemler',
    fulfill: 'Tamamla',
    refresh: 'Yenile',
    
    // Audit Detail Keys
    auditOrderNumber: 'Sipariş Numarası:',
    auditCustomer: 'Müşteri:',
    auditLot: 'Lot',
    auditRollsCount: 'top',
    auditTotalRolls: 'Toplam Top:',
    auditLots: 'Lotlar:',
    auditFulfilled: 'Tamamlandı:',
    auditLotNumber: 'Lot Numarası:',
    auditQuality: 'Kalite:',
    auditColor: 'Renk:',
    auditMeters: 'Metre:',
    auditRollCount: 'Top Sayısı:',
    auditLocation: 'Konum:',
    auditSupplier: 'Tedarikçi:',
    auditEntryDate: 'Giriş Tarihi:',
    auditInvoice: 'Fatura:',
    auditRollPosition: 'Top Pozisyonu:',
    auditStatus: 'Durum:',
    auditSupplierName: 'Tedarikçi Adı:',
    auditEmail: 'E-posta:',
    auditName: 'İsim:',
    auditRole: 'Rol:',
    auditActive: 'Aktif',
    auditInactive: 'Pasif',
    detailsNotAvailable: 'Detaylar mevcut değil',
    empty: 'Boş',
    yes: 'Evet',
    no: 'Hayır',
    errorFetchingReversalReason: 'Geri alma nedeni alınamadı',
    loadingReason: 'Neden yükleniyor...',
    reason: 'Neden:',
    noFieldsChanged: 'Hiçbir alan değiştirilmedi',
    failedToLoadAuditLogs: 'Denetim kayıtları yüklenemedi',
    entityType: 'Varlık Tipi',
    performedBy: 'Yapan',
    thisActionWasReversed: 'Bu işlem geri alındı',
    reversedAt: 'Geri Alınma Zamanı:',
    previousState: 'Önceki Durum',
    createdWith: 'Oluşturuldu',
    newState: 'Yeni Durum',
    changesMade: 'Yapılan Değişiklikler',
    viewTechnicalDetails: 'Teknik Detayları Görüntüle',
    oldDataJson: 'Eski Veri (JSON)',
    newDataJson: 'Yeni Veri (JSON)',
    reasonForReversal: 'Geri Alma Nedeni',
    enterReasonForReversal: 'Geri alma nedenini girin...',
    reversing: 'Geri alınıyor...',
    reverseActionButton: 'İşlemi Geri Al',
    
    // Settings
    settings: 'Ayarlar',
    languageSettings: 'Dil Ayarları',
    
    // Actions
    saveChanges: 'Değişiklikleri Kaydet',
    
    // Placeholders
    enterEmail: 'E-posta girin',
    enterPassword: 'Şifre girin',
    enterFullName: 'Ad soyad girin',
    selectRole: 'Rol seçin',
    
    // Validation Messages
    emailRequired: 'E-posta gerekli',
    passwordRequired: 'Şifre gerekli',
    fullNameRequired: 'Ad soyad gerekli',
    roleRequired: 'Rol gerekli',
    
    // Success Messages
    userCreatedSuccessfully: 'Kullanıcı başarıyla oluşturuldu',
    userUpdatedSuccessfully: 'Kullanıcı başarıyla güncellendi',
    
    // Error Messages
    failedToCreateUser: 'Kullanıcı oluşturulamadı',
    failedToUpdateUser: 'Kullanıcı güncellenemedi',
    
    // Confirmation Messages
    confirmDeleteUser: 'Bu kullanıcıyı silmek istediğinizden emin misiniz?',
    
    // Button Labels
    createUserButton: 'Kullanıcı Oluştur',
    updateUserButton: 'Kullanıcı Güncelle',
    deleteUserButton: 'Kullanıcı Sil',
    
    // Table Headers
    idHeader: 'ID',
    emailHeader: 'E-posta',
    fullNameHeader: 'Ad Soyad',
    roleHeader: 'Rol',
    actionsHeader: 'Eylemler',
    
    // Admin Dashboard
    totalUsers: 'Toplam Kullanıcı',
    activeLots: 'Aktif Lotlar',
    pendingOrders: 'Bekleyen Siparişler',
    
    // Admin Dashboard Descriptions
    totalUsersDescription: 'Kayıtlı kullanıcı sayısı',
    activeLotsDescription: 'Sistemdeki aktif lot sayısı',
    pendingOrdersDescription: 'Şu anda bekleyen sipariş sayısı',
    
    // Admin Dashboard Cards
    usersCardTitle: 'Kullanıcılar',
    lotsCardTitle: 'Lotlar',
    ordersCardTitle: 'Siparişler',
    
    // Admin Dashboard Button
    manageUsersButton: 'Kullanıcıları Yönet',
    manageLotsButton: 'Lotları Yönet',
    manageOrdersButton: 'Siparişleri Yönet',
    
    // Admin Dashboard Section Titles
    systemOverview: 'Sistem Genel Bakışı',
    userActivity: 'Kullanıcı Etkinliği',
    
    // Admin Dashboard Placeholders
    noActivityPlaceholder: 'Görüntülenecek kullanıcı etkinliği yok',
    
    // Admin Dashboard Labels
    lastLoginLabel: 'Son Giriş',
    
    // Admin Dashboard Messages
    welcomeAdmin: 'Hoş Geldiniz, Yönetici!',
    
    // Admin Dashboard Tooltips
    viewUserDetailsTooltip: 'Kullanıcı detaylarını görüntüle',
    editUserDetailsTooltip: 'Kullanıcı detaylarını düzenle',
    deleteUserTooltip: 'Kullanıcıyı sil',
    
    // Admin Dashboard Alerts
    userDeletedAlert: 'Kullanıcı başarıyla silindi',
    
    // Admin Dashboard Confirmations
    confirmUserDeletion: 'Bu kullanıcıyı silmek istediğinizden emin misiniz?',
    
    // Admin Dashboard Buttons
    confirmDeleteButton: 'Silmeyi Onayla',
    cancelDeleteButton: 'Silmeyi İptal Et',
    
    // Admin Dashboard Forms
    editUserFormTitle: 'Kullanıcıyı Düzenle',
    createUserFormTitle: 'Kullanıcı Oluştur',
    
    // Admin Dashboard Inputs
    emailInputLabel: 'E-posta',
    passwordInputLabel: 'Şifre',
    fullNameInputLabel: 'Ad Soyad',
    roleSelectLabel: 'Rol',
    
    // Admin Dashboard Select Options
    adminRoleOption: 'Yönetici',
    managerRoleOption: 'Yönetici',
    staffRoleOption: 'Personel',
    
    // Admin Dashboard Buttons
    submitFormButton: 'Gönder',
    cancelFormButton: 'İptal',
    
    // Admin Dashboard Messages
    userCreatedMessage: 'Kullanıcı başarıyla oluşturuldu',
    userUpdatedMessage: 'Kullanıcı başarıyla güncellendi',
    
    // Admin Dashboard Errors
    createUserError: 'Kullanıcı oluşturulamadı',
    updateUserError: 'Kullanıcı güncellenemedi',
    
    // Admin Dashboard Placeholders
    enterEmailPlaceholder: 'E-posta girin',
    enterPasswordPlaceholder: 'Şifre girin',
    enterFullNamePlaceholder: 'Ad soyad girin',
    selectRolePlaceholder: 'Rol seçin',
    
    // Admin Dashboard Validation
    emailValidationMessage: 'Lütfen geçerli bir e-posta girin',
    passwordValidationMessage: 'Şifre en az 6 karakter olmalı',
    fullNameValidationMessage: 'Lütfen adınızı ve soyadınızı girin',
    roleValidationMessage: 'Lütfen bir rol seçin',
    
    // Admin Dashboard Validation
    emailValidationMessageText: 'Lütfen geçerli bir e-posta girin',
    passwordValidationMessageText: 'Şifre en az 6 karakter olmalı',
    fullNameValidationMessageText: 'Lütfen adınızı ve soyadınızı girin',
    roleValidationMessageText: 'Lütfen bir rol seçin',
  },
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<'en' | 'tr'>('en');

  const t = (key: string): string | string[] => {
    const translation = translations[language][key];
    
    // Missing key detection
    if (translation === undefined) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[i18n] Missing translation key:', key);
      }
      return `{{missing:${key}}}`;
    }
    
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
