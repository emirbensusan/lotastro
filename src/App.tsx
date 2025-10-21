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
import LotSelection from "./pages/LotSelection";
import LotQueue from "./pages/LotQueue";
import QRScan from "./pages/QRScan";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import Approvals from "./pages/Approvals";
import AuditLogs from "./pages/AuditLogs";
import Suppliers from "./pages/Suppliers";
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
import { POCartProvider } from "./contexts/POCartProvider";
import FloatingPOCart from "./components/FloatingPOCart";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

// Protected Route Component
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
  
  return <Layout>{children}</Layout>;
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
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <FloatingPOCart />
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