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
  CheckCircle, User, Send, Euro, Share2, Hammer, Eye, Upload, XCircle, Phone, FileText 
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
  
  // --- STATI TAB 1: GESTIONE ---
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [shareNotes, setShareNotes] = useState(ticket?.share_notes || false);
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [supplierContact, setSupplierContact] = useState(ticket?.supplier_contact || '');
  const [assignedPartner, setAssignedPartner] = useState(ticket?.assigned_partner_id || '');
  
  // --- STATI TAB 2: PREVENTIVO ---
  const [quoteAmount, setQuoteAmount] = useState(ticket?.quote_amount || '');
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  // --- STATI TAB 3: CHIUSURA ---
  const [costAmount, setCostAmount] = useState(ticket?.cost || '');
  const [costVisible, setCostVisible] = useState(ticket?.spesa_visibile_ospite || false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  const [uploading, setUploading] = useState(false);

  // QUERY: Recupera soci
  const { data: colleagues } = useQuery({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
  });

  // --- AZIONI TAB 1: GESTIONE ---
  const saveProgress = async () => {
    const { error } = await supabase
      .from('tickets')
      .update({ 
        admin_notes: notes,
        share_notes: shareNotes,
        supplier: supplier,
        supplier_contact: supplierContact,
        assigned_partner_id: assignedPartner || null,
        stato: 'in_lavorazione' 
      })
      .eq('id', ticket.id);

    if (error) toast({ title: "Errore salvataggio", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Salvato", description: "Modifiche registrate." });
      onUpdate();
    }
  };

  const handleDelegate = async () => {
    if (!assignedPartner) return toast({ title: "Seleziona un socio", variant: "destructive" });
    
    const partner = colleagues?.find(c => c.id === assignedPartner);
    const phone = partner?.phone;

    // 1. Salva delega
    await supabase.from('tickets').update({ assigned_partner_id: assignedPartner }).eq('id', ticket.id);
    onUpdate();

    // 2. WhatsApp
    const text = `Ciao ${partner?.first_name}, ti delego il ticket: ${ticket.titolo} presso ${ticket.bookings?.properties_real?.nome || 'N/A'}.\nNote: ${notes}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- AZIONI TAB 2: PREVENTIVO ---
  const handleQuoteUpload = async () => {
      setUploading(true);
      try {
        let quoteUrl = ticket.quote_url;
        if (quoteFile) {
           const fileExt = quoteFile.name.split('.').pop();
           const fileName = `quote_${ticket.id}_${Date.now()}.${fileExt}`;
           
           // Upload su Storage 'documents'
           const { error: upError } = await supabase.storage
              .from('documents')
              .upload(fileName, quoteFile, { upsert: true });
           
           if (upError) throw upError;
           quoteUrl = fileName;
        }

        // Parsing sicuro del numero
        const amountValue = quoteAmount ? parseFloat(quoteAmount.toString().replace(',', '.')) : null;

        const { error } = await supabase.from('tickets')
          .update({
            quote_amount: amountValue,
            quote_url: quoteUrl,
            quote_status: 'pending',
            stato: 'in_attesa'
          })
          .eq('id', ticket.id);

        if (error) throw error;
        
        toast({ title: "Preventivo Caricato", description: "In attesa di approvazione." });
        onUpdate();
        onClose();
      } catch (e: any) { 
          console.error("Errore Upload:", e);
          toast({ title: "Errore Upload", description: e.message || "Verifica permessi storage", variant: "destructive" }); 
      } finally { setUploading(false); }
  };

  const handleQuoteDecision = async (decision: 'approved' | 'rejected') => {
      const newState = decision === 'approved' ? 'in_corso' : 'aperto';
      const { error } = await supabase.from('tickets').update({ quote_status: decision, stato: newState }).eq('id', ticket.id);
      
      if (error) toast({ title: "Errore", variant: "destructive" });
      else {
          toast({ title: decision === 'approved' ? "Preventivo Approvato" : "Rifiutato" });
          onUpdate();
          onClose();
      }
  };

  const viewFile = async (path: string) => {
      if (!path) return;
      const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  // --- AZIONI TAB 3: CHIUSURA ---
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

        const amountValue = costAmount ? parseFloat(costAmount.toString().replace(',', '.')) : 0;

        const { error } = await supabase.from('tickets')
            .update({ 
                stato: 'in_verifica', 
                cost: amountValue,
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
            Aperto il {format(new Date(ticket.created_at), 'dd/MM/yyyy')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="management" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="management">1. Gestione</TabsTrigger>
                <TabsTrigger value="quote">2. Preventivo</TabsTrigger>
                <TabsTrigger value="closing">3. Chiusura</TabsTrigger>
            </TabsList>

            {/* TAB 1: GESTIONE */}
            <TabsContent value="management" className="space-y-4 py-4">
                <div className="grid gap-2 p-3 bg-slate-50 rounded border">
                    <Label className="text-slate-700 font-semibold">Fornitore / Operaio</Label>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Nome Ditta" 
                            value={supplier} 
                            onChange={e => setSupplier(e.target.value)} 
                            className="bg-white"
                            disabled={isReadOnly}
                        />
                        <Input 
                            placeholder="Telefono" 
                            value={supplierContact} 
                            onChange={e => setSupplierContact(e.target.value)} 
                            className="bg-white w-1/3"
                            disabled={isReadOnly}
                        />
                        {supplierContact && (
                            <Button size="icon" variant="outline" onClick={() => window.open(`tel:${supplierContact}`)} title="Chiama">
                                <Phone className="w-4 h-4 text-blue-600"/>
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label>Note Interne</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Link e note qui..." disabled={isReadOnly}/>
                    <div className="flex items-center gap-2 mt-1">
                        <Switch checked={shareNotes} onCheckedChange={setShareNotes} disabled={isReadOnly}/>
                        <Label className="text-xs">Visibile a ospite</Label>
                    </div>
                </div>

                <div className="border-t pt-4 flex gap-2 items-end">
                    <div className="flex-1">
                        <Label className="mb-1 block">Delega a Socio</Label>
                        <Select value={assignedPartner || ''} onValueChange={setAssignedPartner} disabled={isReadOnly}>
                            <SelectTrigger className="flex-1"><SelectValue placeholder="Scegli socio..." /></SelectTrigger>
                            <SelectContent>
                                {colleagues?.map(col => (
                                    <SelectItem key={col.id} value={col.id}>{col.first_name} {col.last_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleDelegate} disabled={!assignedPartner || isReadOnly} className="bg-green-600">
                        <Share2 className="w-4 h-4 mr-2" /> WhatsApp
                    </Button>
                </div>
                {!isReadOnly && (
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={saveProgress}>Salva Stato (Senza Chiudere)</Button>
                    </DialogFooter>
                )}
            </TabsContent>

            {/* TAB 2: PREVENTIVO */}
            <TabsContent value="quote" className="space-y-4 py-4">
                {(ticket.quote_amount || ticket.quote_url) && (
                    <div className="border rounded p-4 mb-4 bg-white shadow-sm flex justify-between items-center">
                        <div className="flex items-center gap-2 font-bold"><Euro className="w-5 h-5"/> {ticket.quote_amount}</div>
                        <div className="flex items-center gap-2">
                            {ticket.quote_url && (
                                <Button size="sm" variant="ghost" onClick={() => viewFile(ticket.quote_url)}>
                                    <FileText className="w-4 h-4 mr-2"/> Vedi
                                </Button>
                            )}
                            <Badge>{ticket.quote_status}</Badge>
                        </div>
                    </div>
                )}
                {ticket.quote_status === 'pending' && !isReadOnly && (
                     <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleQuoteDecision('approved')}><CheckCircle className="w-4 h-4 mr-2"/> Approva</Button>
                        <Button variant="destructive" onClick={() => handleQuoteDecision('rejected')}><XCircle className="w-4 h-4 mr-2"/> Rifiuta</Button>
                    </div>
                )}
                {ticket.quote_status !== 'approved' && !isReadOnly && (
                    <div className="bg-slate-50 p-4 rounded border border-dashed">
                        <h4 className="font-bold text-sm mb-3 flex gap-2"><Upload className="w-4 h-4"/> Carica / Aggiorna</h4>
                        <div className="space-y-3">
                            <Input type="number" placeholder="Importo €" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} className="bg-white"/>
                            <Input type="file" onChange={e => setQuoteFile(e.target.files?.[0] || null)} className="bg-white"/>
                            <Button className="w-full" disabled={uploading} onClick={handleQuoteUpload}>{uploading ? '...' : 'Invia'}</Button>
                        </div>
                    </div>
                )}
                {isReadOnly && <p className="text-gray-500 italic text-center py-4">Modifiche bloccate.</p>}
            </TabsContent>

            {/* TAB 3: CHIUSURA */}
            <TabsContent value="closing" className="space-y-4 py-4">
                <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                    <Label className="font-bold text-yellow-800 block mb-2">Spese Finali</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <Input type="number" placeholder="Totale €" value={costAmount} onChange={e => setCostAmount(e.target.value)} disabled={isReadOnly} className="bg-white"/>
                        <div className="flex items-center gap-2">
                            <Switch checked={costVisible} onCheckedChange={setCostVisible} disabled={isReadOnly}/>
                            <Label className="text-xs">Addebita Ospite</Label>
                        </div>
                    </div>
                    <div className="mt-3">
                        <Label className="text-xs block mb-1">Scontrino</Label>
                        <div className="flex gap-2">
                            <Input type="file" onChange={e => setReceiptFile(e.target.files?.[0] || null)} disabled={isReadOnly} className="bg-white"/>
                            {ticket.ricevuta_url && (
                                <Button size="icon" variant="outline" onClick={() => viewFile(ticket.ricevuta_url)} title="Vedi Scontrino">
                                    <Eye className="w-4 h-4 text-blue-600"/>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
                {!isReadOnly && (
                    <Button className="w-full bg-green-600 mt-4 py-6" onClick={handleResolveFlow} disabled={uploading}>
                        {uploading ? "..." : "✅ Completa Lavoro"}
                    </Button>
                )}
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}