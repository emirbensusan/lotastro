import React, { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ViewAsRoleProvider } from "@/contexts/ViewAsRoleContext";
import Layout from "@/components/LayoutV2";
import { POCartProvider } from "./contexts/POCartProvider";
import FloatingPOCart from "./components/FloatingPOCart";
import ErrorBoundary from "./components/ErrorBoundary";
import { RouteWrapper } from "./components/RouteWrapper";
import MFAGate from "./components/auth/MFAGate";
import CookieConsent from "./components/CookieConsent";
import { OfflineBanner } from "./components/ui/network-status-indicator";
import { OfflineProvider } from "./contexts/OfflineContext";
// TourProvider removed for debugging
import { Skeleton } from "./components/ui/skeleton";
import { lazyWithRetry } from "./lib/lazyWithRetry";

// Core pages - loaded immediately (no lazy loading)
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Inventory module - with retry logic for HMR stability
const Inventory = lazyWithRetry(() => import("./pages/Inventory"));
const LotIntake = lazyWithRetry(() => import("./pages/LotIntake"));
const LotQueue = lazyWithRetry(() => import("./pages/LotQueue"));
const LotDetails = lazyWithRetry(() => import("./pages/LotDetails"));
const QualityDetails = lazyWithRetry(() => import("./pages/QualityDetails"));
const IncomingStock = lazyWithRetry(() => import("./pages/IncomingStock"));
const GoodsReceipt = lazyWithRetry(() => import("./pages/GoodsReceipt"));
const ManufacturingOrders = lazyWithRetry(() => import("./pages/ManufacturingOrders"));
const Forecast = lazyWithRetry(() => import("./pages/Forecast"));
const ForecastSettings = lazyWithRetry(() => import("./pages/ForecastSettings"));
const Catalog = lazyWithRetry(() => import("./pages/Catalog"));
const CatalogDetail = lazyWithRetry(() => import("./pages/CatalogDetail"));
const InventoryTransactions = lazyWithRetry(() => import("./pages/InventoryTransactions"));

// Orders module
const Orders = lazyWithRetry(() => import("./pages/Orders"));
const Reservations = lazyWithRetry(() => import("./pages/Reservations"));
const Inquiries = lazyWithRetry(() => import("./pages/Inquiries"));
const OrderQueue = lazyWithRetry(() => import("./pages/OrderQueue"));
const LotSelection = lazyWithRetry(() => import("./pages/LotSelection"));
const BulkSelection = lazyWithRetry(() => import("./pages/BulkSelection"));

// Tools module
const QRScan = lazyWithRetry(() => import("./pages/QRScan"));
const QRPrint = lazyWithRetry(() => import("./pages/QRPrint"));
const StockTakeCapture = lazyWithRetry(() => import("./pages/StockTakeCapture"));
const StockTakeReview = lazyWithRetry(() => import("./pages/StockTakeReview"));
const Approvals = lazyWithRetry(() => import("./pages/Approvals"));

// Admin & Reports module
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const ReportBuilderPage = lazyWithRetry(() => import("./pages/ReportBuilder"));
const AuditLogs = lazyWithRetry(() => import("./pages/AuditLogs"));
const Suppliers = lazyWithRetry(() => import("./pages/Suppliers"));
const ApiDocs = lazyWithRetry(() => import("./pages/ApiDocs"));
const ExtractionTest = lazyWithRetry(() => import("./pages/ExtractionTest"));

// Auth & Legal pages
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const InviteAccept = lazyWithRetry(() => import("./pages/InviteAccept"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Cookies = lazyWithRetry(() => import("./pages/Cookies"));
const KVKK = lazyWithRetry(() => import("./pages/KVKK"));

// Page loading fallback
const PageLoader = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-4 w-48" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
    <Skeleton className="h-64 mt-6" />
  </div>
);

// Configure QueryClient with retry logic for failed queries
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (except 429)
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (message.includes('401') || message.includes('403') || message.includes('404')) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Protected Route Component with Error Boundary
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, mfaRequired, mfaVerified } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If MFA is required but not verified, redirect to auth for MFA completion
  if (mfaRequired && !mfaVerified) {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <MFAGate>
      <Layout>
        <RouteWrapper>
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </RouteWrapper>
      </Layout>
    </MFAGate>
  );
};

// Public route with suspense
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <OfflineProvider>
          <Toaster />
          <Sonner />
          <OfflineBanner />
          <BrowserRouter>
            <AuthProvider>
              <ViewAsRoleProvider>
                <PermissionsProvider>
                  <POCartProvider>
                    <ErrorBoundary>
                      <Routes>
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
                        <Route path="/invite" element={<PublicRoute><InviteAccept /></PublicRoute>} />
                        <Route path="/admin/extraction-test" element={<PublicRoute><ExtractionTest /></PublicRoute>} />
                        
                        {/* Dashboard */}
                        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                        
                        {/* Inventory Module */}
                        <Route path="/lot-intake" element={<ProtectedRoute><LotIntake /></ProtectedRoute>} />
                        <Route path="/lot-queue" element={<ProtectedRoute><LotQueue /></ProtectedRoute>} />
                        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                        <Route path="/inventory/:quality/:color" element={<ProtectedRoute><LotDetails /></ProtectedRoute>} />
                        <Route path="/inventory/:quality" element={<ProtectedRoute><QualityDetails /></ProtectedRoute>} />
                        <Route path="/incoming-stock" element={<ProtectedRoute><IncomingStock /></ProtectedRoute>} />
                        <Route path="/goods-receipt" element={<ProtectedRoute><GoodsReceipt /></ProtectedRoute>} />
                        <Route path="/manufacturing-orders" element={<ProtectedRoute><ManufacturingOrders /></ProtectedRoute>} />
                        <Route path="/forecast" element={<ProtectedRoute><Forecast /></ProtectedRoute>} />
                        <Route path="/forecast-settings" element={<ProtectedRoute><ForecastSettings /></ProtectedRoute>} />
                        <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
                        <Route path="/catalog/:id" element={<ProtectedRoute><CatalogDetail /></ProtectedRoute>} />
                        <Route path="/inventory-transactions" element={<ProtectedRoute><InventoryTransactions /></ProtectedRoute>} />
                        
                        {/* Orders Module */}
                        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                        <Route path="/reservations" element={<ProtectedRoute><Reservations /></ProtectedRoute>} />
                        <Route path="/inquiries" element={<ProtectedRoute><Inquiries /></ProtectedRoute>} />
                        <Route path="/order-queue" element={<ProtectedRoute><OrderQueue /></ProtectedRoute>} />
                        <Route path="/lot-selection" element={<ProtectedRoute><LotSelection /></ProtectedRoute>} />
                        <Route path="/bulk-selection" element={<ProtectedRoute><BulkSelection /></ProtectedRoute>} />
                        
                        {/* Tools Module */}
                        <Route path="/qr-scan" element={<ProtectedRoute><QRScan /></ProtectedRoute>} />
                        <Route path="/qr/:lotNumber" element={<PublicRoute><QRScan /></PublicRoute>} />
                        <Route path="/print/qr/:lotNumber" element={<PublicRoute><QRPrint /></PublicRoute>} />
                        <Route path="/stock-take" element={<ProtectedRoute><StockTakeCapture /></ProtectedRoute>} />
                        <Route path="/stock-take-review" element={<ProtectedRoute><StockTakeReview /></ProtectedRoute>} />
                        <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
                        
                        {/* Admin & Reports Module */}
                        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                        <Route path="/reports/builder" element={<ProtectedRoute><ReportBuilderPage /></ProtectedRoute>} />
                        <Route path="/reports/builder/:id" element={<ProtectedRoute><ReportBuilderPage /></ProtectedRoute>} />
                        <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
                        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                        <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
                        <Route path="/api-docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
                        
                        {/* Legal Pages - Public Access */}
                        <Route path="/terms" element={<PublicRoute><Terms /></PublicRoute>} />
                        <Route path="/privacy" element={<PublicRoute><Privacy /></PublicRoute>} />
                        <Route path="/cookies" element={<PublicRoute><Cookies /></PublicRoute>} />
                        <Route path="/kvkk" element={<PublicRoute><KVKK /></PublicRoute>} />
                        
                        {/* Catch-all */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                      <FloatingPOCart />
                      <CookieConsent />
                    </ErrorBoundary>
                  </POCartProvider>
                </PermissionsProvider>
              </ViewAsRoleProvider>
              </AuthProvider>
            </BrowserRouter>
          </OfflineProvider>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );

export default App;
