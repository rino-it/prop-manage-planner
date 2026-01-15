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
import Tickets from "./pages/Tickets"; // <--- NUOVO IMPORT

// Portali
import GuestPortal from "./pages/GuestPortal";
import TenantPortal from "./pages/TenantPortal";
import Team from "./components/Team";
import Services from "./components/Services";
import Activities from "./components/Activities";
import Revenue from "./components/Revenue";
import Bookings from "./components/Bookings";
import Dashboard from "./components/Dashboard";

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

            {/* 1. DASHBOARD */}
            <Route path="/" element={<Index />}>
               <Route index element={<Dashboard onNavigate={(tab) => console.log(tab)} />} />
               {/* Altre rotte interne a Index se necessario */}
            </Route>

            {/* 2. GESTIONE PROPRIETÀ */}
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

            {/* 4. NUOVA ROTTA: TICKET & GUASTI */}
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full bg-slate-50">
                    <Sidebar activeTab="tickets" setActiveTab={() => {}} />
                    <main className="flex-1 overflow-y-auto">
                      <Tickets />
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />

            {/* 5. SPESE */}
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

            {/* 6. PARCO MEZZI */}
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

            {/* ALTRE PAGINE (Standardizzate col Layout) */}
            <Route path="/revenue" element={<ProtectedRoute><div className="flex min-h-screen w-full bg-slate-50"><Sidebar activeTab="revenue" setActiveTab={() => {}} /><main className="flex-1 overflow-y-auto"><Revenue /></main></div></ProtectedRoute>} />
            <Route path="/activities" element={<ProtectedRoute><div className="flex min-h-screen w-full bg-slate-50"><Sidebar activeTab="activities" setActiveTab={() => {}} /><main className="flex-1 overflow-y-auto"><Activities /></main></div></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><div className="flex min-h-screen w-full bg-slate-50"><Sidebar activeTab="team" setActiveTab={() => {}} /><main className="flex-1 overflow-y-auto"><Team /></main></div></ProtectedRoute>} />
            <Route path="/services" element={<ProtectedRoute><div className="flex min-h-screen w-full bg-slate-50"><Sidebar activeTab="services" setActiveTab={() => {}} /><main className="flex-1 overflow-y-auto"><Services /></main></div></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute><div className="flex min-h-screen w-full bg-slate-50"><Sidebar activeTab="bookings" setActiveTab={() => {}} /><main className="flex-1 overflow-y-auto"><Bookings /></main></div></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;