import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BookOpen, FileCheck, MessageSquare } from 'lucide-react';

const tabs = [
  { id: 'guida', label: 'Guida Ospiti', path: '/accoglienza', icon: BookOpen },
  { id: 'documenti', label: 'Approvazione Documenti', path: '/accoglienza/documenti', icon: FileCheck },
  { id: 'comunicazione', label: 'Comunicazione', path: '/accoglienza/comunicazione', icon: MessageSquare },
];

export default function Accoglienza() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = (() => {
    if (location.pathname.includes('/comunicazione')) return 'comunicazione';
    if (location.pathname.includes('/documenti')) return 'documenti';
    return 'guida';
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accoglienza</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestisci guide ospiti, documenti e comunicazione.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
                'rounded-t-md -mb-px',
                isActive
                  ? 'text-primary border-b-2 border-primary bg-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
