import React, { useState, useEffect } from 'react';
import { Menu, Lock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth'; // Importante
import { supabase } from '@/integrations/supabase/client'; // Importante
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Componenti Pagine
import Bookings from '@/components/Bookings';
import Services from '@/components/Services';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import Properties from '@/components/Properties';
import Revenue from '@/components/Revenue';
import Expenses from '@/components/Expenses';
import Activities from '@/components/Activities';
import TenantManager from '@/components/TenantManager';
import SuggestedPlan from '@/components/SuggestedPlan';
import Team from '@/components/Team';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // STATI PER IL CONTROLLO APPROVAZIONE
  const { user, signOut } = useAuth();
  const [isApproved, setIsApproved] = useState<boolean | null>(null); // null = caricamento

  // CONTROLLO SE L'UTENTE È APPROVATO
  useEffect(() => {
    const checkApproval = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('approved')
        .eq('id', user.id)
        .single();
      
      // Se il campo approved è true, passa. Altrimenti blocca.
      setIsApproved(data?.approved === true);
    };
    checkApproval();
  }, [user]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMobileOpen(false); 
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={setActiveTab} />;
      case 'bookings': return <Bookings />;
      case 'revenue': return <Revenue />;
      case 'services': return <Services />;
      case 'properties': return <Properties />;
      case 'expenses': return <Expenses />;
      case 'activities': return <Activities />;
      case 'tenants': return <TenantManager />;
      case 'team': return <Team />;
      case 'plan': return <SuggestedPlan />;
      default: return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  // --- SCHERMATA DI BLOCCO (SALA D'ATTESA) ---
  if (isApproved === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center shadow-lg border-t-4 border-t-yellow-500">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-yellow-600" />
            </div>
            <CardTitle>Account in Attesa di Approvazione</CardTitle>
            <CardDescription>
              La tua registrazione è avvenuta con successo.
              <br/>
              L'amministratore deve approvare il tuo profilo prima che tu possa accedere ai dati.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-6">Contatta l'amministratore per sbloccare l'accesso.</p>
            <Button variant="outline" onClick={() => signOut()} className="w-full">
              <LogOut className="w-4 h-4 mr-2" /> Torna al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se sta ancora caricando, mostra schermata bianca o loading
  if (isApproved === null) return <div className="min-h-screen bg-white flex items-center justify-center">Caricamento...</div>;

  // --- APP NORMALE (SOLO SE APPROVATO) ---
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block h-screen sticky top-0 border-r bg-white z-10">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

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

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;