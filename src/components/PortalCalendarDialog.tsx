import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, User, Calendar as CalendarIcon } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  isWithinInterval, parseISO, isBefore
} from 'date-fns';
import { it } from 'date-fns/locale';

interface PortalCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyName: string;
  portalName: string;
  portalSource: string;
}

interface PortalBooking {
  id: string;
  nome_ospite: string;
  data_inizio: string;
  data_fine: string;
  source: string | null;
  checkin_status: string | null;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const PORTAL_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  airbnb: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
  booking: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  vrbo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  other: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-500' },
};

function getPortalColors(portal: string) {
  return PORTAL_COLORS[portal] || PORTAL_COLORS.other;
}

function portalLabel(name: string): string {
  const labels: Record<string, string> = {
    airbnb: 'Airbnb',
    booking: 'Booking.com',
    vrbo: 'VRBO',
  };
  return labels[name] || name;
}

export default function PortalCalendarDialog({
  open, onOpenChange, propertyId, propertyName, portalName, portalSource
}: PortalCalendarDialogProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<PortalBooking | null>(null);

  const colors = getPortalColors(portalName);

  const rangeStart = subMonths(startOfMonth(new Date()), 1).toISOString().split('T')[0];
  const rangeEnd = addMonths(endOfMonth(new Date()), 3).toISOString().split('T')[0];

  const { data: bookings = [] } = useQuery({
    queryKey: ['portal-calendar-bookings', propertyId, portalSource],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, nome_ospite, data_inizio, data_fine, source, checkin_status')
        .eq('property_id', propertyId)
        .gte('data_fine', rangeStart)
        .lte('data_inizio', rangeEnd)
        .order('data_inizio', { ascending: true });
      if (error) throw error;
      return (data || []) as PortalBooking[];
    },
    enabled: open && !!propertyId,
    staleTime: 30_000,
  });

  const portalBookings = useMemo(
    () => bookings.filter(b => b.source === portalSource),
    [bookings, portalSource]
  );

  const allBookings = bookings;

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = calStart;
    while (isBefore(day, addDays(calEnd, 1))) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  function getBookingsForDay(date: Date): { portal: PortalBooking[]; other: PortalBooking[] } {
    const portal: PortalBooking[] = [];
    const other: PortalBooking[] = [];

    for (const b of allBookings) {
      const start = parseISO(b.data_inizio);
      const end = parseISO(b.data_fine);
      if (isWithinInterval(date, { start, end: addDays(end, -1) })) {
        if (b.source === portalSource) {
          portal.push(b);
        } else {
          other.push(b);
        }
      }
    }
    return { portal, other };
  }

  const monthBookings = useMemo(() => {
    return portalBookings.filter(b => {
      const start = parseISO(b.data_inizio);
      const end = parseISO(b.data_fine);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      return isBefore(start, addDays(monthEnd, 1)) && isBefore(monthStart, end);
    });
  }, [portalBookings, currentMonth]);

  const today = new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Calendario {portalLabel(portalName)}
          </DialogTitle>
          <DialogDescription>{propertyName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-sm capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${colors.bg} ${colors.border} border`} />
              <span>{portalLabel(portalName)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-300" />
              <span>Altri portali</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-white border border-slate-200" />
              <span>Disponibile</span>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const inMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, today);
                const { portal, other } = getBookingsForDay(day);
                const hasPortalBooking = portal.length > 0;
                const hasOtherBooking = other.length > 0;
                const isOccupied = hasPortalBooking || hasOtherBooking;

                let cellBg = 'bg-white';
                let cellBorder = '';
                if (hasPortalBooking) {
                  cellBg = colors.bg;
                  cellBorder = `border-l-2 ${colors.border}`;
                } else if (hasOtherBooking) {
                  cellBg = 'bg-slate-50';
                  cellBorder = 'border-l-2 border-slate-300';
                }

                return (
                  <div
                    key={idx}
                    className={`
                      relative min-h-[52px] border-b border-r p-1 transition-colors
                      ${inMonth ? '' : 'opacity-30'}
                      ${cellBg} ${cellBorder}
                      ${isOccupied ? 'cursor-pointer hover:brightness-95' : ''}
                    `}
                    onClick={() => {
                      if (portal.length > 0) setSelectedBooking(portal[0]);
                      else if (other.length > 0) setSelectedBooking(other[0]);
                    }}
                  >
                    <span className={`
                      text-xs font-medium block text-right pr-0.5
                      ${isToday ? 'bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center ml-auto' : ''}
                      ${!inMonth ? 'text-muted-foreground' : 'text-foreground'}
                    `}>
                      {format(day, 'd')}
                    </span>

                    {hasPortalBooking && (
                      <div className={`mt-0.5 px-1 py-0.5 rounded text-[9px] truncate ${colors.text} font-medium`}>
                        {portal[0].nome_ospite}
                      </div>
                    )}
                    {hasOtherBooking && !hasPortalBooking && (
                      <div className="mt-0.5 px-1 py-0.5 rounded text-[9px] truncate text-slate-500 font-medium">
                        {other[0].nome_ospite}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {monthBookings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Prenotazioni {portalLabel(portalName)} nel mese
              </h4>
              <ScrollArea className="max-h-[180px]">
                <div className="space-y-1.5">
                  {monthBookings.map(b => {
                    const start = parseISO(b.data_inizio);
                    const end = parseISO(b.data_fine);
                    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div
                        key={b.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border ${colors.border} ${colors.bg} cursor-pointer hover:brightness-95 transition-colors`}
                        onClick={() => setSelectedBooking(b)}
                      >
                        <div className={`p-1.5 rounded-full ${colors.bg}`}>
                          <User className={`w-3.5 h-3.5 ${colors.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{b.nome_ospite}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(start, 'dd MMM', { locale: it })} → {format(end, 'dd MMM', { locale: it })} ({nights} {nights === 1 ? 'notte' : 'notti'})
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-[9px] ${colors.text} ${colors.border}`}>
                          {b.checkin_status || 'pending'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {monthBookings.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nessuna prenotazione da {portalLabel(portalName)} in questo mese.
            </div>
          )}
        </div>

        <Dialog open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Dettaglio prenotazione</DialogTitle>
              <DialogDescription>Importata da {portalLabel(portalName)}</DialogDescription>
            </DialogHeader>
            {selectedBooking && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${colors.bg}`}>
                    <User className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedBooking.nome_ospite}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedBooking.source}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Check-in</p>
                    <p className="font-medium">{format(parseISO(selectedBooking.data_inizio), 'dd MMM yyyy', { locale: it })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Check-out</p>
                    <p className="font-medium">{format(parseISO(selectedBooking.data_fine), 'dd MMM yyyy', { locale: it })}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stato</p>
                  <Badge variant="outline" className="mt-1">{selectedBooking.checkin_status || 'pending'}</Badge>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
