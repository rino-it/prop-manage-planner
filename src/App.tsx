import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom"; // REMOVED: Navigate
import Index from "./pages/Index";
import Properties from "./components/Properties";
import Tenants from "./components/TenantManager";
import Expenses from "./pages/Expenses";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import MobileProperties from "./pages/MobileProperties";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          {/* DASHBOARD */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full bg-muted/40">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto">
                    <Index />
                  </main>
                </div>
              </ProtectedRoute>
            }
          />

          {/* PROPERTIES */}
          <Route
            path="/properties"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full bg-muted/40">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto">
                    <Properties />
                  </main>
                </div>
              </ProtectedRoute>
            }
          />

          {/* TENANTS */}
          <Route
            path="/tenants"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full bg-muted/40">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto">
                    <Tenants />
                  </main>
                </div>
              </ProtectedRoute>
            }
          />

          {/* EXPENSES */}
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full bg-muted/40">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto">
                    <Expenses />
                  </main>
                </div>
              </ProtectedRoute>
            }
          />

          {/* MOBILE PROPERTIES (PARCO MEZZI) */}
          <Route
            path="/mobile-properties"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full bg-muted/40">
                  <Sidebar />
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
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;