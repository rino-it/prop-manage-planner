import React, { useState, useEffect } from 'react';
import { Menu, LogOut, Ban, Clock } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Componenti Importati
import Bookings from '@/components/Bookings';
import Services from '@/components/Services';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import Properties from '@/components/Properties';
import Revenue from '@/components/Revenue';
import Expenses from '@/pages/Expenses'; 
import Activities from '@/components/Activities';
import TenantManager from '@/components/TenantManager';
import SuggestedPlan from '@/components/SuggestedPlan';
import Team from '@/components/Team';
import MobileProperties from '@/pages/MobileProperties'; // Import Parco Mezzi

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [userStatus, setUserStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      if (!user) return;
      try {
        // Usa maybeSingle per non generare errori se la riga non esiste
        const { data, error } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .maybeSingle();
        
        if (mounted) {
          // Se c'è errore o nessun dato, sblocca comunque l'app come 'active' (Fallback Sicuro)
          // Questo impedisce il caricamento infinito
          setUserStatus(data?.status || 'active'); 
        }
      } catch (e) {
        console.error("Errore check status:", e);
        if (mounted) setUserStatus('active'); // Sblocca in caso di crash
      }
    };
    checkStatus();
    return () => { mounted = false; };
  }, [user]);

  const handleTabChange = (tab: string) => { setActiveTab(tab); setIsMobileOpen(false); };

  // Router interno della Dashboard
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={setActiveTab} />;
      case 'bookings': return <Bookings />;
      case 'revenue': return <Revenue />;
      case 'services': return <Services />;
      case 'properties': return <Properties />;
      case 'expenses': return <Expenses />;
      case 'mobile-properties': return <MobileProperties />;
      case 'activities': return <Activities />;
      case 'tenants': return <TenantManager />;
      case 'team': return <Team />;
      case 'plan': return <SuggestedPlan />;
      default: return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  // UI per stato Pending
  if (userStatus === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-lg text-center border-t-4 border-yellow-500">
          <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4"><Clock className="w-6 h-6 text-yellow-600" /></div>
          <h2 className="text-xl font-bold mb-2">Account in Attesa</h2>
          <p className="text-gray-600 mb-6">Un amministratore deve approvare il tuo accesso.</p>
          <Button variant="outline" onClick={() => signOut()} className="w-full"><LogOut className="w-4 h-4 mr-2" /> Logout</Button>
        </div>
      </div>
    );
  }

  // UI per stato Rejected
  if (userStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-lg text-center border-t-4 border-red-600">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4"><Ban className="w-6 h-6 text-red-600" /></div>
          <h2 className="text-xl font-bold text-red-700 mb-2">Accesso Negato</h2>
          <Button variant="destructive" onClick={() => signOut()} className="w-full mt-4">Logout</Button>
        </div>
      </div>
    );
  }

  // Loader iniziale (Se vedi questo per più di 2 secondi, il fallback 'active' sopra non ha funzionato)
  if (userStatus === null) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Caricamento profilo...</div>;

  // UI Principale
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Desktop */}
      <div className="hidden md:block h-screen sticky top-0 border-r bg-white z-10">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Layout Mobile + Contenuto */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <img src="/logo.png" alt="PropManager" className="h-8 w-auto object-contain" />
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button></SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} onCloseMobile={() => setIsMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Area Contenuto */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;