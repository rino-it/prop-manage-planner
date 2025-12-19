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

// IMPORT DEI PORTALI ESTERNI
import GuestPortal from "./pages/GuestPortal";
import TenantPortal from "./pages/TenantPortal";

// NUOVI IMPORT AGGIUNTI
import Sidebar from "@/components/Sidebar";
import MobileProperties from "./pages/MobileProperties";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Login Admin */}
            <Route path="/auth" element={<Auth />} />

            {/* --- ROTTE PUBBLICHE (Accessibili con link) --- */}
            
            {/* Portale Turista (Short Term) */}
            <Route path="/guest/:id" element={<GuestPortal />} />
            
            {/* Portale Inquilino (Long Term) */}
            <Route path="/tenant/:id" element={<TenantPortal />} />


            {/* --- ROTTE PROTETTE (Solo Admin loggato) --- */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } 
            />

            {/* Nuova rotta Mobile Properties */}
            <Route
              path="/mobile-properties"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full">
                    {/* Sidebar richiede props obbligatorie. 
                        Impostiamo 'properties' come attivo e una funzione vuota 
                        perché la navigazione qui è gestita dal router, non dallo state della dashboard. */}
                    <Sidebar activeTab="properties" setActiveTab={() => {}} />
                    <main className="flex-1 overflow-y-auto">
                      <MobileProperties />
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />
            
            {/* Pagina 404 per tutto il resto */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;