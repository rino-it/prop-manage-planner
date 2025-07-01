
import React from 'react';
import { cn } from '@/lib/utils';
import { House, Settings, Calendar, List, TrendingUp, MapPin } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: House },
    { id: 'properties', label: 'Proprietà', icon: MapPin },
    { id: 'expenses', label: 'Spese', icon: TrendingUp },
    { id: 'activities', label: 'Attività', icon: Calendar },
    { id: 'conditions', label: 'Condizioni', icon: List },
    { id: 'plan', label: 'Piano Suggerito', icon: Settings },
  ];

  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-gray-800">Property Manager</h1>
        <p className="text-sm text-gray-600 mt-1">Gestione Proprietà</p>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center px-6 py-3 text-left transition-colors duration-200",
                activeTab === item.id
                  ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
