import React from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { House, Settings, Calendar, TrendingUp, MapPin, LogOut, Users, Sparkles, DollarSign, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  onCloseMobile?: () => void;
}

const Sidebar = ({ activeTab, setActiveTab, onCloseMobile }: SidebarProps) => {
  const { user, signOut } = useAuth();
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: House },
    { id: 'bookings', label: 'Prenotazioni', icon: Calendar },
    { id: 'tenants', label: 'Inquilini', icon: Users },
    { id: 'revenue', label: 'Incassi', icon: DollarSign },
    { id: 'expenses', label: 'Spese', icon: TrendingUp },
    { id: 'services', label: 'Servizi Extra', icon: Sparkles },
    { id: 'properties', label: 'Proprietà', icon: MapPin },
    { id: 'activities', label: 'Attività', icon: ClipboardList },
    { id: 'plan', label: 'Piano Suggerito', icon: Settings },
  ];

  const handleNavigation = (id: string) => {
    if (setActiveTab) setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <div className="w-full md:w-64 bg-white md:bg-card border-r border-border shadow-lg flex flex-col h-full">
      
      {/* HEADER LOGO (MODIFICATO) */}
      <div className="p-6 border-b border-border flex justify-center items-center">
        {/* Se il logo non carica, mostrerà il testo alternativo */}
        <img 
          src="/logo.png" 
          alt="PropManager" 
          className="h-12 w-auto object-contain" 
        />
      </div>
      
      <nav className="mt-6 flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={cn(
                "w-full flex items-center px-6 py-3 text-left transition-all duration-200",
                isActive
                  ? "bg-blue-50 text-blue-600 border-r-4 border-blue-600 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className={cn("w-5 h-5 mr-3", isActive ? "text-blue-600" : "text-gray-400")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="mb-4 px-2">
            {user && (
              <p className="text-xs text-muted-foreground truncate bg-gray-100 p-2 rounded text-center">
                {user.email}
              </p>
            )}
        </div>
        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Esci
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;