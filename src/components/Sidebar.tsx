import React from 'react';
import { LayoutDashboard, CalendarDays, Wallet, Banknote, Wrench, Settings, LogOut, FileText, UserPlus, FolderOpen, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onCloseMobile?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onCloseMobile }: SidebarProps) {
  const { signOut } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-600' },
    { id: 'bookings', label: 'Prenotazioni', icon: CalendarDays, color: 'text-purple-600' },
    { id: 'tenants', label: 'Inquilini', icon: UserPlus, color: 'text-cyan-600' },
    { id: 'revenue', label: 'Incassi', icon: Wallet, color: 'text-green-600' },
    { id: 'expenses', label: 'Spese', icon: Banknote, color: 'text-red-600' },
    { id: 'properties', label: 'Proprietà', icon: FolderOpen, color: 'text-orange-600' },
    { id: 'activities', label: 'Attività', icon: Wrench, color: 'text-amber-600' },
    { id: 'services', label: 'Servizi', icon: FileText, color: 'text-pink-600' },
    { id: 'team', label: 'Gestione Team', icon: Users, color: 'text-indigo-600' }, // NUOVA VOCE AGGIUNTA
    { id: 'plan', label: 'Piano Suggerito', icon: Settings, color: 'text-gray-600' },
  ];

  const handleNavigation = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <div className="flex h-full flex-col bg-white border-r w-64">
      {/* HEADER LOGO */}
      <div className="p-6 flex items-center justify-center border-b">
        <img src="/logo.png" alt="PropManager" className="h-10 w-auto object-contain" />
      </div>

      {/* MENU SCROLLABILE */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group",
                  isActive 
                    ? "bg-slate-100 text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isActive ? "bg-white shadow-sm" : "bg-slate-100 group-hover:bg-white"
                )}>
                  <Icon className={cn("h-4 w-4", item.color)} />
                </div>
                {item.label}
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* FOOTER USER */}
      <div className="p-4 border-t bg-slate-50/50">
        <Button 
          variant="outline" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Disconnettiti
        </Button>
      </div>
    </div>
  );
}