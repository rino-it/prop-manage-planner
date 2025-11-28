import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch'; // Assicurati di avere questo componente o usa una checkbox
import { format } from 'date-fns';
import { Calendar as CalendarIcon, MessageCircle, CheckCircle, Save, UserCog, Send, Clock, Share2, Upload, Euro, Hammer, Image as ImageIcon } from 'lucide-react';
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
  
  // STATI
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedColleague, setSelectedColleague] = useState<string>('');
  
  // STATI PER CHIUSURA
  const [recordCost, setRecordCost] = useState(false);
  const [costAmount, setCostAmount] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setNotes(ticket?.admin_notes || '');
    setSupplier(ticket?.supplier || '');
  }, [ticket]);

  const { data: colleagues } = useQuery({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
  });

  const saveUpdates = async () => {
    const { error } = await supabase
      .from('tickets')
      .update({ 
        admin_notes: notes,
        supplier: supplier 
      })
      .eq('id', ticket.id);

    if (error) toast({ title: "Errore", variant: "destructive" });
    else {
      toast({ title: "Aggiornamento salvato", description: "Note e fornitore registrati." });
      onUpdate();
    }
  };

  const handleResolve = async () => {
    try {
        setUploading(true);
        let photoUrl = null;

        // 1. UPLOAD FOTO (Se presente)
        if (resolutionPhoto) {
            const fileExt = resolutionPhoto.name.split('.').pop();
            const fileName = `resolution_${ticket.id}_${Date.now()}.${fileExt}`;
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, resolutionPhoto);
            if (upError) throw upError;
            photoUrl = fileName;
        }

        // 2. REGISTRA SPESA (Se attivo)
        if (recordCost && costAmount) {
            const { error: expError } = await supabase.from('maintenance_expenses').insert({
                ticket_id: ticket.id,
                property_id: ticket.property_real_id, // Assumiamo che il ticket abbia questo campo o lo prendiamo dalla booking
                amount: parseFloat(costAmount),
                description: `Risoluzione Ticket: ${ticket.titolo}`,
                supplier: supplier,
                date: new Date().toISOString()
            });
            if (expError) throw expError;
        }

        // 3. CHIUDI TICKET
        const { error: ticketError } = await supabase
            .from('tickets')
            .update({ 
                stato: 'risolto',
                resolution_photo_url: photoUrl,
                cost: recordCost ? parseFloat(costAmount) : null,
                supplier: supplier // Risalva per sicurezza
            })
            .eq('id', ticket.id);

        if (ticketError) throw ticketError;

        toast({ title: "Ticket Risolto!", description: "Tutte le operazioni sono state registrate." });
        onUpdate();
        onClose();

    } catch (error: any) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
        setUploading(false);
    }
  };

  // HELPERS COMUNICAZIONE (Invariati o arricchiti con fornitore)
  const sendToColleague = () => {
    if (!selectedColleague) return;
    const msg = `Ciao, ti delego questo ticket.\n\n🎫 *TICKET:* ${ticket.titolo}\n🛠️ *FORNITORE:* ${supplier || 'Non assegnato'}\n📌 *NOTE:* ${notes}\n🗓️ *SCADENZA:* ${date ? format(date, 'dd/MM/yyyy') : 'Da definire'}`;
    window.open(`https://wa.me/${selectedColleague}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendToGuest = () => {
    const phone = ticket.bookings?.telefono_ospite;
    if (!phone) return toast({ title: "Manca telefono", variant: "destructive" });
    const msg = `Gentile ${ticket.bookings?.nome_ospite}, ticket "${ticket.titolo}" aggiornato.\n\nℹ️ *STATO:* ${notes}\n🗓️ *INTERVENTO:* ${date ? format(date, 'dd/MM/yyyy') : 'In definizione'}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const addToCalendar = () => {
    if (!date) return;
    const title = `Intervento: ${ticket.titolo}`;
    const details = `Fornitore: ${supplier}\nNote: ${notes}\nPresso: ${ticket.bookings?.properties_real?.nome}`;
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
          
          {/* 1. AGGIORNAMENTO & FORNITORI */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="text-blue-800 font-bold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> 1. Aggiornamento & Fornitore
            </Label>
            
            <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                        <Label className="text-xs text-gray-500">Note Avanzamento</Label>
                        <Textarea 
                            placeholder="Es: Sopralluogo effettuato..." 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            className="bg-white min-h-[40px] h-10"
                        />
                    </div>
                    <div>
                        <Label className="text-xs text-gray-500">Fornitore Coinvolto</Label>
                        <div className="relative">
                            <Hammer className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="Es. Idraulico Mario" 
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                                className="pl-8 bg-white"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={saveUpdates} className="h-8">
                        <Save className="w-3 h-3 mr-2" /> Salva Intermedio
                    </Button>
                </div>
            </div>
          </div>

          {/* 2. PIANIFICAZIONE (Invariato ma compatto) */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="text-orange-800 font-bold mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4" /> 2. Pianificazione
            </Label>
            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <Label className="text-xs text-gray-500">Data Intervento</Label>
                    <Popover>
                        <PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start text-left font-normal bg-white"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "dd/MM/yyyy") : <span>Scegli data</span>}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
                    </Popover>
                </div>
                <Button variant="outline" onClick={addToCalendar} title="Google Calendar"><CalendarIcon className="w-4 h-4" /></Button>
                <div className="flex-1">
                    <Label className="text-xs text-gray-500">Delega a</Label>
                    <Select onValueChange={setSelectedColleague}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Collega..." /></SelectTrigger>
                        <SelectContent>{colleagues?.map((col) => (<SelectItem key={col.id} value={col.phone}>{col.first_name}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <Button className="bg-green-600 hover:bg-green-700" onClick={sendToColleague} disabled={!selectedColleague}><Send className="w-4 h-4" /></Button>
            </div>
          </div>

          {/* 3. CHIUSURA & CONTABILITÀ (NUOVO!) */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="text-green-800 font-bold mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> 3. Chiusura & Contabilità
            </Label>
            
            <div className="grid md:grid-cols-2 gap-6">
                {/* Colonna Sinistra: Costi e Foto */}
                <div className="space-y-4 border-r border-slate-200 pr-4">
                    
                    {/* Toggle Costo */}
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 cursor-pointer">
                            <Euro className="w-4 h-4 text-gray-500" />
                            Registra Costo
                        </Label>
                        <Switch checked={recordCost} onCheckedChange={setRecordCost} />
                    </div>
                    
                    {recordCost && (
                        <Input 
                            type="number" 
                            placeholder="Importo (€)" 
                            value={costAmount} 
                            onChange={(e) => setCostAmount(e.target.value)} 
                            className="bg-white"
                        />
                    )}

                    {/* Upload Foto */}
                    <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Prova Risoluzione (Foto)</Label>
                        <div className="flex items-center gap-2">
                            <Input 
                                type="file" 
                                className="text-xs" 
                                onChange={(e) => setResolutionPhoto(e.target.files?.[0] || null)}
                            />
                            {resolutionPhoto && <CheckCircle className="w-4 h-4 text-green-500" />}
                        </div>
                    </div>
                </div>

                {/* Colonna Destra: Azioni Finali */}
                <div className="flex flex-col gap-3 justify-center">
                    <Button 
                        variant="outline" 
                        className="w-full justify-start text-green-700 border-green-200 hover:bg-green-50"
                        onClick={sendToGuest}
                    >
                        <MessageCircle className="w-4 h-4 mr-2" /> Aggiorna Ospite
                    </Button>

                    <Button 
                        className="w-full bg-green-600 hover:bg-green-700 py-6 text-md font-bold shadow-md"
                        onClick={handleResolve}
                        disabled={uploading}
                    >
                        {uploading ? (
                            "Salvataggio..."
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5 mr-2" /> 
                                {recordCost ? `Chiudi e Spendi €${costAmount || '0'}` : 'Chiudi Ticket'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}