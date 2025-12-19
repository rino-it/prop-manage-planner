import React from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Wallet, 
  Banknote, 
  Wrench, 
  Settings, 
  LogOut, 
  FileText, 
  UserPlus, 
  FolderOpen, 
  Users,
  Truck // NUOVO IMPORT
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom'; // NUOVO IMPORT

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
    
    // NUOVA VOCE: PARCO MEZZI (Inserita sotto "Spese" come richiesto)
    { 
      id: 'mobile-properties', 
      label: 'Parco Mezzi', 
      icon: Truck, 
      color: 'text-slate-600', // Stile coerente con gli altri
      path: '/mobile-properties' // Campo speciale per i link
    },

    { id: 'properties', label: 'Proprietà', icon: FolderOpen, color: 'text-orange-600' },
    { id: 'activities', label: 'Attività', icon: Wrench, color: 'text-amber-600' },
    { id: 'services', label: 'Servizi', icon: FileText, color: 'text-pink-600' },
    { id: 'team', label: 'Gestione Team', icon: Users, color: 'text-indigo-600' },
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
            // Evidenzia se l'ID corrisponde o se il path è quello corrente (opzionale)
            const isActive = activeTab === item.id;
            
            // LOGICA DI RENDERING: LINK vs BUTTON
            // Se l'item ha una proprietà 'path', renderizziamo un Link di React Router
            if ((item as any).path) {
              return (
                <Link
                  key={item.id}
                  to={(item as any).path}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group",
                    isActive 
                      ? "bg-slate-100 text-slate-900 shadow-sm" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                  onClick={onCloseMobile} // Chiude il menu mobile se presente
                >
                  <div className={cn(
                    "p-1.5 rounded-md transition-colors",
                    isActive ? "bg-white shadow-sm" : "bg-slate-100 group-hover:bg-white"
                  )}>
                    <Icon className={cn("h-4 w-4", item.color)} />
                  </div>
                  {item.label}
                </Link>
              );
            }

            // Altrimenti renderizziamo il classico Button per la navigazione a tab
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