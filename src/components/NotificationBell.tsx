import React, { useState, useEffect } from 'react';
import { Bell, Check, Car, Home, Filter, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays, parseISO, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'real', 'mobile'
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 1. GENERATORE NOTIFICHE (Lato Client)
  useEffect(() => {
    if (!user) return;

    const runChecks = async () => {
      const today = startOfDay(new Date());

      // Scarichiamo i dati CON i riferimenti (property_id / mobile_id)
      const [expenses, tickets, revenues] = await Promise.all([
        supabase.from('payments').select('*, properties_mobile(targa)').eq('stato', 'da_pagare'),
        supabase.from('tickets').select('*, properties_mobile(targa)').neq('stato', 'risolto'),
        supabase.from('tenant_payments').select('*, bookings(nome_ospite)').eq('stato', 'da_pagare')
      ]);

      // Helper per inserire notifica
      const checkAndPrepare = async (link: string, keyText: string, title: string, msg: string, days: number, context: 'real' | 'mobile') => {
        // Regola: Multiplo di 4 o Manca 1 giorno
        if ((days > 0 && days % 4 === 0) || days === 1) {
          
          // Verifica esistenza (per evitare spam oggi)
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('link', link)
            .ilike('message', `%${keyText}%`)
            .gte('created_at', today.toISOString())
            .eq('user_id', user.id);

          if (!existing || existing.length === 0) {
            await supabase.from('notifications').insert({
              user_id: user.id,
              title: title,
              message: msg, // Inseriamo un "marker" nel messaggio se serve, o usiamo una colonna extra in futuro
              link: link + `?ctx=${context}`, // Trucco: salvo il contesto nel link per filtrarlo dopo
              type: days === 1 ? 'warning' : 'info'
            });
            return true;
          }
        }
        return false;
      };

      // A. SPESE (Controlla se Veicolo o Casa)
      if (expenses.data) {
        for (const ex of expenses.data) {
          if (!ex.scadenza) continue;
          const days = differenceInDays(parseISO(ex.scadenza), today);
          const isMobile = !!ex.property_mobile_id;
          
          await checkAndPrepare(
            '/expenses', 
            ex.descrizione,
            days === 1 ? 'SPESA SCADE DOMANI!' : `Spesa tra ${days} giorni`,
            `${isMobile ? '🚗' : '🏠'} ${ex.descrizione} (€${ex.importo})`,
            days,
            isMobile ? 'mobile' : 'real'
          );
        }
      }

      // B. TICKET
      if (tickets.data) {
        for (const t of tickets.data) {
          if (!t.data_scadenza) continue;
          const days = differenceInDays(parseISO(t.data_scadenza), today);
          const isMobile = !!t.property_mobile_id;

          await checkAndPrepare(
            '/tickets', 
            t.titolo,
            'Manutenzione',
            `${isMobile ? '🚗' : '🏠'} Ticket: ${t.titolo}`,
            days,
            isMobile ? 'mobile' : 'real'
          );
        }
      }

      // C. INCASSI (Sempre Immobili)
      if (revenues.data) {
        for (const rev of revenues.data) {
          if (!rev.data_scadenza) continue;
          const days = differenceInDays(parseISO(rev.data_scadenza), today);
          const nome = rev.bookings?.nome_ospite || 'Ospite';
          await checkAndPrepare(
            '/revenue', 
            nome,
            'Incasso Atteso',
            `🏠 Canone: ${nome} (€${rev.importo})`,
            days,
            'real'
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    runChecks();
  }, [user]);

  // 2. FETCH NOTIFICHE
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: 10000 
  });

  // 3. LOGICA FILTRO (Legge il parametro ?ctx= nel link o le emoji nel messaggio)
  const filteredNotifications = notifications.filter((n: any) => {
    if (filter === 'all') return true;
    // Euristica per capire la categoria
    const isMobile = n.link?.includes('ctx=mobile') || n.message?.includes('🚗');
    const isReal = n.link?.includes('ctx=real') || n.message?.includes('🏠') || n.link?.includes('revenue');

    if (filter === 'mobile') return isMobile;
    if (filter === 'real') return isReal || (!isMobile); // Default a real se incerto
    return true;
  });

  // MARK AS READ
  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const handleNotificationClick = (n: any) => {
    markAsRead.mutate(n.id);
    setIsOpen(false);
    if (n.link) navigate(n.link.split('?')[0]); // Pulisce il link dal parametro ctx
  };

  const markAllRead = async () => {
    if(!confirm("Segnare tutto come letto?")) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-600 hover:bg-slate-100">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse border-2 border-white" />
          )}
        </Button>
      </PopoverTrigger>
      
      {/* Popover più largo (w-96) */}
      <PopoverContent className="w-[400px] p-0 mr-4 shadow-2xl border-slate-200" align="end">
        
        {/* HEADER CON FILTRI */}
        <div className="p-3 border-b bg-slate-50 space-y-3">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800">Notifiche</h4>
                    {notifications.length > 0 && <Badge variant="destructive" className="px-1.5 h-5 text-[10px]">{notifications.length}</Badge>}
                </div>
                {notifications.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-400 hover:text-blue-600" onClick={markAllRead}>
                        Pulisci tutto
                    </Button>
                )}
            </div>

            {/* TAB DI FILTRO */}
            <Tabs defaultValue="all" value={filter} onValueChange={setFilter} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-8 bg-slate-200/50">
                    <TabsTrigger value="all" className="text-xs">Tutti</TabsTrigger>
                    <TabsTrigger value="real" className="text-xs flex gap-1"><Home className="w-3 h-3"/> Immobili</TabsTrigger>
                    <TabsTrigger value="mobile" className="text-xs flex gap-1"><Car className="w-3 h-3"/> Veicoli</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>

        {/* LISTA SCROLLABILE (Più Alta: h-[400px]) */}
        <ScrollArea className="h-[400px] bg-white">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 text-sm">
                <ListFilter className="w-8 h-8 mb-2 opacity-20"/>
                <p>{filter === 'all' ? 'Nessuna nuova notifica' : 'Nessuna notifica in questa categoria'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredNotifications.map((n: any) => (
                <div 
                  key={n.id} 
                  className={`p-4 hover:bg-blue-50 cursor-pointer transition-colors relative group ${n.type === 'warning' ? 'bg-red-50/30' : 'bg-white'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                        {/* Icona dinamica in base al messaggio */}
                        {n.message.includes('🚗') ? <Car className="w-3 h-3 text-indigo-500"/> : <Home className="w-3 h-3 text-orange-500"/>}
                        <p className={`font-semibold text-sm ${n.type === 'warning' ? 'text-red-700' : 'text-slate-900'}`}>
                            {n.title}
                        </p>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: it })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pr-6 pl-5">{n.message.replace('🚗 ', '').replace('🏠 ', '')}</p>
                  
                  <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Check className="w-4 h-4 text-blue-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}