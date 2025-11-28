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
  onUpdate: () => void;
}

export default function TicketManager({ ticket, isOpen, onClose, onUpdate }: TicketManagerProps) {
  const { toast } = useToast();
  
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedColleague, setSelectedColleague] = useState<string>('');

  useEffect(() => {
    setNotes(ticket?.admin_notes || '');
  }, [ticket]);

  const { data: colleagues } = useQuery({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
  });

  const saveNotes = async () => {
    const { error } = await supabase
      .from('tickets')
      .update({ admin_notes: notes })
      .eq('id', ticket.id);

    if (error) toast({ title: "Errore", variant: "destructive" });
    else {
      toast({ title: "Note salvate", description: "Aggiornamento registrato." });
      onUpdate();
    }
  };

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

  // --- LOGICA MESSAGGI WHATSAPP POTENZIATA ---

  const sendToColleague = () => {
    if (!selectedColleague) return;
    
    // Costruiamo il messaggio completo
    const msg = `Ciao, ti delego questo ticket.\n\n` +
                `🎫 *TICKET:* ${ticket.titolo}\n` +
                `📝 *DESCRIZIONE:* "${ticket.descrizione}"\n\n` +
                `📌 *AGGIORNAMENTO:* Ho messo a promemoria per me e l'ospite che: ${notes || 'Nessuna nota aggiuntiva.'}\n` +
                `🗓️ *SCADENZA:* ${date ? format(date, 'dd/MM/yyyy') : 'Da definire'}`;

    window.open(`https://wa.me/${selectedColleague}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendToGuest = () => {
    const phone = ticket.bookings?.telefono_ospite;
    if (!phone) {
        toast({ title: "Manca telefono ospite", variant: "destructive" });
        return;
    }

    const msg = `Gentile ${ticket.bookings?.nome_ospite},\n` +
                `in merito alla tua segnalazione: *"${ticket.titolo}"*\n\n` +
                `ℹ️ *AGGIORNAMENTO:* ${notes || 'Abbiamo preso in carico la richiesta.'}\n` +
                `🗓️ *INTERVENTO:* ${date ? format(date, 'dd/MM/yyyy') : 'Data da definire'}\n\n` +
                `Cordiali saluti.`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- CALENDARIO GOOGLE ---
  const addToCalendar = () => {
    if (!date) return;
    const title = `Intervento: ${ticket.titolo}`;
    // Anche nel calendario mettiamo tutto il testo
    const details = `PROBLEMA: ${ticket.descrizione}\n\nAGGIORNAMENTO: ${notes}\n\nPRESSO: ${ticket.bookings?.properties_real?.nome}`;
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
            Originale: "{ticket.descrizione}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          
          {/* 1. NOTE OPERATIVE */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="text-blue-800 font-bold mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" /> 1. Aggiornamento & Azioni
            </Label>
            <Textarea 
              placeholder="Scrivi qui lo stato avanzamento (es. Chiamato idraulico, attendo pezzo di ricambio...)" 
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

          {/* 2. PIANIFICAZIONE */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="text-orange-800 font-bold mb-4 flex items-center gap-2">
              <Share2 className="w-4 h-4" /> 2. Pianificazione & Delega
            </Label>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-500 uppercase">Calendario</Label>
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
                    onClick={sendToColleague} // Usa la nuova funzione ricca
                    disabled={!selectedColleague}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. CHIUSURA */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="text-green-800 font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> 3. Azioni sull'Ospite & Chiusura
            </Label>
            
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="border-green-200 text-green-700 hover:bg-green-50 h-auto py-3 flex flex-col gap-1"
                onClick={sendToGuest} // Usa la nuova funzione ricca
              >
                <MessageCircle className="w-5 h-5 mb-1" />
                <span>Aggiorna Ospite</span>
                <span className="text-[10px] font-normal opacity-70">Invia stato avanzamento</span>
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