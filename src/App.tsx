import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Pagine e Componenti
import Dashboard from "./components/Dashboard";
import Properties from "./components/Properties";
import Tenants from "./components/TenantManager";
import Expenses from "./pages/Expenses";
import MobileProperties from "./pages/MobileProperties";
import Tickets from "./pages/Tickets"; 

// Portali
import GuestPortal from "./pages/GuestPortal";
import TenantPortal from "./pages/TenantPortal";
import Team from "./components/Team";
import Services from "./components/Services";
import Activities from "./components/Activities";
import Revenue from "./components/Revenue";
import Bookings from "./components/Bookings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      
      {/* 1. ROUTER È IL CONTENITORE ESTERNO */}
      <BrowserRouter>
        
        {/* 2. AUTH PROVIDER DENTRO IL ROUTER */}
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            
            <Route path="/guest/:id" element={<GuestPortal />} />
            <Route path="/tenant/:id" element={<TenantPortal />} />

            {/* 3. LAYOUT PRINCIPALE GESTITO DA INDEX */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            >
              {/* 4. LE PAGINE VENGONO CARICATE DENTRO INDEX (OUTLET) */}
              <Route index element={<DashboardWrapper />} />
              <Route path="properties" element={<Properties />} />
              <Route path="mobile-properties" element={<MobileProperties />} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="tenants" element={<Tenants />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="revenue" element={<Revenue />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="activities" element={<Activities />} />
              <Route path="team" element={<Team />} />
              <Route path="services" element={<Services />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

// Helper per passare la navigazione alla Dashboard
function DashboardWrapper() {
  const navigate = useNavigate();
  return <Dashboard onNavigate={(path) => navigate(`/${path}`)} />;
}

export default App;