import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMobileOpen(false); 
  };

  const renderContent = () => {
    switch (activeTab) {
      // Passiamo la funzione setActiveTab alla Dashboard
      case 'dashboard': return <Dashboard setActiveTab={handleTabChange} />;
      case 'bookings': return <Bookings />;
      case 'revenue': return <Revenue />;
      case 'services': return <Services />;
      case 'properties': return <Properties />;
      case 'expenses': return <Expenses />;
      case 'activities': return <Activities />;
      case 'tenants': return <TenantManager />;
      case 'plan': return <SuggestedPlan />;
      default: return <Dashboard setActiveTab={handleTabChange} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* SIDEBAR DESKTOP */}
      <div className="hidden md:block h-screen sticky top-0 border-r bg-white z-10 shadow-sm">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* CONTENUTO PRINCIPALE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER MOBILE */}
        <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          {/* LOGO MOBILE */}
          <div className="flex items-center gap-2">
             <img src="/logo.png" alt="PropManager" className="h-8 w-auto object-contain" />
          </div>
          
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              {/* BOTTONE MENU MIGLIORATO */}
              <Button variant="outline" size="sm" className="flex items-center gap-2 text-gray-700 border-gray-300 hover:bg-gray-50">
                <Menu className="h-5 w-5" />
                <span className="font-medium">MENU</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} onCloseMobile={() => setIsMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        {/* AREA DI LAVORO */}
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