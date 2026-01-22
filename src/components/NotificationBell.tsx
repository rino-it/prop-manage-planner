import React, { useState, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
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

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 1. LOGICA INTELLIGENTE LATO CLIENT (Sostituisce RPC)
  useEffect(() => {
    if (!user) return;

    const runChecks = async () => {
      const today = startOfDay(new Date());

      // A. SCARICA TUTTE LE SCADENZE APERTE
      const [expenses, tickets, revenues] = await Promise.all([
        supabase.from('payments').select('*').eq('stato', 'da_pagare'),
        supabase.from('tickets').select('*').neq('stato', 'risolto'),
        supabase.from('tenant_payments').select('*, bookings(nome_ospite)').eq('stato', 'da_pagare')
      ]);

      const newNotifications = [];

      // Funzione Helper per verificare se notifica esiste già oggi
      const checkAndPrepare = async (link: string, keyText: string, title: string, msg: string, days: number) => {
        // Regola: Multiplo di 4 o Manca 1 giorno
        if ((days > 0 && days % 4 === 0) || days === 1) {
          
          // Verifica se l'abbiamo già notificato OGGI
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('link', link)
            .ilike('message', `%${keyText}%`) // Cerca il nome univoco
            .gte('created_at', today.toISOString()) // Solo notifiche di oggi
            .eq('user_id', user.id);

          if (!existing || existing.length === 0) {
            await supabase.from('notifications').insert({
              user_id: user.id,
              title: title,
              message: msg,
              link: link,
              type: days === 1 ? 'warning' : 'info'
            });
            return true; // Ne abbiamo creata una nuova
          }
        }
        return false;
      };

      // B. CONTROLLO SPESE
      if (expenses.data) {
        for (const ex of expenses.data) {
          if (!ex.scadenza) continue;
          const days = differenceInDays(parseISO(ex.scadenza), today);
          await checkAndPrepare(
            '/expenses', 
            ex.descrizione, // Chiave univoca
            days === 1 ? 'SCADE DOMANI!' : `Scadenza tra ${days} giorni`,
            `La spesa "${ex.descrizione}" di €${ex.importo} scade il ${ex.scadenza}`,
            days
          );
        }
      }

      // C. CONTROLLO TICKET
      if (tickets.data) {
        for (const t of tickets.data) {
          if (!t.data_scadenza) continue;
          const days = differenceInDays(parseISO(t.data_scadenza), today);
          await checkAndPrepare(
            '/tickets', 
            t.titolo,
            'Manutenzione in Scadenza',
            `Il ticket "${t.titolo}" è previsto per il ${t.data_scadenza}`,
            days
          );
        }
      }

      // D. CONTROLLO INCASSI
      if (revenues.data) {
        for (const rev of revenues.data) {
          if (!rev.data_scadenza) continue;
          const days = differenceInDays(parseISO(rev.data_scadenza), today);
          const nome = rev.bookings?.nome_ospite || 'Ospite';
          await checkAndPrepare(
            '/revenue', 
            nome,
            'Incasso Atteso',
            `L'incasso di €${rev.importo} da ${nome} scade tra ${days} giorni.`,
            days
          );
        }
      }

      // Aggiorna la UI alla fine
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    runChecks();
  }, [user]); // Esegue solo al login/refresh

  // 2. SCARICA LE NOTIFICHE (Non lette)
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

  // 3. SEGNA COME LETTO
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
    if (n.link) navigate(n.link);
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
      <PopoverContent className="w-80 p-0 mr-4 shadow-xl border-slate-200" align="end">
        <div className="p-3 border-b bg-slate-50 flex justify-between items-center rounded-t-md">
          <h4 className="font-semibold text-sm text-slate-800">Notifiche</h4>
          {notifications.length > 0 && <Badge variant="destructive" className="px-1.5 h-5 text-[10px]">{notifications.length}</Badge>}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 text-sm">
                <Bell className="w-8 h-8 mb-2 opacity-20"/>
                <p>Nessuna nuova notifica</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n: any) => (
                <div 
                  key={n.id} 
                  className={`p-4 hover:bg-blue-50 cursor-pointer transition-colors relative group ${n.type === 'warning' ? 'bg-red-50/40' : 'bg-white'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className={`font-semibold text-sm ${n.type === 'warning' ? 'text-red-700' : 'text-slate-900'}`}>
                        {n.title}
                    </p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: it })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pr-6">{n.message}</p>
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