import React, { useState, useEffect } from 'react';
import { Menu, LogOut, Ban, Clock } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

// Componenti Layout
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell'; 

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Sincronizza Tab Attiva con URL
  useEffect(() => {
    const path = location.pathname;
    if (path === "/") setActiveTab("dashboard");
    else if (path.includes("properties") && !path.includes("mobile")) setActiveTab("properties");
    else if (path.includes("mobile-properties")) setActiveTab("mobile-properties");
    else if (path.includes("tickets")) setActiveTab("tickets");
    else if (path.includes("tenants")) setActiveTab("tenants");
    else if (path.includes("expenses")) setActiveTab("expenses");
    else if (path.includes("revenue")) setActiveTab("revenue");
    else if (path.includes("bookings")) setActiveTab("bookings");
    else if (path.includes("activities")) setActiveTab("activities");
    else if (path.includes("team")) setActiveTab("team");
    else if (path.includes("services")) setActiveTab("services");
  }, [location.pathname]);

  // Controllo Stato Utente
  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .maybeSingle();
        
        if (mounted) setUserStatus(data?.status || 'active');
      } catch (error) {
        if (mounted) setUserStatus('active');
      }
    };
    checkStatus();
    return () => { mounted = false; };
  }, [user]);

  // UI di Blocco (Sospeso / Pending)
  if (userStatus === 'suspended') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
      <Ban className="w-16 h-16 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-red-700">Account Sospeso</h1>
      <Button variant="outline" className="mt-6 border-red-200 text-red-700" onClick={() => signOut()}><LogOut className="w-4 h-4 mr-2"/> Esci</Button>
    </div>
  );

  if (userStatus === 'pending') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-yellow-50 p-4 text-center">
      <Clock className="w-16 h-16 text-yellow-600 mb-4" />
      <h1 className="text-2xl font-bold text-yellow-800">In Revisione</h1>
      <Button variant="outline" className="mt-6 border-yellow-300 text-yellow-800" onClick={() => signOut()}><LogOut className="w-4 h-4 mr-2"/> Esci</Button>
    </div>
  );

  if (userStatus === null) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Caricamento profilo...</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Desktop */}
      <div className="hidden md:block h-screen sticky top-0 border-r bg-white z-10 w-64">
        <Sidebar activeTab={activeTab} setActiveTab={(tab) => navigate(tab === 'dashboard' ? '/' : `/${tab}`)} />
      </div>

      {/* Layout Mobile + Contenuto */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER SUPERIORE */}
        <div className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm h-16">
          <div className="flex items-center gap-2">
            <div className="md:hidden">
              <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetTrigger asChild><Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button></SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                  <Sidebar activeTab={activeTab} setActiveTab={(tab) => { navigate(tab === 'dashboard' ? '/' : `/${tab}`); setIsMobileOpen(false); }} onCloseMobile={() => setIsMobileOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>
            {/* Logo Mobile */}
            <img src="/logo.png" alt="PropManager" className="h-8 w-auto object-contain md:hidden" />
            
            {/* FIX: Titolo ora visibile su mobile con responsive text e truncate */}
            <h1 className="text-sm md:text-lg font-bold text-slate-700 capitalize truncate max-w-[140px] sm:max-w-none">
               {activeTab === 'dashboard' ? 'Dashboard' : activeTab.replace('-', ' ')}
            </h1>
          </div>

          {/* AREA NOTIFICHE E UTENTE */}
          <div className="flex items-center gap-2">
             <NotificationBell />
          </div>
        </div>
        
        {/* Area Contenuto */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Index;