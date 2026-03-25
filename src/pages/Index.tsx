import React, { useState, useEffect } from 'react';
import { Menu, LogOut, Ban, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

import Sidebar from '@/components/Sidebar';
import AdminNotificationBell from '@/components/AdminNotificationBell';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    if (path === "/") setActiveTab("dashboard");
    else if (path.includes("calendario")) setActiveTab("calendario");
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
    else if (path.includes("accoglienza")) setActiveTab("accoglienza");
    else if (path.includes("comunicazione")) setActiveTab("comunicazione");
    else if (path.includes("messaggi")) setActiveTab("messaggi");
    else if (path.includes("portali")) setActiveTab("portali");
    else if (path.includes("marketplace")) setActiveTab("marketplace");
    else if (path.includes("prezzi")) setActiveTab("prezzi");
    else if (path.includes("statistiche")) setActiveTab("statistiche");
  }, [location.pathname]);

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

  if (userStatus === null) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Caricamento profilo...</div>;

  return (
    <div className="flex min-h-screen bg-background w-full overflow-x-hidden">
      <div className="hidden md:block h-screen sticky top-0 z-10 w-60 flex-shrink-0">
        <Sidebar activeTab={activeTab} setActiveTab={(tab) => navigate(tab === 'dashboard' ? '/' : `/${tab}`)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="bg-card border-b border-border px-4 flex items-center justify-between sticky top-0 z-30 h-14 md:hidden">
          <div className="flex items-center gap-2">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9"><Menu className="h-5 w-5" /></Button></SheetTrigger>
              <SheetContent side="left" className="p-0 w-60">
                <Sidebar activeTab={activeTab} setActiveTab={(tab) => { navigate(tab === 'dashboard' ? '/' : `/${tab}`); setIsMobileOpen(false); }} onCloseMobile={() => setIsMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <img src="/prop-manager-logo.svg" alt="PropManager" className="h-7 w-7" />
            <span className="font-bold text-sm text-foreground">PropManager</span>
          </div>
          <AdminNotificationBell />
        </div>

        <div className="hidden md:flex bg-card border-b border-border px-6 items-center justify-end h-12">
          <AdminNotificationBell />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Index;