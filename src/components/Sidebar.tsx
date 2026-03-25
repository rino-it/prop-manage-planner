import React, { useState } from 'react';
import {
  LayoutDashboard, CalendarDays, Wallet, Banknote, Wrench,
  LogOut, FileText, UserPlus, Home, Users, Truck, Ticket,
  Search, ChevronRight, MessageCircle, DoorOpen, BarChart3, Globe, Store, Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onCloseMobile?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    label: 'Operativo',
    items: [
      { id: 'dashboard', label: 'Homepage', icon: LayoutDashboard, path: '/' },
      { id: 'calendario', label: 'Calendario', icon: CalendarDays, path: '/calendario' },
      { id: 'bookings', label: 'Prenotazioni', icon: CalendarDays, path: '/bookings' },
      { id: 'messaggi', label: 'Messaggi', icon: MessageCircle, path: '/messaggi' },
    ],
  },
  {
    label: 'Gestione',
    items: [
      { id: 'properties', label: 'Proprieta', icon: Home, path: '/properties' },
      { id: 'tenants', label: 'Inquilini', icon: UserPlus, path: '/tenants' },
      { id: 'accoglienza', label: 'Accoglienza', icon: DoorOpen, path: '/accoglienza' },
      { id: 'prezzi', label: 'Prezzi', icon: Tag, path: '/prezzi' },
      { id: 'mobile-properties', label: 'Parco Mezzi', icon: Truck, path: '/mobile-properties' },
    ],
  },
  {
    label: 'Finanziario',
    items: [
      { id: 'revenue', label: 'Incassi', icon: Wallet, path: '/revenue' },
      { id: 'expenses', label: 'Spese', icon: Banknote, path: '/expenses' },
      { id: 'statistiche', label: 'Statistiche', icon: BarChart3, path: '/statistiche' },
    ],
  },
  {
    label: 'Integrazioni',
    items: [
      { id: 'portali', label: 'Portali', icon: Globe, path: '/portali' },
      { id: 'marketplace', label: 'Marketplace', icon: Store, path: '/marketplace' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'team', label: 'Team', icon: Users, path: '/team' },
      { id: 'services', label: 'Servizi', icon: Wrench, path: '/services' },
      { id: 'tickets', label: 'Ticket & Guasti', icon: Ticket, path: '/tickets' },
      { id: 'activities', label: 'Attivita', icon: FileText, path: '/activities' },
    ],
  },
];

export default function Sidebar({ activeTab, setActiveTab, onCloseMobile }: SidebarProps) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleNavigation = (id: string, path: string) => {
    setActiveTab(id);
    navigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const filteredSections = searchTerm
    ? menuSections.map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.label.toLowerCase().includes(searchTerm.toLowerCase())
        ),
      })).filter(section => section.items.length > 0)
    : menuSections;

  const userEmail = user?.email || '';
  const userInitial = user?.user_metadata?.first_name?.[0]?.toUpperCase()
    || userEmail[0]?.toUpperCase()
    || 'U';
  const userName = user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
    : userEmail.split('@')[0];

  return (
    <div className="flex h-full w-full flex-col bg-white border-r border-border pb-safe">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-border">
        <img
          src="/prop-manager-logo.svg"
          alt="PropManager"
          className="h-8 w-8"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
        <span className="font-bold text-base text-foreground tracking-tight">PropManager</span>
      </div>

      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Cerca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-sm bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 pt-2">
        <nav className="pb-6">
          {filteredSections.map((section, sectionIdx) => (
            <div key={section.label} className={cn(sectionIdx > 0 && "mt-4")}>
              <div className="px-3 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </span>
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.id, item.path)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-[13.5px] font-medium rounded-md transition-all duration-150 group touch-manipulation relative",
                        isActive
                          ? "bg-primary/8 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full" />
                      )}
                      <Icon className={cn(
                        "h-[18px] w-[18px] flex-shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span className="truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="ml-auto text-[10px] font-semibold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-border">
        <div className="px-4 py-3 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-primary">{userInitial}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground truncate">{userName}</div>
            <div className="text-[11px] text-muted-foreground truncate">{userEmail}</div>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}