import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ViewAsRoleProvider } from "@/contexts/ViewAsRoleContext";
import Layout from "@/components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import LotIntake from "./pages/LotIntake";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import Reservations from "./pages/Reservations";
import LotSelection from "./pages/LotSelection";
import LotQueue from "./pages/LotQueue";
import QRScan from "./pages/QRScan";
import Reports from "./pages/Reports";
import ReportBuilderPage from "./pages/ReportBuilder";
import Admin from "./pages/Admin";
import Approvals from "./pages/Approvals";
import AuditLogs from "./pages/AuditLogs";
import Suppliers from "./pages/Suppliers";
import ExtractionTest from "./pages/ExtractionTest";
import IncomingStock from "./pages/IncomingStock";
import GoodsReceipt from "./pages/GoodsReceipt";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import QRPrint from "./pages/QRPrint";
import OrderQueue from "./pages/OrderQueue";
import BulkSelection from "./pages/BulkSelection";
import QualityDetails from "./pages/QualityDetails";
import LotDetails from "./pages/LotDetails";
import InviteAccept from "./pages/InviteAccept";
import ManufacturingOrders from "./pages/ManufacturingOrders";
import Forecast from "./pages/Forecast";
import ForecastSettings from "./pages/ForecastSettings";
import Catalog from "./pages/Catalog";
import CatalogDetail from "./pages/CatalogDetail";
import StockTakeCapture from "./pages/StockTakeCapture";
import StockTakeReview from "./pages/StockTakeReview";
import ApiDocs from "./pages/ApiDocs";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import KVKK from "./pages/KVKK";
import { POCartProvider } from "./contexts/POCartProvider";
import FloatingPOCart from "./components/FloatingPOCart";
import ErrorBoundary from "./components/ErrorBoundary";
import { RouteWrapper } from "./components/RouteWrapper";
import CookieConsent from "./components/CookieConsent";

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
  const { user, loading } = useAuth();
  
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
  
  return (
    <Layout>
      <RouteWrapper>
        {children}
      </RouteWrapper>
    </Layout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ViewAsRoleProvider>
              <POCartProvider>
                <ErrorBoundary>
            <Routes>
              <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/invite" element={<InviteAccept />} />
              <Route path="/admin/extraction-test" element={<ExtractionTest />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/lot-intake" element={
                <ProtectedRoute>
                  <LotIntake />
                </ProtectedRoute>
              } />
              <Route path="/inventory" element={
                <ProtectedRoute>
                  <Inventory />
                </ProtectedRoute>
              } />
              <Route path="/inventory/:quality/:color" element={
                <ProtectedRoute>
                  <LotDetails />
                </ProtectedRoute>
              } />
              <Route path="/inventory/:quality" element={
                <ProtectedRoute>
                  <QualityDetails />
                </ProtectedRoute>
              } />
              <Route path="/bulk-selection" element={
                <ProtectedRoute>
                  <BulkSelection />
                </ProtectedRoute>
              } />
              <Route path="/orders" element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              } />
              <Route path="/reservations" element={
                <ProtectedRoute>
                  <Reservations />
                </ProtectedRoute>
              } />
              <Route path="/lot-selection" element={
                <ProtectedRoute>
                  <LotSelection />
                </ProtectedRoute>
              } />
              <Route path="/lot-queue" element={
                <ProtectedRoute>
                  <LotQueue />
                </ProtectedRoute>
              } />
              <Route path="/order-queue" element={
                <ProtectedRoute>
                  <OrderQueue />
                </ProtectedRoute>
              } />
              <Route path="/qr-scan" element={
                <ProtectedRoute>
                  <QRScan />
                </ProtectedRoute>
              } />
              <Route path="/qr/:lotNumber" element={<QRScan />} />
              <Route path="/print/qr/:lotNumber" element={<QRPrint />} />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/reports/builder" element={
                <ProtectedRoute>
                  <ReportBuilderPage />
                </ProtectedRoute>
              } />
              <Route path="/reports/builder/:id" element={
                <ProtectedRoute>
                  <ReportBuilderPage />
                </ProtectedRoute>
              } />
              <Route path="/suppliers" element={
                <ProtectedRoute>
                  <Suppliers />
                </ProtectedRoute>
              } />
              <Route path="/incoming-stock" element={
                <ProtectedRoute>
                  <IncomingStock />
                </ProtectedRoute>
              } />
              <Route path="/manufacturing-orders" element={
                <ProtectedRoute>
                  <ManufacturingOrders />
                </ProtectedRoute>
              } />
              <Route path="/forecast" element={
                <ProtectedRoute>
                  <Forecast />
                </ProtectedRoute>
              } />
              <Route path="/forecast-settings" element={
                <ProtectedRoute>
                  <ForecastSettings />
                </ProtectedRoute>
              } />
              <Route path="/catalog" element={
                <ProtectedRoute>
                  <Catalog />
                </ProtectedRoute>
              } />
              <Route path="/catalog/:id" element={
                <ProtectedRoute>
                  <CatalogDetail />
                </ProtectedRoute>
              } />
              <Route path="/goods-receipt" element={
                <ProtectedRoute>
                  <GoodsReceipt />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } />
              <Route path="/approvals" element={
                <ProtectedRoute>
                  <Approvals />
                </ProtectedRoute>
              } />
              <Route path="/audit-logs" element={
                <ProtectedRoute>
                  <AuditLogs />
                </ProtectedRoute>
              } />
              <Route path="/stock-take" element={
                <ProtectedRoute>
                  <StockTakeCapture />
                </ProtectedRoute>
              } />
              <Route path="/stock-take-review" element={
                <ProtectedRoute>
                  <StockTakeReview />
                </ProtectedRoute>
              } />
              {/* API Documentation - Protected */}
              <Route path="/api-docs" element={
                <ProtectedRoute>
                  <ApiDocs />
                </ProtectedRoute>
              } />
              {/* Legal Pages - Public Access */}
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/cookies" element={<Cookies />} />
              <Route path="/kvkk" element={<KVKK />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <FloatingPOCart />
            <CookieConsent />
                </ErrorBoundary>
              </POCartProvider>
            </ViewAsRoleProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;