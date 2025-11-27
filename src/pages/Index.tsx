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
import TenantManager from '@/components/TenantManager'; // <--- IMPORTATO
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
      case 'dashboard': return <Dashboard />;
      case 'bookings': return <Bookings />;
      case 'revenue': return <Revenue />;
      case 'services': return <Services />;
      case 'properties': return <Properties />;
      case 'expenses': return <Expenses />;
      case 'activities': return <Activities />;
      case 'tenants': return <TenantManager />; // <--- NUOVO CASO
      case 'plan': return <SuggestedPlan />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* SIDEBAR DESKTOP */}
      <div className="hidden md:block h-screen sticky top-0 border-r bg-white z-10">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* CONTENUTO PRINCIPALE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER MOBILE */}
        <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <span className="font-bold text-lg text-gray-900">PropManager</span>
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
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