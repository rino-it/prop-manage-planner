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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, MessageCircle, CheckCircle, Save, UserCog, Send, Clock, Share2, Euro, Hammer, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface TicketManagerProps {
  ticket: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  isReadOnly?: boolean;
}

export default function TicketManager({ ticket, isOpen, onClose, onUpdate, isReadOnly = false }: TicketManagerProps) {
  const { toast } = useToast();
  
  // STATI
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedColleague, setSelectedColleague] = useState<string>('');
  
  // STATI PER CHIUSURA
  const [recordCost, setRecordCost] = useState(false);
  const [costAmount, setCostAmount] = useState(ticket?.cost || '');
  const [resolutionPhoto, setResolutionPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setNotes(ticket?.admin_notes || '');
    setSupplier(ticket?.supplier || '');
    setCostAmount(ticket?.cost || '');
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
      toast({ title: "Note Salvate", description: "Aggiornamento registrato (Ticket ancora aperto)." });
      onUpdate();
    }
  };

  const handleResolve = async () => {
    if(!confirm("Confermi di voler chiudere il ticket?")) return;

    try {
        setUploading(true);
        let photoUrl = ticket.resolution_photo_url;

        if (resolutionPhoto) {
            const fileExt = resolutionPhoto.name.split('.').pop();
            const fileName = `resolution_${ticket.id}_${Date.now()}.${fileExt}`;
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, resolutionPhoto);
            if (upError) throw upError;
            photoUrl = fileName;
        }

        const { error: ticketError } = await supabase
            .from('tickets')
            .update({ 
                stato: 'risolto',
                resolution_photo_url: photoUrl,
                cost: recordCost ? parseFloat(costAmount) : null,
                supplier: supplier,
                admin_notes: notes 
            })
            .eq('id', ticket.id);

        if (ticketError) throw ticketError;

        toast({ title: "Ticket Risolto!", description: "Archiviato con successo." });
        onUpdate();
        onClose();

    } catch (error: any) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
        setUploading(false);
    }
  };

  // COMUNICAZIONE
  const sendToColleague = () => {
    if (!selectedColleague) return;
    const msg = `Ciao, ti delego questo ticket.\n\n🎫 *TICKET:* ${ticket.titolo}\n🛠️ *FORNITORE:* ${supplier || 'Non assegnato'}\n📌 *NOTE:* ${notes}\n🗓️ *SCADENZA:* ${date ? format(date, 'dd/MM/yyyy') : 'Da definire'}`;
    window.open(`https://wa.me/${selectedColleague}?text=${encodeURIComponent(msg)}`, '_blank');
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
            {isReadOnly ? <CheckCircle className="w-6 h-6 text-green-600" /> : <UserCog className="w-6 h-6 text-blue-600" />}
            {isReadOnly ? `Storico Ticket: ${ticket.titolo}` : `Gestione Ticket: ${ticket.titolo}`}
          </DialogTitle>
          <DialogDescription>
            Richiesta originale: "{ticket.descrizione}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          
          {/* SEZIONE 1: LAVORAZIONE (Abilitata solo se non risolto) */}
          <div className={`p-4 rounded-lg border ${isReadOnly ? 'bg-gray-50 border-gray-200 opacity-80' : 'bg-blue-50 border-blue-200'}`}>
            <Label className="text-blue-900 font-bold mb-3 flex items-center gap-2 uppercase text-xs tracking-wider">
              <Clock className="w-4 h-4" /> Lavorazione & Note Interne
            </Label>
            
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">Fornitore / Tecnico</Label>
                        <div className="relative">
                            <Hammer className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="Es. Idraulico Mario" 
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                                className="pl-8 bg-white"
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>
                    
                    {/* DELEGA & CALENDARIO */}
                    {!isReadOnly && (
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <Label className="text-xs text-gray-500 mb-1.5 block">Pianifica / Delega</Label>
                             <div className="flex gap-1">
                                <Popover>
                                    <PopoverTrigger asChild><Button variant={"outline"} className="flex-1 bg-white px-2"><CalendarIcon className="h-4 w-4" /></Button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
                                </Popover>
                                <Button variant="outline" onClick={addToCalendar} title="Salva su Google Cal"><Save className="w-4 h-4" /></Button>
                                <Select onValueChange={setSelectedColleague}>
                                    <SelectTrigger className="bg-white flex-1"><SelectValue placeholder="Socio..." /></SelectTrigger>
                                    <SelectContent>{colleagues?.map((col) => (<SelectItem key={col.id} value={col.phone}>{col.first_name}</SelectItem>))}</SelectContent>
                                </Select>
                                <Button className="bg-green-600 hover:bg-green-700" onClick={sendToColleague} disabled={!selectedColleague}><Send className="w-4 h-4" /></Button>
                             </div>
                        </div>
                    </div>
                    )}
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1.5">
                        <Label className="text-xs text-gray-500">Diario di Bordo (Note)</Label>
                        {!isReadOnly && (
                            <div className="flex items-center gap-2">
                                <Label htmlFor="share-switch" className="text-[10px] text-blue-600 cursor-pointer">Visibile all'Ospite?</Label>
                                <Switch 
                                    id="share-switch" 
                                    checked={ticket.share_notes} 
                                    onCheckedChange={async (checked) => {
                                        await supabase.from('tickets').update({ share_notes: checked }).eq('id', ticket.id);
                                        onUpdate(); 
                                        toast({ title: checked ? "Note Pubbliche" : "Note Private", description: checked ? "L'ospite ora vede queste note." : "L'ospite non vede più queste note." });
                                    }} 
                                />
                            </div>
                        )}
                    </div>
                    <Textarea 
                        placeholder="Es: Sopralluogo effettuato, in attesa del pezzo di ricambio..." 
                        value={notes} 
                        onChange={(e) => setNotes(e.target.value)}
                        className={`min-h-[80px] ${ticket.share_notes ? 'border-blue-300 bg-blue-50' : 'bg-white'}`}
                        disabled={isReadOnly}
                    />
                    {ticket.share_notes && <p className="text-[10px] text-blue-600 mt-1 text-right">* Queste note sono visibili all'ospite nel suo portale.</p>}
                </div>

                {!isReadOnly && (
                    <div className="flex justify-end">
                        <Button size="sm" variant="secondary" onClick={saveUpdates} className="text-blue-700 bg-blue-100 hover:bg-blue-200">
                            <Save className="w-3 h-3 mr-2" /> Salva solo note
                        </Button>
                    </div>
                )}
            </div>
          </div>

          {!isReadOnly && <Separator className="my-4" />}

          {/* SEZIONE 2: CHIUSURA (Visibile solo se aperto) */}
          {!isReadOnly ? (
          <div className="p-5 rounded-lg border border-green-200 bg-green-50/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
            <Label className="text-green-800 font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-wider">
              <CheckCircle className="w-4 h-4" /> Risoluzione & Chiusura
            </Label>
            
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4 border-r border-green-200 pr-4">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                            <Euro className="w-4 h-4 text-gray-500" />
                            Ci sono stati costi?
                        </Label>
                        <Switch checked={recordCost} onCheckedChange={setRecordCost} />
                    </div>
                    
                    {recordCost && (
                        <Input 
                            type="number" 
                            placeholder="Importo Totale (€)" 
                            value={costAmount} 
                            onChange={(e) => setCostAmount(e.target.value)} 
                            className="bg-white border-green-200"
                        />
                    )}

                    <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Foto Risoluzione (Opzionale)</Label>
                        <Input 
                            type="file" 
                            className="text-xs bg-white" 
                            onChange={(e) => setResolutionPhoto(e.target.files?.[0] || null)}
                        />
                    </div>
                </div>

                <div className="flex flex-col justify-end gap-3">
                    <p className="text-xs text-gray-500 mb-1">L'azione è definitiva. Il ticket passerà in "Risolto".</p>
                    <Button 
                        className="w-full bg-green-600 hover:bg-green-700 py-6 text-md font-bold shadow-sm transition-all hover:scale-[1.02]"
                        onClick={handleResolve}
                        disabled={uploading}
                    >
                        {uploading ? "Chiusura in corso..." : "✅ CHIUDI TICKET"}
                    </Button>
                </div>
            </div>
          </div>
          ) : (
            // VIEW SOLA LETTURA CHIUSURA
            <div className="p-4 rounded-lg border bg-gray-50 border-gray-200">
                <h4 className="font-bold text-sm text-gray-700 mb-2">Dettagli Chiusura</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500 block text-xs">Costo Finale:</span>
                        <span className="font-mono font-bold">€ {ticket.cost || '0.00'}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs">Foto:</span>
                        {ticket.resolution_photo_url ? <a href="#" className="text-blue-600 underline text-xs">Vedi Foto</a> : <span className="text-gray-400 text-xs">Nessuna</span>}
                    </div>
                </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}