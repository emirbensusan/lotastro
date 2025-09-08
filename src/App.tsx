import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
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
import Suppliers from "./pages/Suppliers";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

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
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
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
              <Route path="/qr-scan" element={
                <ProtectedRoute>
                  <QRScan />
                </ProtectedRoute>
              } />
              <Route path="/qr/:lotNumber" element={<QRScan />} />
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
              <Route path="/admin" element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;