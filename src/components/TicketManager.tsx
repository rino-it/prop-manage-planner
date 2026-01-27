import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  CheckCircle, Phone, FileText, RotateCcw, Euro, Truck, Home, Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { UserMultiSelect } from '@/components/UserMultiSelect';

interface TicketManagerProps {
  ticket: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  isReadOnly?: boolean;
}

export default function TicketManager({ ticket, isOpen, onClose, onUpdate, isReadOnly = false }: TicketManagerProps) {
  const { toast } = useToast();
  
  // --- STATI LOCALI PER UI REATTIVA ---
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [shareNotes, setShareNotes] = useState(ticket?.share_notes || false);
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [supplierContact, setSupplierContact] = useState(ticket?.supplier_contact || ''); 
  const [dueDate, setDueDate] = useState(ticket?.data_scadenza || '');
  
  // Stato locale per lo status del ticket e del preventivo (FIX UI non aggiornata)
  const [status, setStatus] = useState(ticket?.stato || 'aperto');
  const [quoteStatus, setQuoteStatus] = useState(ticket?.quote_status || 'none');

  const [assignedTo, setAssignedTo] = useState<string[]>(
    ticket?.assigned_to && ticket.assigned_to.length > 0 
      ? ticket.assigned_to 
      : (ticket?.assigned_partner_id ? [ticket.assigned_partner_id] : [])
  );

  const [quoteAmount, setQuoteAmount] = useState(ticket?.quote_amount || '');
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  const [costAmount, setCostAmount] = useState(ticket?.cost || '');
  const [costVisible, setCostVisible] = useState(ticket?.spesa_visibile_ospite || false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  const [uploading, setUploading] = useState(false);

  // Sync stati se cambia il ticket prop (es. riapertura modale)
  useEffect(() => {
    if(isOpen && ticket) {
        setStatus(ticket.stato);
        setQuoteStatus(ticket.quote_status || 'none');
        setNotes(ticket.admin_notes || '');
        // ... altri reset se necessario
    }
  }, [ticket, isOpen]);

  // FETCH COLLEGHI
  const { data: colleagues = [] } = useQuery({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data?.map(u => ({
          id: u.id,
          label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
      })) || [];
    }
  });

  const saveProgress = async () => {
    const primaryAssignee = assignedTo.length > 0 ? assignedTo[0] : null;

    const { error } = await supabase.from('tickets').update({ 
        admin_notes: notes,
        share_notes: shareNotes,
        supplier: supplier,
        supplier_contact: supplierContact,
        assigned_to: assignedTo, 
        assigned_partner_id: primaryAssignee,
        data_scadenza: dueDate || null,
        stato: status // Usa lo stato locale che potrebbe essere cambiato
      }).eq('id', ticket.id);

    if (error) toast({ title: "Errore", description: error.message, variant: "destructive" });
    else { 
        toast({ title: "Salvato", description: "Modifiche registrate." }); 
        onUpdate(); 
    }
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
        
        // Aggiornamento UI locale
        setQuoteStatus('pending');
        setStatus('in_attesa');
        
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
    else { 
        setQuoteStatus('pending');
        setStatus('in_attesa');
        toast({ title: "Reset Effettuato" }); 
        onUpdate(); 
    }
  };

  const handleQuoteDecision = async (decision: 'approved' | 'rejected') => {
      setUploading(true);
      try {
        const newState = decision === 'approved' ? 'in_corso' : 'aperto';
        
        const { error: ticketError } = await supabase.from('tickets')
            .update({ quote_status: decision, stato: newState }).eq('id', ticket.id);
        
        if (ticketError) throw new Error("Errore ticket: " + ticketError.message);

        if (decision === 'approved') {
            const expenseDate = ticket.data_scadenza || new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0];
            
            const entityData = ticket.property_real_id 
                ? { property_real_id: ticket.property_real_id } 
                : (ticket.property_mobile_id ? { property_mobile_id: ticket.property_mobile_id } : {});

            const importo = ticket.quote_amount || 0;

            const { error: expenseError } = await supabase.from('payments').insert({
                descrizione: `Spesa Ticket: ${ticket.titolo}`,
                importo: importo,
                importo_originale: importo,
                scadenza: expenseDate,
                stato: 'da_pagare', 
                payment_status: 'pending', 
                competence: 'owner', 
                ticket_id: ticket.id,
                user_id: ticket.user_id,
                ...entityData
            });

            if (expenseError) throw new Error("Errore creazione spesa: " + expenseError.message);
            
            toast({ title: "Approvato", description: "Ticket in corso e Spesa registrata." });
        } else {
            toast({ title: "Rifiutato", description: "Ticket riaperto." });
        }
        
        // --- AGGIORNAMENTO UI LOCALE IMMEDIATO ---
        setQuoteStatus(decision);
        setStatus(newState);
        
        onUpdate(); // Aggiorna la lista sotto
        // onClose(); // RIMOSSO: Così la finestra resta aperta e vedi l'aggiornamento
      } catch (e: any) {
          console.error(e);
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
        
        setStatus('in_verifica'); // Update locale
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
          
          setStatus('risolto'); // Update locale
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
          
          setStatus('in_lavorazione'); // Update locale
          toast({ title: "Riaperto", description: "Ticket tornato in lavorazione." });
          onUpdate();
      } catch (err: any) {
          toast({ title: "Errore", description: err.message, variant: "destructive" });
      }
  };

  const headerIcon = ticket.properties_mobile ? <Truck className="w-5 h-5"/> : <Home className="w-5 h-5"/>;
  const headerTitle = ticket.properties_mobile ? ticket.properties_mobile.veicolo : (ticket.properties_real?.nome || 'Generale');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 p-1 rounded">{headerIcon}</span>
            <span className="truncate">{headerTitle}: {ticket.titolo}</span>
          </DialogTitle>
          <DialogDescription>
            Aperto il {format(new Date(ticket.created_at), 'dd/MM/yyyy')} - Stato: <Badge className={status === 'risolto' ? 'bg-green-600' : ''}>{status}</Badge>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="management" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="management">1. Gestione</TabsTrigger>
                <TabsTrigger value="quote">2. Preventivo</TabsTrigger>
                <TabsTrigger value="closing">3. Chiusura</TabsTrigger>
            </TabsList>

            <TabsContent value="management" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Data Scadenza / Intervento</Label>
                        <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isReadOnly} />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600"/> Delega a Team</Label>
                        <UserMultiSelect 
                            options={colleagues} 
                            selected={assignedTo} 
                            onChange={setAssignedTo} 
                            placeholder="Seleziona..." 
                        />
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
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={isReadOnly} placeholder="Dettagli tecnici..." />
                    <div className="flex items-center gap-2 mt-1">
                        <Switch checked={shareNotes} onCheckedChange={setShareNotes} disabled={isReadOnly}/>
                        <Label className="text-xs">Visibile a ospite</Label>
                    </div>
                </div>

                {!isReadOnly && <div className="border-t pt-4 text-right"><Button type="button" onClick={saveProgress}>Salva Modifiche</Button></div>}
            </TabsContent>

            <TabsContent value="quote" className="space-y-4 py-4">
                {(ticket.quote_amount || ticket.quote_url) && (
                    <div className="border rounded p-4 mb-4 bg-white shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 font-bold"><Euro className="w-5 h-5"/> {ticket.quote_amount}</div>
                            <div className="flex items-center gap-2">
                                {ticket.quote_url && <Button size="sm" variant="ghost" onClick={() => viewFile(ticket.quote_url)}><FileText className="w-4 h-4 mr-2"/> Vedi</Button>}
                                <Badge className={quoteStatus === 'approved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>{quoteStatus}</Badge>
                            </div>
                        </div>
                        {quoteStatus === 'approved' && !isReadOnly && (
                            <Button variant="destructive" size="sm" className="w-full mt-2" onClick={handleResetQuote}><RotateCcw className="w-4 h-4 mr-2" /> Reset</Button>
                        )}
                    </div>
                )}
                {quoteStatus === 'pending' && !isReadOnly && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button className="bg-green-600" disabled={uploading} onClick={() => handleQuoteDecision('approved')}>Approva</Button>
                        <Button variant="destructive" disabled={uploading} onClick={() => handleQuoteDecision('rejected')}>Rifiuta</Button>
                    </div>
                )}
                {quoteStatus !== 'approved' && quoteStatus !== 'pending' && !isReadOnly && (
                    <div className="bg-slate-50 p-4 rounded border border-dashed space-y-3">
                        <Input type="number" placeholder="Importo €" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} className="bg-white"/>
                        <Input type="file" onChange={e => setQuoteFile(e.target.files?.[0] || null)} className="bg-white"/>
                        <Button className="w-full" disabled={uploading} onClick={handleQuoteUpload}>{uploading ? '...' : 'Invia Preventivo'}</Button>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="closing" className="space-y-4 py-4">
                {status === 'in_verifica' && (
                    <div className="bg-orange-50 p-4 rounded text-center space-y-2 border border-orange-200">
                        <h3 className="font-bold text-orange-800">In Attesa di Verifica</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <Button className="bg-green-600" onClick={handleFinalClose}>Approva e Chiudi</Button>
                            <Button variant="outline" className="text-red-600" onClick={handleReopen}>Riapri</Button>
                        </div>
                    </div>
                )}
                {status !== 'in_verifica' && status !== 'risolto' && (
                    <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                        <Label className="font-bold text-yellow-800 block mb-2">Chiusura</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <Input type="number" placeholder="Totale €" value={costAmount} onChange={e => setCostAmount(e.target.value)} disabled={isReadOnly} className="bg-white"/>
                            <div className="flex items-center gap-2"><Switch checked={costVisible} onCheckedChange={setCostVisible} disabled={isReadOnly}/><Label className="text-xs">Addebita Ospite</Label></div>
                        </div>
                        {!isReadOnly && <Button className="w-full bg-blue-600 mt-4" onClick={handleSendToVerify} disabled={uploading}>📤 Manda in Verifica</Button>}
                    </div>
                )}
                {status === 'risolto' && (
                    <div className="bg-green-50 border border-green-200 p-4 rounded text-center">
                        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2"/>
                        <h3 className="font-bold text-green-800">Ticket Risolto</h3>
                    </div>
                )}
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}