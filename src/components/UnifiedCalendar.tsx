import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import {
  useUnifiedCalendar,
  useBookingNotes,
  getSourceColors,
  sourceLabel,
  BLOCKED_COLORS,
  type CalendarBooking,
  type CalendarBlockedDate,
} from '@/hooks/useUnifiedCalendar';
import {
  ChevronLeft, ChevronRight, User, Ban, Calendar as CalendarIcon,
  StickyNote, Trash2, Send, ExternalLink, CreditCard, FileText,
  MessageCircle, Ticket, Loader2,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  isWithinInterval, parseISO, isBefore, differenceInCalendarDays,
} from 'date-fns';
import { it } from 'date-fns/locale';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

type SelectedItem =
  | { type: 'booking'; data: CalendarBooking }
  | { type: 'blocked'; data: CalendarBlockedDate };

interface UnifiedCalendarProps {
  embedded?: boolean;
}

export default function UnifiedCalendar({ embedded = false }: UnifiedCalendarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [noteText, setNoteText] = useState('');

  const { data: properties = [] } = usePropertiesReal();
  const { bookings, blockedDates, isLoading } = useUnifiedCalendar(currentMonth);

  const bookingId = selectedItem?.type === 'booking' ? selectedItem.data.id : null;
  const { notes, isLoading: loadingNotes, addNote, deleteNote } = useBookingNotes(bookingId);

  const filteredBookings = useMemo(() => {
    let result = bookings;
    if (selectedProperty !== 'all') {
      result = result.filter(b => b.property_id === selectedProperty);
    }
    if (selectedSource !== 'all') {
      result = result.filter(b => (b.source || 'manual') === selectedSource);
    }
    return result;
  }, [bookings, selectedProperty, selectedSource]);

  const filteredBlocked = useMemo(() => {
    let result = blockedDates;
    if (selectedProperty !== 'all') {
      result = result.filter(b => b.property_id === selectedProperty);
    }
    if (selectedSource !== 'all') {
      result = result.filter(b => (b.source || 'manual') === selectedSource);
    }
    return result;
  }, [blockedDates, selectedProperty, selectedSource]);

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

  const getDayInfo = useCallback((date: Date) => {
    const dayBookings: CalendarBooking[] = [];
    const dayBlocks: CalendarBlockedDate[] = [];

    for (const b of filteredBookings) {
      const start = parseISO(b.data_inizio);
      const end = parseISO(b.data_fine);
      if (isWithinInterval(date, { start, end: addDays(end, -1) })) {
        dayBookings.push(b);
      }
    }
    for (const bl of filteredBlocked) {
      const start = parseISO(bl.date_start);
      const end = parseISO(bl.date_end);
      if (isWithinInterval(date, { start, end: addDays(end, -1) })) {
        dayBlocks.push(bl);
      }
    }
    return { bookings: dayBookings, blocks: dayBlocks };
  }, [filteredBookings, filteredBlocked]);

  const handleDayClick = (date: Date) => {
    const info = getDayInfo(date);
    if (info.bookings.length > 0) {
      setSelectedItem({ type: 'booking', data: info.bookings[0] });
    } else if (info.blocks.length > 0) {
      setSelectedItem({ type: 'blocked', data: info.blocks[0] });
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !bookingId) return;
    try {
      await addNote.mutateAsync({ bookingId, content: noteText.trim() });
      setNoteText('');
      toast({ title: 'Nota aggiunta' });
    } catch {
      toast({ title: 'Errore nel salvataggio della nota', variant: 'destructive' });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote.mutateAsync(noteId);
      toast({ title: 'Nota eliminata' });
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const navigateTo = (path: string) => {
    setSelectedItem(null);
    navigate(path);
  };

  const today = new Date();

  const activeSources = useMemo(() => {
    const sources = new Set<string>();
    bookings.forEach(b => sources.add(b.source || 'manual'));
    blockedDates.forEach(b => sources.add(b.source || 'manual'));
    return Array.from(sources);
  }, [bookings, blockedDates]);

  const monthSummary = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const monthBookings = filteredBookings.filter(b => {
      const start = parseISO(b.data_inizio);
      const end = parseISO(b.data_fine);
      return isBefore(start, addDays(monthEnd, 1)) && isBefore(monthStart, end);
    });
    return monthBookings;
  }, [filteredBookings, currentMonth]);

  return (
    <div className={embedded ? '' : 'space-y-6'}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Calendario Unificato</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tutte le prenotazioni da tutti i portali in un unico posto
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm">
        {/* Header con navigazione mese e filtri */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} className="text-xs">
                Oggi
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <h2 className="text-lg font-semibold capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </h2>

            <div className="flex items-center gap-2">
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Proprieta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le proprieta</SelectItem>
                  {(properties || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Portale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i portali</SelectItem>
                  {activeSources.map(s => (
                    <SelectItem key={s} value={s}>{sourceLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Airbnb</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Booking.com</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>VRBO</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Manuale</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Bloccato</span>
            </div>
            <div className="ml-auto text-xs font-medium">
              {monthSummary.length} prenotazion{monthSummary.length === 1 ? 'e' : 'i'} questo mese
            </div>
          </div>
        </div>

        {/* Griglia calendario */}
        <div className="overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-2.5 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const inMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, today);
                const info = getDayInfo(day);
                const hasBooking = info.bookings.length > 0;
                const hasBlock = info.blocks.length > 0;
                const isClickable = hasBooking || hasBlock;

                let cellBg = '';
                let cellAccent = '';

                if (hasBooking) {
                  const sc = getSourceColors(info.bookings[0].source);
                  cellBg = sc.bg;
                  cellAccent = sc.border;
                } else if (hasBlock) {
                  cellBg = BLOCKED_COLORS.bg;
                  cellAccent = BLOCKED_COLORS.border;
                }

                return (
                  <div
                    key={idx}
                    className={`
                      relative min-h-[80px] border-b border-r p-1.5 transition-all
                      ${isClickable ? 'cursor-pointer hover:brightness-[0.97]' : ''}
                      ${inMonth ? '' : 'opacity-30'}
                      ${cellBg}
                      ${cellAccent ? `border-l-[3px] ${cellAccent}` : ''}
                      ${isToday ? 'ring-2 ring-primary/30 ring-inset' : ''}
                    `}
                    onClick={() => inMonth && handleDayClick(day)}
                  >
                    <span className={`
                      text-xs font-medium block text-right
                      ${isToday
                        ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center ml-auto text-[11px]'
                        : inMonth ? 'text-foreground' : 'text-muted-foreground'}
                    `}>
                      {format(day, 'd')}
                    </span>

                    <div className="mt-1 space-y-0.5">
                      {info.bookings.slice(0, 2).map(b => {
                        const sc = getSourceColors(b.source);
                        return (
                          <div
                            key={b.id}
                            className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate ${sc.text}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${sc.dot} shrink-0`} />
                            <span className="truncate">{b.nome_ospite}</span>
                          </div>
                        );
                      })}
                      {info.bookings.length > 2 && (
                        <div className="text-[9px] text-muted-foreground pl-1">
                          +{info.bookings.length - 2} altre
                        </div>
                      )}
                      {info.blocks.length > 0 && !hasBooking && (
                        <div className="flex items-center gap-1 text-[9px] text-amber-600 font-medium pl-1">
                          <Ban className="w-2.5 h-2.5" />
                          <span className="truncate">{info.blocks[0].reason || 'Bloccato'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista prenotazioni del mese sotto il calendario */}
        {monthSummary.length > 0 && (
          <div className="p-4 border-t">
            <h3 className="text-sm font-semibold mb-3">
              Prenotazioni di {format(currentMonth, 'MMMM', { locale: it })}
            </h3>
            <ScrollArea className="max-h-[240px]">
              <div className="space-y-1.5">
                {monthSummary.map(b => {
                  const sc = getSourceColors(b.source);
                  const nights = differenceInCalendarDays(parseISO(b.data_fine), parseISO(b.data_inizio));
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border ${sc.border} ${sc.bg} cursor-pointer hover:brightness-[0.97] transition-all`}
                      onClick={() => setSelectedItem({ type: 'booking', data: b })}
                    >
                      <div className={`w-1 h-8 rounded-full ${sc.dot} shrink-0`} />
                      <User className={`w-4 h-4 ${sc.text} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.nome_ospite}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(parseISO(b.data_inizio), 'dd MMM', { locale: it })} - {format(parseISO(b.data_fine), 'dd MMM', { locale: it })} ({nights} {nights === 1 ? 'notte' : 'notti'})
                        </p>
                      </div>
                      {b.property_name && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                          {b.property_name}
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[9px] ${sc.text} ${sc.border} shrink-0`}>
                        {sourceLabel(b.source)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Sheet dettaglio prenotazione */}
      <Sheet open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <SheetContent className="sm:max-w-md w-[95vw] overflow-y-auto">
          {selectedItem?.type === 'booking' && (
            <BookingDetail
              booking={selectedItem.data}
              notes={notes}
              loadingNotes={loadingNotes}
              noteText={noteText}
              setNoteText={setNoteText}
              onAddNote={handleAddNote}
              addingNote={addNote.isPending}
              onDeleteNote={handleDeleteNote}
              onNavigate={navigateTo}
            />
          )}
          {selectedItem?.type === 'blocked' && (
            <BlockedDetail blocked={selectedItem.data} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// --- Sotto-componenti ---

function BookingDetail({
  booking, notes, loadingNotes, noteText, setNoteText, onAddNote, addingNote, onDeleteNote, onNavigate,
}: {
  booking: CalendarBooking;
  notes: any[];
  loadingNotes: boolean;
  noteText: string;
  setNoteText: (v: string) => void;
  onAddNote: () => void;
  addingNote: boolean;
  onDeleteNote: (id: string) => void;
  onNavigate: (path: string) => void;
}) {
  const sc = getSourceColors(booking.source);
  const nights = differenceInCalendarDays(parseISO(booking.data_fine), parseISO(booking.data_inizio));

  const navLinks = [
    { label: 'Prenotazioni', path: '/bookings', icon: CalendarIcon, description: 'Vai alla lista prenotazioni' },
    { label: 'Pagamenti', path: '/revenue', icon: CreditCard, description: 'Incassi e pagamenti' },
    { label: 'Documenti', path: '/accoglienza/documenti', icon: FileText, description: 'Documenti ospite' },
    { label: 'Messaggi', path: '/messaggi', icon: MessageCircle, description: 'Comunicazioni' },
    { label: 'Ticket', path: '/tickets', icon: Ticket, description: 'Segnalazioni e guasti' },
  ];

  return (
    <div className="space-y-6 pt-2">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${sc.bg}`}>
            <User className={`w-5 h-5 ${sc.text}`} />
          </div>
          <div className="min-w-0">
            <div className="truncate">{booking.nome_ospite}</div>
            <div className="text-xs font-normal text-muted-foreground">{sourceLabel(booking.source)}</div>
          </div>
        </SheetTitle>
      </SheetHeader>

      {/* Info prenotazione */}
      <div className="grid grid-cols-2 gap-3">
        <InfoCard label="Check-in" value={format(parseISO(booking.data_inizio), 'dd MMM yyyy', { locale: it })} />
        <InfoCard label="Check-out" value={format(parseISO(booking.data_fine), 'dd MMM yyyy', { locale: it })} />
        <InfoCard label="Notti" value={`${nights}`} />
        <InfoCard label="Ospiti" value={booking.numero_ospiti ? `${booking.numero_ospiti}` : '-'} />
        {booking.property_name && (
          <InfoCard label="Proprieta" value={booking.property_name} className="col-span-2" />
        )}
        {booking.importo_totale && (
          <InfoCard label="Importo" value={`${booking.importo_totale.toFixed(2)} EUR`} />
        )}
        <InfoCard label="Stato" value={booking.checkin_status || 'pending'} />
      </div>

      {/* Contatti */}
      {(booking.email_ospite || booking.telefono_ospite) && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contatti</h4>
          {booking.email_ospite && (
            <p className="text-sm">{booking.email_ospite}</p>
          )}
          {booking.telefono_ospite && (
            <p className="text-sm">{booking.telefono_ospite}</p>
          )}
        </div>
      )}

      {/* Note */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5" />
          Note
        </h4>

        <div className="flex gap-2">
          <Textarea
            placeholder="Scrivi una nota..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onAddNote();
              }
            }}
          />
          <Button
            size="icon"
            variant="outline"
            className="shrink-0 self-end"
            onClick={onAddNote}
            disabled={!noteText.trim() || addingNote}
          >
            {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {loadingNotes ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map(note => (
              <div key={note.id} className="group flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(parseISO(note.created_at), "dd MMM yyyy, HH:mm", { locale: it })}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Nessuna nota</p>
        )}
      </div>

      {/* Navigazione rapida */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ExternalLink className="w-3.5 h-3.5" />
          Naviga a
        </h4>
        <div className="grid grid-cols-1 gap-1.5">
          {navLinks.map(link => {
            const Icon = link.icon;
            return (
              <button
                key={link.path}
                onClick={() => onNavigate(link.path)}
                className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors text-left w-full"
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-[11px] text-muted-foreground">{link.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockedDetail({ blocked }: { blocked: CalendarBlockedDate }) {
  const nights = differenceInCalendarDays(parseISO(blocked.date_end), parseISO(blocked.date_start));

  return (
    <div className="space-y-6 pt-2">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${BLOCKED_COLORS.bg}`}>
            <Ban className={`w-5 h-5 ${BLOCKED_COLORS.text}`} />
          </div>
          <div className="min-w-0">
            <div className="truncate">{blocked.reason || 'Date bloccate'}</div>
            <div className="text-xs font-normal text-muted-foreground">{sourceLabel(blocked.source)}</div>
          </div>
        </SheetTitle>
      </SheetHeader>

      <div className="grid grid-cols-2 gap-3">
        <InfoCard label="Da" value={format(parseISO(blocked.date_start), 'dd MMM yyyy', { locale: it })} />
        <InfoCard label="A" value={format(parseISO(blocked.date_end), 'dd MMM yyyy', { locale: it })} />
        <InfoCard label="Giorni" value={`${nights}`} />
        {blocked.property_name && (
          <InfoCard label="Proprieta" value={blocked.property_name} />
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-lg bg-muted/40 p-2.5 ${className}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}
