import React, { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ViewAsRoleProvider } from "@/contexts/ViewAsRoleContext";
import Layout from "@/components/Layout";
import { POCartProvider } from "./contexts/POCartProvider";
import FloatingPOCart from "./components/FloatingPOCart";
import ErrorBoundary from "./components/ErrorBoundary";
import { RouteWrapper } from "./components/RouteWrapper";
import CookieConsent from "./components/CookieConsent";
import { OfflineBanner } from "./components/ui/network-status-indicator";
import { OfflineProvider } from "./contexts/OfflineContext";
import { Skeleton } from "./components/ui/skeleton";

// Lazy load pages for bundle splitting
// Core pages - loaded immediately
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Inventory module
const Inventory = lazy(() => import("./pages/Inventory"));
const LotIntake = lazy(() => import("./pages/LotIntake"));
const LotQueue = lazy(() => import("./pages/LotQueue"));
const LotDetails = lazy(() => import("./pages/LotDetails"));
const QualityDetails = lazy(() => import("./pages/QualityDetails"));
const IncomingStock = lazy(() => import("./pages/IncomingStock"));
const GoodsReceipt = lazy(() => import("./pages/GoodsReceipt"));
const ManufacturingOrders = lazy(() => import("./pages/ManufacturingOrders"));
const Forecast = lazy(() => import("./pages/Forecast"));
const ForecastSettings = lazy(() => import("./pages/ForecastSettings"));
const Catalog = lazy(() => import("./pages/Catalog"));
const CatalogDetail = lazy(() => import("./pages/CatalogDetail"));

// Orders module
const Orders = lazy(() => import("./pages/Orders"));
const Reservations = lazy(() => import("./pages/Reservations"));
const OrderQueue = lazy(() => import("./pages/OrderQueue"));
const LotSelection = lazy(() => import("./pages/LotSelection"));
const BulkSelection = lazy(() => import("./pages/BulkSelection"));

// Tools module
const QRScan = lazy(() => import("./pages/QRScan"));
const QRPrint = lazy(() => import("./pages/QRPrint"));
const StockTakeCapture = lazy(() => import("./pages/StockTakeCapture"));
const StockTakeReview = lazy(() => import("./pages/StockTakeReview"));
const Approvals = lazy(() => import("./pages/Approvals"));

// Admin & Reports module
const Admin = lazy(() => import("./pages/Admin"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportBuilderPage = lazy(() => import("./pages/ReportBuilder"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const ExtractionTest = lazy(() => import("./pages/ExtractionTest"));

// Auth & Legal pages
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const KVKK = lazy(() => import("./pages/KVKK"));

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
    <Layout>
      <RouteWrapper>
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </RouteWrapper>
    </Layout>
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
                        
                        {/* Orders Module */}
                        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                        <Route path="/reservations" element={<ProtectedRoute><Reservations /></ProtectedRoute>} />
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
                </ViewAsRoleProvider>
              </AuthProvider>
            </BrowserRouter>
          </OfflineProvider>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );

export default App;
