import React from 'react';
import { 
  LayoutDashboard, CalendarDays, Wallet, Banknote, Wrench, Settings, 
  LogOut, FileText, UserPlus, FolderOpen, Users, Truck, Ticket // <--- Aggiunto Ticket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom'; // Usiamo navigate per i pulsanti

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onCloseMobile?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onCloseMobile }: SidebarProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleNavigation = (id: string, path: string) => {
    setActiveTab(id);
    navigate(path); // Navigazione reale
    if (onCloseMobile) onCloseMobile();
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-600', path: '/' },
    { id: 'bookings', label: 'Prenotazioni', icon: CalendarDays, color: 'text-purple-600', path: '/bookings' },
    { id: 'tenants', label: 'Inquilini', icon: UserPlus, color: 'text-cyan-600', path: '/tenants' },
    
    // NUOVA VOCE TICKET
    { id: 'tickets', label: 'Ticket & Guasti', icon: Ticket, color: 'text-orange-500', path: '/tickets' },

    { id: 'revenue', label: 'Incassi', icon: Wallet, color: 'text-green-600', path: '/revenue' },
    { id: 'expenses', label: 'Spese', icon: Banknote, color: 'text-red-600', path: '/expenses' },
    { id: 'mobile-properties', label: 'Parco Mezzi', icon: Truck, color: 'text-indigo-600', path: '/mobile-properties' },
    { id: 'properties', label: 'Proprietà', icon: FolderOpen, color: 'text-blue-500', path: '/properties' },
    { id: 'activities', label: 'Attività', icon: FileText, color: 'text-emerald-600', path: '/activities' },
    { id: 'team', label: 'Team', icon: Users, color: 'text-yellow-600', path: '/team' },
    { id: 'services', label: 'Servizi', icon: Wrench, color: 'text-slate-600', path: '/services' },
  ];

  return (
    <div className="flex h-full w-full flex-col bg-white border-r border-slate-200">
      <div className="p-6 flex items-center gap-2 border-b border-slate-100">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <span className="font-bold text-xl text-slate-800 tracking-tight">PropManager</span>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id, item.path)}
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

      <div className="p-4 border-t bg-slate-50/50">
        <Button 
          variant="outline" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}