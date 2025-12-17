import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, Save, User, Send, Clock, 
  Euro, FileText, Share2, Hammer, Eye, Upload, AlertTriangle, XCircle 
} from 'lucide-react';
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
  
  // --- DATI ORIGINALI (TAB 1 & 3) ---
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [shareNotes, setShareNotes] = useState(ticket?.share_notes || false);
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [supplierContact, setSupplierContact] = useState(''); 
  const [assignedPartner, setAssignedPartner] = useState('');
  
  const [costAmount, setCostAmount] = useState(ticket?.cost || '');
  const [costVisible, setCostVisible] = useState(ticket?.spesa_visibile_ospite || false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  // --- NUOVI DATI (TAB 2: PREVENTIVO) ---
  const [quoteAmount, setQuoteAmount] = useState(ticket?.quote_amount || '');
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);

  // Recupera soci per la delega (LOGICA ORIGINALE)
  const { data: colleagues } = useQuery({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
  });

  // --- AZIONI ORIGINALI ---
  
  // SALVA STATO PARZIALE
  const saveProgress = async () => {
    const { error } = await supabase
      .from('tickets')
      .update({ 
        admin_notes: notes,
        share_notes: shareNotes,
        supplier: supplier,
        stato: 'in_lavorazione' 
      })
      .eq('id', ticket.id);

    if (error) toast({ title: "Errore", variant: "destructive" });
    else {
      toast({ title: "Salvato", description: "Modifiche registrate." });
      onUpdate();
    }
  };

  // DELEGA WHATSAPP
  const handleDelegate = () => {
    if (!assignedPartner) return toast({ title: "Chi se ne occupa?", description: "Seleziona un socio prima di delegare.", variant: "destructive" });
    
    const partner = colleagues?.find(c => c.phone === assignedPartner || c.id === assignedPartner);
    const phone = partner?.phone || assignedPartner;

    const text = `Ciao, ti delego questo ticket:\n\n🏠 *${ticket.bookings?.properties_real?.nome}*\n⚠️ *${ticket.titolo}*\n📝 Note: ${notes}\n🛠 Fornitore suggerito: ${supplier}\n\nFammi sapere quando è risolto.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- NUOVE AZIONI (PREVENTIVI) ---

  // UPLOAD PREVENTIVO
  const handleQuoteUpload = async () => {
      setUploading(true);
      try {
        let finalUrl = ticket.quote_url;
        if (quoteFile) {
           const fileName = `quote_${ticket.id}_${Date.now()}.${quoteFile.name.split('.').pop()}`;
           const { error: upError } = await supabase.storage.from('documents').upload(fileName, quoteFile);
           if (upError) throw upError;
           finalUrl = fileName;
        }

        const { error } = await supabase.from('tickets')
          .update({
            quote_amount: parseFloat(quoteAmount),
            quote_url: finalUrl,
            quote_status: 'pending', // Invia in approvazione
            stato: 'in_attesa'
          })
          .eq('id', ticket.id);

        if (error) throw error;
        toast({ title: "Preventivo Caricato", description: "In attesa di approvazione." });
        onUpdate();
        onClose();
      } catch (e: any) { 
          toast({ title: "Errore", description: e.message, variant: "destructive" }); 
      } finally { setUploading(false); }
  };

  // APPROVA / RIFIUTA
  const handleQuoteDecision = async (decision: 'approved' | 'rejected') => {
      const newState = decision === 'approved' ? 'in_corso' : 'aperto';
      const { error } = await supabase
        .from('tickets')
        .update({ quote_status: decision, stato: newState })
        .eq('id', ticket.id);
      
      if (error) toast({ title: "Errore", variant: "destructive" });
      else {
          toast({ title: decision === 'approved' ? "Preventivo Approvato" : "Preventivo Rifiutato" });
          onUpdate();
          onClose();
      }
  };

  // --- AZIONI ORIGINALI (CHIUSURA) ---

  const handleResolveFlow = async () => {
    try {
        setUploading(true);
        let receiptUrl = ticket.ricevuta_url;

        if (receiptFile) {
            const fileExt = receiptFile.name.split('.').pop();
            const fileName = `receipt_${ticket.id}_${Date.now()}.${fileExt}`;
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, receiptFile);
            if (upError) throw upError;
            receiptUrl = fileName;
        }

        const finalStatus = 'in_verifica'; 

        const { error } = await supabase
            .from('tickets')
            .update({ 
                stato: finalStatus,
                cost: parseFloat(costAmount) || 0,
                ricevuta_url: receiptUrl,
                spesa_visibile_ospite: costVisible,
                admin_notes: notes,
                share_notes: shareNotes 
            })
            .eq('id', ticket.id);

        if (error) throw error;

        toast({ title: "Ticket Completato", description: "In attesa di conferma dall'ospite." });
        onUpdate();
        onClose();

    } catch (error: any) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
        setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 p-1 rounded"><Hammer className="w-5 h-5"/></span>
            Gestione: {ticket.titolo}
          </DialogTitle>
          <DialogDescription>
            Aperto il {format(new Date(ticket.created_at), 'dd/MM/yyyy')} da {ticket.creato_da}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="management" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="management">1. Gestione</TabsTrigger>
                <TabsTrigger value="quote">2. Preventivo</TabsTrigger>
                <TabsTrigger value="closing">3. Chiusura</TabsTrigger>
            </TabsList>

            {/* TAB 1: OPERATIVITÀ (Tuo Codice Originale) */}
            <TabsContent value="management" className="space-y-4 py-4">
                
                {/* Assegnazione Fornitore */}
                <div className="grid gap-2 p-3 bg-slate-50 rounded border">
                    <Label className="text-slate-700 font-semibold">Chi interviene? (Fornitore)</Label>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Nome Ditta / Operaio" 
                            value={supplier} 
                            onChange={e => setSupplier(e.target.value)} 
                            className="bg-white"
                            disabled={isReadOnly}
                        />
                        <Input 
                            placeholder="Tel. Fornitore" 
                            value={supplierContact} 
                            onChange={e => setSupplierContact(e.target.value)} 
                            className="bg-white w-1/3"
                            disabled={isReadOnly}
                        />
                    </div>
                </div>

                {/* Note Interne e Visibilità */}
                <div className="grid gap-2">
                    <div className="flex justify-between items-center">
                        <Label>Diario / Note di Lavoro</Label>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="share-switch" className="text-xs text-blue-600 cursor-pointer">
                                {shareNotes ? "Visibile all'ospite" : "Note Private"}
                            </Label>
                            <Switch 
                                id="share-switch" 
                                checked={shareNotes} 
                                onCheckedChange={setShareNotes} 
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>
                    <Textarea 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        placeholder="Es: Contattato idraulico, viene domani..."
                        className={shareNotes ? "border-blue-300 bg-blue-50" : ""}
                        disabled={isReadOnly}
                    />
                </div>

                {/* Delega a Socio */}
                <div className="border-t pt-4 mt-2">
                    <Label className="mb-2 block font-semibold text-slate-700">Non puoi farlo tu? Delega a un socio.</Label>
                    <div className="flex gap-2">
                        <Select onValueChange={setAssignedPartner} disabled={isReadOnly}>
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Seleziona Socio..." />
                            </SelectTrigger>
                            <SelectContent>
                                {colleagues?.map(col => (
                                    <SelectItem key={col.id} value={col.phone || col.id}>
                                        {col.first_name} {col.last_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button 
                            className="bg-green-600 hover:bg-green-700 text-white" 
                            onClick={handleDelegate}
                            disabled={!assignedPartner || isReadOnly}
                        >
                            <Share2 className="w-4 h-4 mr-2" /> Delega WhatsApp
                        </Button>
                    </div>
                </div>

                {!isReadOnly && (
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={saveProgress}>Salva Stato (Senza Chiudere)</Button>
                    </DialogFooter>
                )}
            </TabsContent>

            {/* TAB 2: PREVENTIVI (Nuova Funzionalità) */}
            <TabsContent value="quote" className="space-y-4 py-4">
                
                {/* Visualizzazione Preventivo Esistente */}
                {(ticket.quote_amount || ticket.quote_url) && (
                    <div className="border rounded p-4 mb-4 bg-white shadow-sm flex justify-between items-center">
                        <div className="flex items-center gap-2 text-lg font-bold text-slate-700">
                            <Euro className="w-5 h-5 text-gray-500" /> {ticket.quote_amount}
                        </div>
                        <Badge variant="outline" className={
                            ticket.quote_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                            ticket.quote_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                        }>{ticket.quote_status?.toUpperCase()}</Badge>
                    </div>
                )}

                {/* Workflow Approvazione */}
                {ticket.quote_status === 'pending' && !isReadOnly && (
                     <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button className="bg-green-600 hover:bg-green-700 h-10" onClick={() => handleQuoteDecision('approved')}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Approva Spesa
                        </Button>
                        <Button variant="destructive" className="h-10" onClick={() => handleQuoteDecision('rejected')}>
                            <XCircle className="w-4 h-4 mr-2" /> Rifiuta
                        </Button>
                    </div>
                )}

                {/* Form Caricamento (Visibile se non approvato) */}
                {ticket.quote_status !== 'approved' && !isReadOnly && (
                    <div className="bg-slate-50 p-4 rounded border border-dashed border-slate-300">
                        <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-700">
                            <Upload className="w-4 h-4" /> Carica / Aggiorna Preventivo
                        </h4>
                        <div className="space-y-3">
                            <div className="grid gap-2">
                                <Label>Importo Preventivato (€)</Label>
                                <Input type="number" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} placeholder="0.00" className="bg-white"/>
                            </div>
                            <div className="grid gap-2">
                                <Label>Allegato (PDF/IMG)</Label>
                                <Input type="file" onChange={e => setQuoteFile(e.target.files?.[0] || null)} className="bg-white"/>
                            </div>
                            <Button className="w-full" disabled={uploading} onClick={handleQuoteUpload}>
                                {uploading ? 'Caricamento...' : 'Salva e Invia per Approvazione'}
                            </Button>
                        </div>
                    </div>
                )}
                {isReadOnly && ticket.quote_status !== 'approved' && (
                    <p className="text-center text-gray-400 italic py-4">Nessun preventivo in corso.</p>
                )}
            </TabsContent>

            {/* TAB 3: COSTI & CHIUSURA (Tuo Codice Originale) */}
            <TabsContent value="closing" className="space-y-4 py-4">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-bold text-yellow-800 flex items-center gap-2 mb-3">
                        <Euro className="w-5 h-5"/> Registrazione Spese Finali
                    </h4>
                    
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Costo Totale (€)</Label>
                                <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={costAmount} 
                                    onChange={e => setCostAmount(e.target.value)}
                                    className="bg-white" 
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="flex items-end">
                                <div className="flex items-center gap-2 mb-2">
                                    <Switch 
                                        id="cost-visible" 
                                        checked={costVisible} 
                                        onCheckedChange={setCostVisible} 
                                        disabled={isReadOnly}
                                    />
                                    <Label htmlFor="cost-visible" className="text-xs cursor-pointer">
                                        Addebita/Mostra a Ospite?
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label className="mb-1 block">Carica Ricevuta / Foto Lavoro</Label>
                            <div className="flex gap-2 items-center">
                                <Input type="file" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="bg-white text-sm" disabled={isReadOnly} />
                                {ticket.ricevuta_url && !receiptFile && (
                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-white">
                                        <CheckCircle className="w-3 h-3 mr-1"/> Già presente
                                    </Badge>
                                )}
                            </div>
                            {costVisible && <p className="text-[10px] text-red-500 mt-1">* Se spuntato, l'ospite vedrà questo documento.</p>}
                        </div>
                    </div>
                </div>

                <Separator className="my-4" />

                {!isReadOnly ? (
                    <div className="space-y-2">
                        <Label className="font-bold text-green-800">Conclusione Intervento</Label>
                        <p className="text-sm text-gray-500">
                            Cliccando su "Completa", lo stato passerà a <b>In Verifica</b>. 
                            L'ospite riceverà una notifica per confermare.
                        </p>
                        <Button 
                            className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg font-bold shadow-md mt-2"
                            onClick={handleResolveFlow}
                            disabled={uploading}
                        >
                            {uploading ? "Caricamento in corso..." : "✅ Completa Lavoro e Notifica Ospite"}
                        </Button>
                    </div>
                ) : (
                    <p className="text-center text-green-600 font-bold py-4">Ticket Completato e Chiuso.</p>
                )}
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}