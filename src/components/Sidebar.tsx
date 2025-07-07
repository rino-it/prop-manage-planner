
import React from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { House, Settings, Calendar, List, TrendingUp, MapPin, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
  const { user, signOut } = useAuth();
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: House },
    { id: 'properties', label: 'Proprietà', icon: MapPin },
    { id: 'expenses', label: 'Spese', icon: TrendingUp },
    { id: 'activities', label: 'Attività', icon: Calendar },
    { id: 'conditions', label: 'Condizioni', icon: List },
    { id: 'plan', label: 'Piano Suggerito', icon: Settings },
  ];

  return (
    <div className="w-64 bg-card border-r border-border shadow-lg flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">Property Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestione Proprietà</p>
        {user && (
          <p className="text-xs text-muted-foreground mt-2 truncate">
            {user.email}
          </p>
        )}
      </div>
      
      <nav className="mt-6 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center px-6 py-3 text-left transition-colors duration-200",
                activeTab === item.id
                  ? "bg-primary/10 text-primary border-r-2 border-primary"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
