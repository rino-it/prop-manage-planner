import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, ChevronDown, ChevronUp, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface UnscheduledListProps {
  tickets: any[];
  onTicketClick: (ticket: any) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critica: 'bg-red-100 text-red-800 border-red-200',
  alta:    'bg-red-100 text-red-800 border-red-200',
  media:   'bg-amber-100 text-amber-800 border-amber-200',
  bassa:   'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export default function UnscheduledList({ tickets, onTicketClick }: UnscheduledListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState<Record<string, string>>({});

  const assignDate = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const { error } = await supabase.from('tickets').update({ data_scadenza: date }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setAssigningId(null);
      toast({ title: 'Data assegnata', description: `Attività spostata al ${format(new Date(vars.date), 'dd/MM/yyyy')}` });
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  if (tickets.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 border-b bg-slate-50 hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-800">Da Schedulare</span>
          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold px-2 py-0.5 rounded-full">
            {tickets.length}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="divide-y">
          {tickets.map((t: any) => (
            <div key={t.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
              {/* Left: info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                    t.priorita === 'critica' || t.priorita === 'alta' ? 'bg-red-400' :
                    t.priorita === 'media' ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-slate-800 truncate">{t.titolo}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.properties_real?.nome && (
                      <span className="text-xs text-slate-500">🏠 {t.properties_real.nome}</span>
                    )}
                    {t.properties_mobile && (
                      <span className="text-xs text-slate-500">🚗 {t.properties_mobile.veicolo}</span>
                    )}
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[t.priorita] || ''}`}>
                      {t.priorita}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {assigningId === t.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      className="h-8 text-xs w-36"
                      value={dateInput[t.id] || ''}
                      onChange={e => setDateInput(v => ({ ...v, [t.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                      disabled={!dateInput[t.id]}
                      onClick={() => assignDate.mutate({ id: t.id, date: dateInput[t.id] })}
                    >
                      Salva
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setAssigningId(null)}
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => setAssigningId(t.id)}
                    >
                      <Calendar className="w-3 h-3" /> Assegna data
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1.5"
                      onClick={() => onTicketClick(t)}
                    >
                      <UserCog className="w-3 h-3" /> Gestisci
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
