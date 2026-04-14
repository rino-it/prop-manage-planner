import React, { useState } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ActivityCalendarProps {
  tickets: any[];
  onTicketClick: (ticket: any) => void;
  onDayClick: (date: Date) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critica: 'bg-red-500 text-white',
  alta:    'bg-red-400 text-white',
  media:   'bg-amber-400 text-white',
  bassa:   'bg-emerald-500 text-white',
};

const PRIORITY_DOT: Record<string, string> = {
  critica: 'bg-red-500',
  alta:    'bg-red-400',
  media:   'bg-amber-400',
  bassa:   'bg-emerald-500',
};

export default function ActivityCalendar({ tickets, onTicketClick, onDayClick }: ActivityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build weeks array
  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const ticketsForDay = (d: Date) =>
    tickets.filter(t => {
      if (!t.data_scadenza) return false;
      try { return isSameDay(parseISO(t.data_scadenza), d); } catch { return false; }
    });

  const dayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-800 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: it })}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentMonth(new Date())}>
            Oggi
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b bg-slate-50">
        {dayLabels.map(l => (
          <div key={l} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {l}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 divide-x divide-y border-b">
        {weeks.flat().map((d, idx) => {
          const dayTickets = ticketsForDay(d);
          const inMonth = isSameMonth(d, currentMonth);
          const isCurrentDay = isToday(d);

          return (
            <div
              key={idx}
              className={`min-h-[100px] p-1.5 cursor-pointer transition-colors group
                ${inMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60'}
              `}
              onClick={() => onDayClick(d)}
            >
              {/* Day number */}
              <div className="flex items-center justify-end mb-1">
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                  ${isCurrentDay ? 'bg-blue-600 text-white font-bold' : inMonth ? 'text-slate-700' : 'text-slate-300'}
                `}>
                  {format(d, 'd')}
                </span>
              </div>

              {/* Tickets */}
              <div className="space-y-0.5">
                {dayTickets.slice(0, 3).map((t: any) => (
                  <div
                    key={t.id}
                    className={`text-[11px] font-medium px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity
                      ${PRIORITY_COLORS[t.priorita] || 'bg-slate-200 text-slate-700'}
                    `}
                    onClick={e => { e.stopPropagation(); onTicketClick(t); }}
                    title={t.titolo}
                  >
                    {t.titolo}
                  </div>
                ))}
                {dayTickets.length > 3 && (
                  <div className="text-[10px] text-slate-400 pl-1">
                    +{dayTickets.length - 3} altri
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-3 text-xs text-slate-500">
        {Object.entries({ critica: 'Critica', alta: 'Alta', media: 'Media', bassa: 'Bassa' }).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${PRIORITY_DOT[k]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
