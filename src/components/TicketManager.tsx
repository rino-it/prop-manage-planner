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
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  CheckCircle, Share2, Hammer, Eye, Upload, XCircle, Phone, FileText, RotateCcw, Euro, Lock, Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => 
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">{part}</a>
    ) : part
  );
};

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
  const [shareNotes, setShareNotes] = useState(ticket?.share_notes || false);
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [supplierContact, setSupplierContact] = useState(ticket?.supplier_contact || ''); 
  const [assignedPartner, setAssignedPartner] = useState(ticket?.assigned_partner_id || ''); 
  
  // NUOVO: DATA SCADENZA
  const [dueDate, setDueDate] = useState(ticket?.data_scadenza || '');

  const [quoteAmount, setQuoteAmount] = useState(ticket?.quote_amount || '');
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  const [costAmount, setCostAmount] = useState(ticket?.cost || '');
  const [costVisible, setCostVisible] = useState(ticket?.spesa_visibile_ospite || false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  const [uploading, setUploading] = useState(false);

  const { data: colleagues } = useQuery({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
  });

  const saveProgress = async () => {
    const { error } = await supabase.from('tickets').update({ 
        admin_notes: notes,
        share_notes: shareNotes,
        supplier: supplier,
        supplier_contact: supplierContact,
        assigned_partner_id: assignedPartner || null,
        data_scadenza: dueDate || null, // Salva la data
        stato: 'in_lavorazione' 
      }).eq('id', ticket.id);

    if (error) toast({ title: "Errore", description: error.message, variant: "destructive" });
    else { toast({ title: "Salvato" }); onUpdate(); }
  };

  const handleDelegate = async () => {
    if (!assignedPartner) return toast({ title: "Seleziona socio", variant: "destructive" });
    const partner = colleagues?.find(c => c.id === assignedPartner);
    await supabase.from('tickets').update({ assigned_partner_id: assignedPartner }).eq('id', ticket.id);
    onUpdate();
    window.open(`https://wa.me/${partner?.phone}?text=${encodeURIComponent(`Ciao, ticket: ${ticket.titolo}\nScadenza: ${dueDate || 'N/A'}\nNote: ${notes}`)}`, '_blank');
  };

  const handleQuoteUpload = async () => {
      setUploading(true);
      try {
        let quoteUrl = ticket.quote_url;
        if (quoteFile) {
           const fileName = `quote_${ticket.id}_${Date.now()}.${quoteFile.name.split('.').pop()}`;
           const { error } = await supabase.storage.from('documents').upload(fileName, quoteFile, { upsert: true });
           if (error) throw error;
           quoteUrl = fileName;
        }

        const amountVal = quoteAmount ? parseFloat(quoteAmount.toString().replace(',', '.')) : null;
        const { error } = await supabase.from('tickets').update({
            quote_amount: amountVal, quote_url: quoteUrl, quote_status: 'pending', stato: 'in_attesa'
          }).eq('id', ticket.id);

        if (error) throw error;
        toast({ title: "Caricato", description: "Preventivo in attesa." });
        onUpdate();
      } catch (e: any) { 
          toast({ title: "Errore Upload", description: e.message, variant: "destructive" }); 
      } finally { setUploading(false); }
  };

  const handleResetQuote = async () => {
    if(!confirm("Confermi il reset? Il ticket tornerà 'In Attesa'.")) return;
    const { error } = await supabase.from('tickets').update({ quote_status: 'pending', stato: 'in_attesa' }).eq('id', ticket.id);
    if(error) toast({ title: "Errore", description: error.message, variant: "destructive" });
    else { toast({ title: "Reset Effettuato" }); onUpdate(); }
  };

  const handleQuoteDecision = async (decision: 'approved' | 'rejected') => {
      setUploading(true);
      try {
        const newState = decision === 'approved' ? 'in_corso' : 'aperto';
        
        // 1. Aggiorna Ticket
        const { error: ticketError } = await supabase.from('tickets')
            .update({ quote_status: decision, stato: newState }).eq('id', ticket.id);
        
        if (ticketError) throw new Error(ticketError.message);

        if (decision === 'approved') {
            const { data: { user } } = await supabase.auth.getUser();
            if(!user) throw new Error("Utente non loggato");

            // SE APPROVATO, CREA LA SPESA (PAYMENT)
            const amount = ticket.quote_amount ? parseFloat(ticket.quote_amount) : 0;
            if(amount > 0) {
               // Qui dovremmo inserire in payments, ma per semplicità lo lasciamo al flusso manuale o allo step successivo
               // Se vuoi automatizzare anche questo: 
               /* await supabase.from('payments').insert({
                   importo: amount,
                   scadenza: dueDate || new Date(),
                   descrizione: `Preventivo Approvato: ${ticket.titolo}`,
                   // ... altri campi
               })
               */
            }
            
            toast({ title: "Approvato", description: "Ticket in corso." });

        } else {
            toast({ title: "Rifiutato", description: "Ticket riaperto." });
        }
        onUpdate();
        onClose();
      } catch (e: any) {
          toast({ title: "Errore", description: e.message, variant: "destructive" });
      } finally {
          setUploading(false);
      }
  };

  const viewFile = async (path: string) => {
      if (!path) return;
      const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleSendToVerify = async () => {
    try {
        setUploading(true);
        let receiptUrl = ticket.ricevuta_url;
        if (receiptFile) {
            const fileName = `receipt_${ticket.id}_${Date.now()}.${receiptFile.name.split('.').pop()}`;
            const { error } = await supabase.storage.from('documents').upload(fileName, receiptFile, {upsert: true});
            if (error) throw error;
            receiptUrl = fileName;
        }

        const costVal = costAmount ? parseFloat(costAmount.toString().replace(',', '.')) : 0;
        const { error } = await supabase.from('tickets').update({ 
            stato: 'in_verifica', cost: costVal, ricevuta_url: receiptUrl,
            spesa_visibile_ospite: costVisible, admin_notes: notes, share_notes: shareNotes 
        }).eq('id', ticket.id);

        if (error) throw error;
        toast({ title: "Inviato", description: "Ticket mandato in verifica amministrazione." });
        onUpdate();
        onClose();
    } catch (error: any) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleFinalClose = async () => {
      try {
          const { error } = await supabase.from('tickets').update({ stato: 'risolto' }).eq('id', ticket.id);
          if (error) throw error;
          toast({ title: "Ticket Chiuso", description: "Segnalazione risolta con successo." });
          onUpdate();
          onClose();
      } catch (err: any) {
          toast({ title: "Errore", description: err.message, variant: "destructive" });
      }
  };

  const handleReopen = async () => {
      try {
          const { error } = await supabase.from('tickets').update({ stato: 'in_lavorazione' }).eq('id', ticket.id);
          if (error) throw error;
          toast({ title: "Riaperto", description: "Ticket tornato in lavorazione." });
          onUpdate();
      } catch (err: any) {
          toast({ title: "Errore", description: err.message, variant: "destructive" });
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
          <DialogDescription>Aperto il {format(new Date(ticket.created_at), 'dd/MM/yyyy')} - Stato: <Badge>{ticket.stato}</Badge></DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="management" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="management">1. Gestione</TabsTrigger>
                <TabsTrigger value="quote">2. Preventivo</TabsTrigger>
                <TabsTrigger value="closing">3. Chiusura</TabsTrigger>
            </TabsList>

            <TabsContent value="management" className="space-y-4 py-4">
                {/* CAMPO DATA SCADENZA */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Data Scadenza / Intervento</Label>
                        <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isReadOnly} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Delega a Socio</Label>
                        <Select value={assignedPartner || ''} onValueChange={setAssignedPartner} disabled={isReadOnly}>
                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                            <SelectContent>{colleagues?.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid gap-2 p-3 bg-slate-50 rounded border">
                    <Label className="text-slate-700 font-semibold">Fornitore Esterno</Label>
                    <div className="flex gap-2">
                        <Input placeholder="Ditta" value={supplier} onChange={e => setSupplier(e.target.value)} disabled={isReadOnly}/>
                        <Input placeholder="Tel" value={supplierContact} onChange={e => setSupplierContact(e.target.value)} className="w-1/3" disabled={isReadOnly}/>
                        {supplierContact && <Button size="icon" variant="outline" onClick={() => window.open(`tel:${supplierContact}`)}><Phone className="w-4 h-4 text-blue-600"/></Button>}
                    </div>
                </div>
                
                <div className="grid gap-2">
                    <Label>Note Interne</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={isReadOnly} placeholder="Dettagli tecnici, codici materiali..." />
                    {notes && (notes.includes('http') || notes.includes('www')) && (
                        <div className="text-xs bg-gray-50 p-2 rounded border text-gray-600 break-all">{renderTextWithLinks(notes)}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                        <Switch checked={shareNotes} onCheckedChange={setShareNotes} disabled={isReadOnly}/>
                        <Label className="text-xs">Visibile a ospite</Label>
                    </div>
                </div>

                <div className="border-t pt-4 flex justify-between">
                    <Button onClick={handleDelegate} disabled={!assignedPartner || isReadOnly} variant="outline" className="text-green-600 border-green-200 hover:bg-green-50"><Share2 className="w-4 h-4 mr-2"/> Invia su WA</Button>
                    {!isReadOnly && <Button type="button" onClick={saveProgress}>Salva Modifiche</Button>}
                </div>
            </TabsContent>

            <TabsContent value="quote" className="space-y-4 py-4">
                {(ticket.quote_amount || ticket.quote_url) && (
                    <div className="border rounded p-4 mb-4 bg-white shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 font-bold"><Euro className="w-5 h-5"/> {ticket.quote_amount}</div>
                            <div className="flex items-center gap-2">
                                {ticket.quote_url && <Button size="sm" variant="ghost" onClick={() => viewFile(ticket.quote_url)}><FileText className="w-4 h-4 mr-2"/> Vedi</Button>}
                                <Badge className={ticket.quote_status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>{ticket.quote_status}</Badge>
                            </div>
                        </div>
                        {ticket.quote_status === 'approved' && !isReadOnly && (
                            <Button variant="destructive" size="sm" className="w-full mt-2" onClick={handleResetQuote}>
                                <RotateCcw className="w-4 h-4 mr-2" /> Annulla Approvazione / Reset
                            </Button>
                        )}
                    </div>
                )}
                {ticket.quote_status === 'pending' && !isReadOnly && (
                     <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button className="bg-green-600 hover:bg-green-700" disabled={uploading} onClick={() => handleQuoteDecision('approved')}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Approva e Crea Spesa
                        </Button>
                        <Button variant="destructive" disabled={uploading} onClick={() => handleQuoteDecision('rejected')}>
                            <XCircle className="w-4 h-4 mr-2" /> Rifiuta
                        </Button>
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
            </TabsContent>

            <TabsContent value="closing" className="space-y-4 py-4">
                
                {ticket.stato === 'in_verifica' && (
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-4 text-center space-y-3">
                        <h3 className="font-bold text-orange-800 flex items-center justify-center gap-2"><Lock className="w-4 h-4"/> In Attesa di Verifica</h3>
                        <p className="text-sm text-orange-700">Il lavoro è stato completato. Confermi che è tutto ok?</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button className="bg-green-600 hover:bg-green-700" onClick={handleFinalClose}>
                                <CheckCircle className="w-4 h-4 mr-2"/> Approva e Chiudi
                            </Button>
                            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleReopen}>
                                <RotateCcw className="w-4 h-4 mr-2"/> Riapri Ticket
                            </Button>
                        </div>
                    </div>
                )}

                {ticket.stato !== 'in_verifica' && ticket.stato !== 'risolto' && (
                    <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                        <Label className="font-bold text-yellow-800 block mb-2">Spese Finali & Chiusura</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <Input type="number" placeholder="Totale €" value={costAmount} onChange={e => setCostAmount(e.target.value)} disabled={isReadOnly} className="bg-white"/>
                            <div className="flex items-center gap-2"><Switch checked={costVisible} onCheckedChange={setCostVisible} disabled={isReadOnly}/><Label className="text-xs">Addebita Ospite</Label></div>
                        </div>
                        <div className="mt-3">
                            <Label className="text-xs block mb-1">Scontrino</Label>
                            <div className="flex gap-2">
                                <Input type="file" onChange={e => setReceiptFile(e.target.files?.[0] || null)} disabled={isReadOnly} className="bg-white"/>
                                {ticket.ricevuta_url && <Button size="icon" variant="outline" onClick={() => viewFile(ticket.ricevuta_url)}><Eye className="w-4 h-4 text-blue-600"/></Button>}
                            </div>
                        </div>
                        {!isReadOnly && (
                            <Button className="w-full bg-blue-600 mt-4 py-6" onClick={handleSendToVerify} disabled={uploading}>
                                {uploading ? "..." : "📤 Manda in Verifica"}
                            </Button>
                        )}
                    </div>
                )}

                {ticket.stato === 'risolto' && (
                    <div className="bg-green-50 border border-green-200 p-4 rounded text-center">
                        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2"/>
                        <h3 className="font-bold text-green-800">Ticket Risolto</h3>
                        <p className="text-sm text-green-700">Costo finale: €{ticket.cost || 0}</p>
                    </div>
                )}
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}