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
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  CheckCircle, Save, Share2, Hammer, Euro, Upload, XCircle, AlertTriangle 
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
  
  // --- STATI ORIGINALI (TAB 1 & 3) ---
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [shareNotes, setShareNotes] = useState(ticket?.share_notes || false);
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [supplierContact, setSupplierContact] = useState(''); 
  const [assignedPartner, setAssignedPartner] = useState('');
  
  const [costAmount, setCostAmount] = useState(ticket?.cost || '');
  const [costVisible, setCostVisible] = useState(ticket?.spesa_visibile_ospite || false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  // --- NUOVI STATI (TAB 2: PREVENTIVO) ---
  const [quoteAmount, setQuoteAmount] = useState(ticket?.quote_amount || '');
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);

  // Recupera soci per la delega (TUA LOGICA ORIGINALE)
  const { data: colleagues } = useQuery({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
  });

  // --- AZIONI ORIGINALI (TAB 1) ---
  
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

  const handleDelegate = () => {
    if (!assignedPartner) return toast({ title: "Chi se ne occupa?", description: "Seleziona un socio prima di delegare.", variant: "destructive" });
    
    // Logica originale di matching del socio
    const partner = colleagues?.find(c => c.phone === assignedPartner || c.id === assignedPartner);
    const phone = partner?.phone || assignedPartner;

    const text = `Ciao, ti delego questo ticket:\n\n🏠 *${ticket.bookings?.properties_real?.nome || 'N/A'}*\n⚠️ *${ticket.titolo}*\n📝 Note: ${notes}\n🛠 Fornitore suggerito: ${supplier}\n\nFammi sapere quando è risolto.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- NUOVE AZIONI (TAB 2: PREVENTIVI) ---

  const handleQuoteUpload = async () => {
      setUploading(true);
      try {
        let quoteUrl = ticket.quote_url;
        if (quoteFile) {
           const fileName = `quote_${ticket.id}_${Date.now()}.${quoteFile.name.split('.').pop()}`;
           const { error: upError } = await supabase.storage.from('documents').upload(fileName, quoteFile);
           if (upError) throw upError;
           quoteUrl = fileName;
        }

        const { error } = await supabase.from('tickets')
          .update({
            quote_amount: parseFloat(quoteAmount),
            quote_url: quoteUrl,
            quote_status: 'pending', // Manda in approvazione
            stato: 'in_attesa'
          })
          .eq('id', ticket.id);

        if (error) throw error;
        toast({ title: "Preventivo Caricato", description: "In attesa di approvazione." });
        onUpdate();
      } catch (e: any) { 
          toast({ title: "Errore", description: e.message, variant: "destructive" }); 
      } finally { setUploading(false); }
  };

  const handleQuoteDecision = async (decision: 'approved' | 'rejected') => {
      const newState = decision === 'approved' ? 'in_corso' : 'aperto';
      const { error } = await supabase.from('tickets').update({ quote_status: decision, stato: newState }).eq('id', ticket.id);
      
      if (error) toast({ title: "Errore", variant: "destructive" });
      else {
          toast({ title: decision === 'approved' ? "Preventivo Approvato" : "Preventivo Rifiutato" });
          onUpdate();
      }
  };

  // --- AZIONI ORIGINALI (TAB 3: CHIUSURA) ---

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

        // TUA LOGICA: Passa a in_verifica
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

            {/* TAB 1: GESTIONE (Il tuo codice originale preservato) */}
            <TabsContent value="management" className="space-y-4 py-4">
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

                {/* Delega a Socio (Tua logica preservata) */}
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

            {/* TAB 2: PREVENTIVO (Nuovo Inserimento) */}
            <TabsContent value="quote" className="space-y-4 py-4">
                {(ticket.quote_amount || ticket.quote_url) && (
                    <div className="border rounded p-4 mb-4 bg-white shadow-sm flex justify-between items-center">
                        <div className="flex items-center gap-2 text-lg font-bold">
                            <Euro className="w-5 h-5 text-gray-500" /> {ticket.quote_amount}
                        </div>
                        <Badge variant="outline" className={
                            ticket.quote_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                            ticket.quote_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                        }>{ticket.quote_status?.toUpperCase()}</Badge>
                    </div>
                )}

                {ticket.quote_status === 'pending' && !isReadOnly && (
                     <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleQuoteDecision('approved')}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Approva Spesa
                        </Button>
                        <Button variant="destructive" onClick={() => handleQuoteDecision('rejected')}>
                            <XCircle className="w-4 h-4 mr-2" /> Rifiuta
                        </Button>
                    </div>
                )}

                {ticket.quote_status !== 'approved' && !isReadOnly && (
                    <div className="bg-slate-50 p-4 rounded border border-dashed border-slate-300">
                        <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><Upload className="w-4 h-4" /> Carica/Aggiorna Preventivo</h4>
                        <div className="space-y-3">
                            <div className="grid gap-2">
                                <Label>Importo (€)</Label>
                                <Input type="number" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} placeholder="0.00" className="bg-white"/>
                            </div>
                            <div className="grid gap-2">
                                <Label>File (PDF/IMG)</Label>
                                <Input type="file" onChange={e => setQuoteFile(e.target.files?.[0] || null)} className="bg-white"/>
                            </div>
                            <Button className="w-full" disabled={uploading} onClick={handleQuoteUpload}>
                                {uploading ? 'Caricamento...' : 'Salva e Invia per Approvazione'}
                            </Button>
                        </div>
                    </div>
                )}
                {isReadOnly && ticket.quote_status !== 'approved' && <p className="text-gray-500 italic text-center">Nessun preventivo attivo o ticket chiuso.</p>}
            </TabsContent>

            {/* TAB 3: COSTI & CHIUSURA (Il tuo codice originale preservato) */}
            <TabsContent value="closing" className="space-y-4 py-4">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-bold text-yellow-800 flex items-center gap-2 mb-3">
                        <Euro className="w-5 h-5"/> Registrazione Spese
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
                            {costVisible && <p className="text-[10px] text-red-500 mt-1">* Se spuntato, l'ospite vedrà questo documento nel suo portale.</p>}