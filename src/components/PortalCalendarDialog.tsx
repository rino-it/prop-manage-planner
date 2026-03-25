import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft, ChevronRight, User, Calendar as CalendarIcon,
  Ban, Lock, Unlock, X
} from 'lucide-react';
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

interface BlockedDate {
  id: string;
  date_start: string;
  date_end: string;
  reason: string | null;
  source: string | null;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const SOURCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  airbnb_ical: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  booking_ical: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  vrbo_ical: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  manual: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
};

const BLOCKED_COLORS = { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700' };

function getSourceColors(source: string | null) {
  if (!source) return SOURCE_COLORS.manual;
  return SOURCE_COLORS[source] || SOURCE_COLORS.manual;
}

function sourceLabel(source: string | null): string {
  const labels: Record<string, string> = {
    airbnb_ical: 'Airbnb',
    booking_ical: 'Booking.com',
    vrbo_ical: 'VRBO',
    manual: 'Manuale',
  };
  return labels[source || 'manual'] || source || 'Manuale';
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<PortalBooking | BlockedDate | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<'booking' | 'blocked'>('booking');
  const [blockStart, setBlockStart] = useState<Date | null>(null);

  const rangeStart = subMonths(startOfMonth(new Date()), 1).toISOString().split('T')[0];
  const rangeEnd = addMonths(endOfMonth(new Date()), 3).toISOString().split('T')[0];

  const { data: bookings = [] } = useQuery({
    queryKey: ['portal-calendar-bookings', propertyId],
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

  const { data: blockedDates = [] } = useQuery({
    queryKey: ['portal-calendar-blocked', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_blocked_dates')
        .select('id, date_start, date_end, reason, source')
        .eq('property_id', propertyId)
        .gte('date_end', rangeStart)
        .lte('date_start', rangeEnd)
        .order('date_start', { ascending: true });
      if (error) throw error;
      return (data || []) as BlockedDate[];
    },
    enabled: open && !!propertyId,
    staleTime: 30_000,
  });

  const addBlock = useMutation({
    mutationFn: async ({ start, end }: { start: string; end: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');
      const { error } = await supabase.from('property_blocked_dates').insert({
        property_id: propertyId,
        user_id: user.id,
        date_start: start,
        date_end: end,
        reason: 'Bloccato manualmente',
        source: 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-calendar-blocked', propertyId] });
      toast({ title: 'Date bloccate' });
      setBlockStart(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    },
  });

  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('property_blocked_dates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-calendar-blocked', propertyId] });
      setSelectedItem(null);
      toast({ title: 'Blocco rimosso' });
    },
  });

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

  type DayInfo = {
    bookings: PortalBooking[];
    blocks: BlockedDate[];
  };

  function getDayInfo(date: Date): DayInfo {
    const dayBookings: PortalBooking[] = [];
    const dayBlocks: BlockedDate[] = [];

    for (const b of bookings) {
      const start = parseISO(b.data_inizio);
      const end = parseISO(b.data_fine);
      if (isWithinInterval(date, { start, end: addDays(end, -1) })) {
        dayBookings.push(b);
      }
    }

    for (const bl of blockedDates) {
      const start = parseISO(bl.date_start);
      const end = parseISO(bl.date_end);
      if (isWithinInterval(date, { start, end })) {
        dayBlocks.push(bl);
      }
    }

    return { bookings: dayBookings, blocks: dayBlocks };
  }

  const allMonthBookings = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return bookings.filter(b => {
      const start = parseISO(b.data_inizio);
      const end = parseISO(b.data_fine);
      return isBefore(start, addDays(monthEnd, 1)) && isBefore(monthStart, end);
    });
  }, [bookings, currentMonth]);

  const monthBlocked = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return blockedDates.filter(bl => {
      const start = parseISO(bl.date_start);
      const end = parseISO(bl.date_end);
      return isBefore(start, addDays(monthEnd, 1)) && isBefore(monthStart, end);
    });
  }, [blockedDates, currentMonth]);

  const today = new Date();

  function handleDayClick(day: Date, info: DayInfo) {
    if (info.bookings.length > 0) {
      setSelectedItem(info.bookings[0]);
      setSelectedItemType('booking');
      return;
    }
    if (info.blocks.length > 0) {
      setSelectedItem(info.blocks[0]);
      setSelectedItemType('blocked');
      return;
    }

    if (!blockStart) {
      setBlockStart(day);
    } else {
      const start = isBefore(day, blockStart) ? day : blockStart;
      const end = isBefore(day, blockStart) ? blockStart : day;
      addBlock.mutate({
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setBlockStart(null); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Disponibilita: {propertyName}
          </DialogTitle>
          <DialogDescription>
            Connesso a {portalLabel(portalName)} - mostra tutte le prenotazioni e date bloccate
          </DialogDescription>
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-rose-50 border border-rose-200" />
              <span>Airbnb</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-50 border border-blue-200" />
              <span>Booking.com</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-200" />
              <span>Manuale</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-300" />
              <span>Bloccato</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-white border border-slate-200" />
              <span>Disponibile</span>
            </div>
          </div>

          {blockStart && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-sm">
              <Lock className="w-4 h-4 text-amber-600" />
              <span className="text-amber-800">
                Inizio blocco: <strong>{format(blockStart, 'dd MMM', { locale: it })}</strong> — clicca la data di fine per confermare
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => setBlockStart(null)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

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
                const info = getDayInfo(day);
                const hasBooking = info.bookings.length > 0;
                const hasBlock = info.blocks.length > 0;
                const isBlockStartDay = blockStart && isSameDay(day, blockStart);

                let cellBg = 'bg-white';
                let cellBorder = '';
                let label = '';
                let labelColor = '';

                if (hasBooking) {
                  const src = info.bookings[0].source;
                  const sc = getSourceColors(src);
                  cellBg = sc.bg;
                  cellBorder = `border-l-2 ${sc.border}`;
                  label = info.bookings[0].nome_ospite;
                  labelColor = sc.text;
                } else if (hasBlock) {
                  cellBg = BLOCKED_COLORS.bg;
                  cellBorder = `border-l-2 ${BLOCKED_COLORS.border}`;
                  label = info.blocks[0].reason || 'Bloccato';
                  labelColor = BLOCKED_COLORS.text;
                }

                if (isBlockStartDay) {
                  cellBg = 'bg-amber-100';
                  cellBorder = 'border-l-2 border-amber-400';
                }

                return (
                  <div
                    key={idx}
                    className={`
                      relative min-h-[52px] border-b border-r p-1 transition-colors cursor-pointer
                      ${inMonth ? 'hover:brightness-95' : 'opacity-30'}
                      ${cellBg} ${cellBorder}
                    `}
                    onClick={() => inMonth && handleDayClick(day, info)}
                  >
                    <span className={`
                      text-xs font-medium block text-right pr-0.5
                      ${isToday ? 'bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center ml-auto' : ''}
                      ${!inMonth ? 'text-muted-foreground' : 'text-foreground'}
                    `}>
                      {format(day, 'd')}
                    </span>

                    {label && (
                      <div className={`mt-0.5 px-1 py-0.5 rounded text-[9px] truncate ${labelColor} font-medium`}>
                        {label}
                      </div>
                    )}

                    {hasBlock && !hasBooking && (
                      <Ban className="absolute top-1 left-1 w-3 h-3 text-amber-400" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground">
            Clicca su un giorno libero per bloccare date. Clicca su una prenotazione o blocco per i dettagli.
          </div>

          {(allMonthBookings.length > 0 || monthBlocked.length > 0) && (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1.5">
                {allMonthBookings.map(b => {
                  const start = parseISO(b.data_inizio);
                  const end = parseISO(b.data_fine);
                  const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  const sc = getSourceColors(b.source);
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-3 p-2 rounded-lg border ${sc.border} ${sc.bg}`}
                    >
                      <User className={`w-3.5 h-3.5 ${sc.text} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.nome_ospite}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(start, 'dd MMM', { locale: it })} → {format(end, 'dd MMM', { locale: it })} ({nights} {nights === 1 ? 'notte' : 'notti'})
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] ${sc.text} ${sc.border}`}>
                        {sourceLabel(b.source)}
                      </Badge>
                    </div>
                  );
                })}

                {monthBlocked.map(bl => (
                  <div
                    key={bl.id}
                    className={`flex items-center gap-3 p-2 rounded-lg border ${BLOCKED_COLORS.border} ${BLOCKED_COLORS.bg}`}
                  >
                    <Ban className={`w-3.5 h-3.5 ${BLOCKED_COLORS.text} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{bl.reason || 'Bloccato'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(bl.date_start), 'dd MMM', { locale: it })} → {format(parseISO(bl.date_end), 'dd MMM', { locale: it })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-amber-700 hover:text-red-600"
                      onClick={() => removeBlock.mutate(bl.id)}
                    >
                      <Unlock className="w-3 h-3 mr-1" /> Sblocca
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {allMonthBookings.length === 0 && monthBlocked.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nessuna prenotazione o blocco in questo mese. Tutto disponibile.
            </div>
          )}
        </div>

        <Dialog open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">
                {selectedItemType === 'booking' ? 'Dettaglio prenotazione' : 'Date bloccate'}
              </DialogTitle>
              <DialogDescription>
                {selectedItemType === 'booking' && selectedItem
                  ? `Fonte: ${sourceLabel((selectedItem as PortalBooking).source)}`
                  : 'Blocco manuale'}
              </DialogDescription>
            </DialogHeader>
            {selectedItem && selectedItemType === 'booking' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getSourceColors((selectedItem as PortalBooking).source).bg}`}>
                    <User className={`w-5 h-5 ${getSourceColors((selectedItem as PortalBooking).source).text}`} />
                  </div>
                  <div>
                    <p className="font-semibold">{(selectedItem as PortalBooking).nome_ospite}</p>
                    <p className="text-xs text-muted-foreground">
                      {sourceLabel((selectedItem as PortalBooking).source)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Check-in</p>
                    <p className="font-medium">{format(parseISO((selectedItem as PortalBooking).data_inizio), 'dd MMM yyyy', { locale: it })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Check-out</p>
                    <p className="font-medium">{format(parseISO((selectedItem as PortalBooking).data_fine), 'dd MMM yyyy', { locale: it })}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stato</p>
                  <Badge variant="outline" className="mt-1">{(selectedItem as PortalBooking).checkin_status || 'pending'}</Badge>
                </div>
              </div>
            )}
            {selectedItem && selectedItemType === 'blocked' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${BLOCKED_COLORS.bg}`}>
                    <Ban className={`w-5 h-5 ${BLOCKED_COLORS.text}`} />
                  </div>
                  <div>
                    <p className="font-semibold">{(selectedItem as BlockedDate).reason || 'Bloccato'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Da</p>
                    <p className="font-medium">{format(parseISO((selectedItem as BlockedDate).date_start), 'dd MMM yyyy', { locale: it })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">A</p>
                    <p className="font-medium">{format(parseISO((selectedItem as BlockedDate).date_end), 'dd MMM yyyy', { locale: it })}</p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => removeBlock.mutate((selectedItem as BlockedDate).id)}
                >
                  <Unlock className="w-4 h-4 mr-2" /> Rimuovi blocco
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
