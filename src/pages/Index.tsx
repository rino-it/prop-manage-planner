import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Ban, Clock, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  
  // STATI
  const [activeTab, setActiveTab] = useState("dashboard");
  const [openMobile, setOpenMobile] = useState(false);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // 1. SINCRONIZZA TAB CON URL (Per evidenziare la Sidebar corretta)
  useEffect(() => {
    const path = location.pathname;
    if (path === "/") setActiveTab("dashboard");
    else if (path.includes("/properties")) setActiveTab("properties");
    else if (path.includes("/mobile-properties")) setActiveTab("mobile-properties");
    else if (path.includes("/tickets")) setActiveTab("tickets");
    else if (path.includes("/tenants")) setActiveTab("tenants");
    else if (path.includes("/expenses")) setActiveTab("expenses");
    else if (path.includes("/revenue")) setActiveTab("revenue");
    else if (path.includes("/bookings")) setActiveTab("bookings");
    else if (path.includes("/activities")) setActiveTab("activities");
    else if (path.includes("/team")) setActiveTab("team");
    else if (path.includes("/services")) setActiveTab("services");
  }, [location.pathname]);

  // 2. CONTROLLO STATO UTENTE (Recuperato dal tuo vecchio codice)
  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .maybeSingle(); // Usa maybeSingle per evitare errori se non trova righe

        if (mounted) {
          if (data) setUserStatus(data.status);
          else setUserStatus('active'); // Fallback se non c'è profilo
          setLoadingStatus(false);
        }
      } catch (error) {
        console.error("Err check status", error);
        if (mounted) {
          setUserStatus('active'); // Fallback sicuro
          setLoadingStatus(false);
        }
      }
    };
    checkStatus();
    return () => { mounted = false; };
  }, [user]);

  // --- UI DI BLOCCO (Recuperata dal tuo codice) ---
  
  if (loadingStatus) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Caricamento profilo...</div>;
  }

  if (userStatus === 'suspended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
        <Ban className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-red-700">Account Sospeso</h1>
        <p className="text-red-600 mt-2 max-w-md">Contatta l'amministratore per maggiori informazioni.</p>
        <Button variant="outline" className="mt-6 border-red-200 text-red-700 hover:bg-red-100" onClick={() => signOut()}>
          <LogOut className="w-4 h-4 mr-2"/> Esci
        </Button>
      </div>
    );
  }

  if (userStatus === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-yellow-50 p-4 text-center">
        <Clock className="w-16 h-16 text-yellow-600 mb-4" />
        <h1 className="text-2xl font-bold text-yellow-800">In Attesa di Approvazione</h1>
        <p className="text-yellow-700 mt-2 max-w-md">Il tuo account è stato creato ed è in fase di revisione.</p>
        <Button variant="outline" className="mt-6 border-yellow-300 text-yellow-800 hover:bg-yellow-100" onClick={() => signOut()}>
          <LogOut className="w-4 h-4 mr-2"/> Esci
        </Button>
      </div>
    );
  }

  // --- LAYOUT PRINCIPALE (Con Outlet per le pagine) ---
  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      {/* SIDEBAR DESKTOP */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50">
        <Sidebar activeTab={activeTab} setActiveTab={(tab) => setActiveTab(tab)} />
      </div>

      {/* CONTENUTO PRINCIPALE */}
      <div className="flex-1 flex flex-col md:pl-64 transition-all duration-300">
        
        {/* HEADER MOBILE */}
        <div className="md:hidden flex items-center p-4 bg-white border-b sticky top-0 z-40">
          <Sheet open={openMobile} onOpenChange={setOpenMobile}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar 
                activeTab={activeTab} 
                setActiveTab={(tab) => { setActiveTab(tab); setOpenMobile(false); }} 
                onCloseMobile={() => setOpenMobile(false)}
              />
            </SheetContent>
          </Sheet>
          <h1 className="font-bold text-lg text-slate-800">PropManager</h1>
        </div>

        {/* AREA CONTENUTO DINAMICA */}
        {/* Qui Outlet renderizza la pagina corrente (Dashboard, Tickets, ecc.) */}
        <main className="flex-1 overflow-y-auto">
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default Index;