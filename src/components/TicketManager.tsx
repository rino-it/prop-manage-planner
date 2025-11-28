import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, MessageCircle, CheckCircle, Save, UserCog, Send, Clock, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface TicketManagerProps {
  ticket: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void; // Per ricaricare la lista padre
}

export default function TicketManager({ ticket, isOpen, onClose, onUpdate }: TicketManagerProps) {
  const { toast } = useToast();
  
  // Stati Locali
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedColleague, setSelectedColleague] = useState<string>('');

  // Sincronizza note se cambia il ticket
  useEffect(() => {
    setNotes(ticket?.admin_notes || '');
  }, [ticket]);

  // 1. CARICA COLLEGHI (Altri Admin/Proprietari)
  const { data: colleagues } = useQuery({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
  });

  // AZIONE: Salva Note
  const saveNotes = async () => {
    const { error } = await supabase
      .from('tickets')
      .update({ admin_notes: notes })
      .eq('id', ticket.id);

    if (error) toast({ title: "Errore", variant: "destructive" });
    else {
      toast({ title: "Aggiornamento salvato", description: "Le note sono state aggiornate." });
      onUpdate();
    }
  };

  // AZIONE: Risolvi Ticket
  const resolveTicket = async () => {
    const { error } = await supabase
      .from('tickets')
      .update({ stato: 'risolto' })
      .eq('id', ticket.id);

    if (error) toast({ title: "Errore", variant: "destructive" });
    else {
      toast({ title: "Ticket Chiuso", description: "Ottimo lavoro!" });
      onUpdate();
      onClose();
    }
  };

  // HELPER: WhatsApp Generator
  const sendWhatsApp = (phone: string | null, message: string) => {
    if (!phone) {
      toast({ title: "Nessun telefono", description: "Manca il numero di telefono.", variant: "destructive" });
      return;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // HELPER: Google Calendar
  const addToCalendar = () => {
    if (!date) return;
    const title = `Intervento: ${ticket.titolo}`;
    const details = `Stato: ${notes}\nPresso: ${ticket.bookings?.properties_real?.nome}`;
    const d = format(date, 'yyyyMMdd');
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&dates=${d}/${d}`;
    window.open(url, '_blank');
  };

  if (!ticket) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserCog className="w-6 h-6 text-blue-600" />
            Gestione Ticket: {ticket.titolo}
          </DialogTitle>
          <DialogDescription>
            Ospite: {ticket.bookings?.nome_ospite} • Immobile: {ticket.bookings?.properties_real?.nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          
          {/* SEZIONE 1: AGGIORNAMENTO & AZIONI */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="text-blue-800 font-bold mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" /> 1. Stato Avanzamento & Note
            </Label>
            <Textarea 
              placeholder="Es: Contattato idraulico, attendo preventivo..." 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              className="bg-white min-h-[80px]"
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="outline" onClick={saveNotes}>
                <Save className="w-4 h-4 mr-2" /> Salva Note
              </Button>
            </div>
          </div>

          {/* SEZIONE 2: PIANIFICAZIONE & DELEGA */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="text-orange-800 font-bold mb-4 flex items-center gap-2">
              <Share2 className="w-4 h-4" /> 2. Pianificazione & Delega
            </Label>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Colonna A: Calendario */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500 uppercase">Aggiungi a Calendario</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "dd/MM/yyyy") : <span>Scegli data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <Button size="icon" onClick={addToCalendar} title="Google Calendar">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                  </Button>
                </div>
              </div>

              {/* Colonna B: Delega Colleghi */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500 uppercase">Delega a Collega</Label>
                <div className="flex gap-2">
                  <Select onValueChange={setSelectedColleague}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {colleagues?.map((col) => (
                        <SelectItem key={col.id} value={col.phone}>
                          {col.first_name || 'Admin'} ({col.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="icon" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => sendWhatsApp(selectedColleague, `Ciao, ti delego il ticket "${ticket.titolo}". Note: ${notes}`)}
                    disabled={!selectedColleague}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* SEZIONE 3: CHIUSURA & INTERVENTO */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="text-green-800 font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> 3. Azioni sull'Ospite & Chiusura
            </Label>
            
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="border-green-200 text-green-700 hover:bg-green-50 h-auto py-3 flex flex-col gap-1"
                onClick={() => sendWhatsApp(
                  ticket.bookings?.telefono_ospite, 
                  `Gentile ${ticket.bookings?.nome_ospite}, in merito al ticket "${ticket.titolo}": ${notes || 'Intervento programmato'}. Data prevista: ${date ? format(date, 'dd/MM') : 'da definire'}.`
                )}
              >
                <MessageCircle className="w-5 h-5 mb-1" />
                <span>Avvisa Ospite</span>
                <span className="text-[10px] font-normal opacity-70">Invia data intervento</span>
              </Button>

              <Button 
                className="bg-green-600 hover:bg-green-700 h-auto py-3 flex flex-col gap-1"
                onClick={resolveTicket}
              >
                <CheckCircle className="w-5 h-5 mb-1" />
                <span>Chiudi Ticket</span>
                <span className="text-[10px] font-normal opacity-70">Segna come Risolto</span>
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}