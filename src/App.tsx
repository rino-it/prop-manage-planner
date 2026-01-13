import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Sidebar from "./components/Sidebar";

// Pagine e Componenti
import Properties from "./components/Properties";
import Tenants from "./components/TenantManager";
import Expenses from "./pages/Expenses";
import MobileProperties from "./pages/MobileProperties";

// Portali
import GuestPortal from "./pages/GuestPortal";
import TenantPortal from "./pages/TenantPortal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            
            {/* Portali Pubblici */}
            <Route path="/guest/:id" element={<GuestPortal />} />
            <Route path="/tenant/:id" element={<TenantPortal />} />

            {/* --- ROTTE PROTETTE --- */}

            {/* 1. DASHBOARD: Nessun layout esterno, Index gestisce tutto */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } 
            />

            {/* 2. PROPRIETÀ: Layout con Sidebar funzionante */}
            <Route
              path="/properties"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full bg-slate-50">
                    <Sidebar activeTab="properties" setActiveTab={() => {}} />
                    <main className="flex-1 overflow-y-auto">
                      <Properties />
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />

            {/* 3. INQUILINI */}
            <Route
              path="/tenants"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full bg-slate-50">
                    <Sidebar activeTab="tenants" setActiveTab={() => {}} />
                    <main className="flex-1 overflow-y-auto">
                      <Tenants />
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />

            {/* 4. SPESE */}
            <Route
              path="/expenses"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full bg-slate-50">
                    <Sidebar activeTab="expenses" setActiveTab={() => {}} />
                    <main className="flex-1 overflow-y-auto">
                      <Expenses />
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />

            {/* 5. PARCO MEZZI */}
            <Route
              path="/mobile-properties"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full bg-slate-50">
                    <Sidebar activeTab="mobile-properties" setActiveTab={() => {}} />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6">
                      <MobileProperties />
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;