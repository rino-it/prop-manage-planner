import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  CheckCircle, Phone, FileText, RotateCcw, Euro, Truck, Home, Users, Paperclip, AlertTriangle, Share2, Plus, Trash2, Calculator
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserMultiSelect } from '@/components/UserMultiSelect';
import { pdf } from '@react-pdf/renderer';
import { TicketDocument } from './TicketPDF';

interface TicketManagerProps {
  ticket: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  isReadOnly?: boolean;
}

export default function TicketManager({ ticket, isOpen, onClose, onUpdate, isReadOnly = false }: TicketManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // --- STATI ORIGINALI ---
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [shareNotes, setShareNotes] = useState(ticket?.share_notes || false);
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [supplierContact, setSupplierContact] = useState(ticket?.supplier_contact || ''); 
  const [dueDate, setDueDate] = useState(ticket?.data_scadenza || '');
  
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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // --- NUOVI STATI PER VOCI MULTIPLE ---
  const [newQuoteItem, setNewQuoteItem] = useState({ desc: '', amount: '' });

  // Fetch voci spesa dettagliate
  const { data: ticketExpenses = [] } = useQuery({
    queryKey: ['ticket-expenses', ticket?.id],
    queryFn: async () => {
      const { data } = await supabase.from('payments').select('*').eq('ticket_id', ticket.id);
      return data || [];
    },
    enabled: isOpen && !!ticket?.id
  });

  const totalDetailedQuotes = ticketExpenses.reduce((acc: number, curr: any) => acc + Number(curr.importo), 0);

  useEffect(() => {
    if(isOpen && ticket) {
        setStatus(ticket.stato);
        setQuoteStatus(ticket.quote_status || 'none');
        setNotes(ticket.admin_notes || '');
    }
  }, [ticket, isOpen]);

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

  // --- MUTATIONS PER VOCI MULTIPLE ---
  const addQuoteExpense = useMutation({
    mutationFn: async () => {
      if (!newQuoteItem.amount || !newQuoteItem.desc) throw new Error("Dati mancanti");
      const { error } = await supabase.from('payments').insert({
        ticket_id: ticket.id,
        property_real_id: ticket.property_real_id,
        property_mobile_id: ticket.property_mobile_id,
        importo: parseFloat(newQuoteItem.amount),
        descrizione: `[Preventivo] ${newQuoteItem.desc}`,
        categoria: 'manutenzione',
        stato: 'da_pagare',
        tipo: 'uscita',
        scadenza: format(new Date(), 'yyyy-MM-dd')
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-expenses'] });
      setNewQuoteItem({ desc: '', amount: '' });
      toast({ title: "Voce aggiunta" });
    }
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-expenses'] })
  });

  // --- FUNZIONI ORIGINALI ---

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
        stato: status 
      }).eq('id', ticket.id);

    if (error) toast({ title: "Errore", description: error.message, variant: "destructive" });
    else { 
        toast({ title: "Salvato", description: "Modifiche registrate." }); 
        onUpdate(); 
        onClose(); // <--- FIX RICHIESTO: AUTO-CHIUSURA
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

        // Se non c'è importo manuale ma ci sono voci, usa la somma delle voci
        const finalAmount = quoteAmount ? parseFloat(quoteAmount.toString().replace(',', '.')) : (totalDetailedQuotes > 0 ? totalDetailedQuotes : null);

        const { error } = await supabase.from('tickets').update({
            quote_amount: finalAmount, quote_url: quoteUrl, quote_status: 'pending', stato: 'in_attesa'
          }).eq('id', ticket.id);

        if (error) throw error;
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

        // Se approvato e non ci sono voci dettagliate, crea una spesa macro
        if (decision === 'approved' && totalDetailedQuotes === 0) {
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
                ticket_id: ticket.id,
                user_id: ticket.user_id,
                ...entityData
            });
            if (expenseError) throw new Error("Errore creazione spesa: " + expenseError.message);
        }
        
        toast({ title: decision === 'approved' ? "Approvato" : "Rifiutato" });
        setQuoteStatus(decision);
        setStatus(newState);
        onUpdate();
        onClose(); // <--- FIX: AUTO-CHIUSURA
      } catch (e: any) {
          toast({ title: "Errore", description: e.message, variant: "destructive" });
      } finally {
          setUploading(false);
      }
  };

  const viewFile = async (path: string) => {
      if (!path) return;
      const bucket = path.startsWith('ticket_doc_') ? 'ticket-files' : 'documents';
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
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
        setStatus('in_verifica'); 
        toast({ title: "Inviato", description: "Ticket mandato in verifica amministrazione." });
        onUpdate();
        onClose(); // <--- FIX: AUTO-CHIUSURA
    } catch (error: any) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const generateAndSharePDF = async (targetPhone: string | null = null) => {
    setUploading(true);
    toast({ title: "Generazione PDF...", description: "Sto creando il documento di delega." });
    try {
        const imageUrls = await Promise.all((ticket.attachments || []).map(async (path: string) => {
            const bucket = path.startsWith('ticket_doc_') ? 'ticket-files' : 'documents';
            const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
            return data?.signedUrl;
        }));
        const blob = await pdf(<TicketDocument ticket={ticket} publicUrls={imageUrls.filter(Boolean)} />).toBlob();
        const fileName = `delega_${ticket.id}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage.from('ticket-files').upload(fileName, blob);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('ticket-files').getPublicUrl(fileName);

        const message = `Ciao, ecco la scheda intervento per: *${ticket.titolo}*\nLink Documento: ${publicUrl}`;
        const waLink = targetPhone 
            ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;
            
        window.open(waLink, '_blank');
        toast({ title: "Pronto!", description: "WhatsApp aperto." });
    } catch (e: any) {
        toast({ title: "Errore PDF", description: e.message, variant: "destructive" });
    } finally {
        setUploading(false);
    }
  };

  const handleFinalClose = async () => {
      if (confirmText !== ticket.titolo) {
          toast({ title: "Errore", description: "Il nome del ticket non corrisponde.", variant: "destructive" });
          return;
      }
      try {
          const { error } = await supabase.from('tickets').update({ stato: 'risolto' }).eq('id', ticket.id);
          if (error) throw error;
          setStatus('risolto'); 
          setShowCloseConfirm(false);
          toast({ title: "Ticket Chiuso" });
          onUpdate();
          onClose(); // <--- FIX: AUTO-CHIUSURA
      } catch (err: any) {
          toast({ title: "Errore", description: err.message, variant: "destructive" });
      }
  };

  const handleReopen = async () => {
      try {
          const { error } = await supabase.from('tickets').update({ stato: 'in_lavorazione' }).eq('id', ticket.id);
          if (error) throw error;
          setStatus('in_lavorazione');
          toast({ title: "Riaperto" });
          onUpdate();
          onClose(); // <--- FIX: AUTO-CHIUSURA
      } catch (err: any) {
          toast({ title: "Errore", description: err.message, variant: "destructive" });
      }
  };

  const headerIcon = ticket.properties_mobile ? <Truck className="w-5 h-5"/> : <Home className="w-5 h-5"/>;
  const headerTitle = ticket.properties_mobile ? ticket.properties_mobile.veicolo : (ticket.properties_real?.nome || 'Generale');

  if (showCloseConfirm) {
      return (
        <Dialog open={true} onOpenChange={() => setShowCloseConfirm(false)}>
            <DialogContent className="w-[95vw] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Conferma Chiusura</DialogTitle>
                    <DialogDescription>
                        Scrivi <strong>{ticket.titolo}</strong> per confermare.
                    </DialogDescription>
                </DialogHeader>
                <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Nome ticket..." />
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setShowCloseConfirm(false)} className="w-full sm:w-auto">Annulla</Button>
                    <Button className="bg-red-600 hover:bg-red-700 w-full sm:w-auto" onClick={handleFinalClose} disabled={confirmText !== ticket.titolo}>Conferma</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="bg-blue-100 text-blue-700 p-1 rounded shrink-0">{headerIcon}</span>
            <span className="truncate">{headerTitle}: {ticket.titolo}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Creato il {format(new Date(ticket.created_at), 'dd/MM/yyyy')} - <Badge className={status === 'risolto' ? 'bg-green-600' : ''}>{status}</Badge>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="management" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3 h-auto">
                <TabsTrigger value="management" className="text-xs px-1">1. Gestione</TabsTrigger>
                <TabsTrigger value="quote" className="text-xs px-1">2. Preventivo</TabsTrigger>
                <TabsTrigger value="closing" className="text-xs px-1">3. Chiusura</TabsTrigger>
            </TabsList>

            {/* --- TAB 1: GESTIONE (Con Auto-Chiusura) --- */}
            <TabsContent value="management" className="space-y-4 py-4">
                {ticket.attachments && ticket.attachments.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded border">
                        <Label className="text-xs font-bold text-slate-500 mb-2 block">Allegati Iniziali</Label>
                        <div className="flex flex-wrap gap-2">
                            {ticket.attachments.map((file: string, idx: number) => (
                                <Button key={idx} variant="outline" size="sm" className="h-7 text-xs bg-white" onClick={() => viewFile(file)}>
                                    <Paperclip className="w-3 h-3 mr-1 text-blue-500"/> File {idx + 1}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-bold text-blue-800">Delega e Condivisione</h4>
                        <p className="text-xs text-blue-600">Genera PDF con foto e invia su WhatsApp.</p>
                    </div>
                    {/* FIX 3: Delega Intelligente (Preseleziona il primo assegnato) */}
                    <Button onClick={() => generateAndSharePDF(assignedTo.length > 0 ? colleagues.find((c:any) => c.id === assignedTo[0])?.phone : null)} disabled={uploading} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto text-xs">
                        {uploading ? 'Generazione...' : <><Share2 className="w-3 h-3 mr-2"/> Invia Delega</>}
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Data Scadenza</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isReadOnly} /></div>
                    <div className="grid gap-2"><Label>Delega a Team</Label><UserMultiSelect options={colleagues} selected={assignedTo} onChange={setAssignedTo} placeholder="Seleziona..." /></div>
                </div>

                <div className="grid gap-2 p-3 bg-slate-50 rounded border">
                    <Label className="text-slate-700 font-semibold">Fornitore Esterno</Label>
                    <div className="flex gap-2">
                        <Input placeholder="Ditta" value={supplier} onChange={e => setSupplier(e.target.value)} disabled={isReadOnly} className="flex-1"/>
                        <Input placeholder="Tel" value={supplierContact} onChange={e => setSupplierContact(e.target.value)} className="w-[100px] sm:w-1/3" disabled={isReadOnly}/>
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

                {!isReadOnly && <div className="border-t pt-4 text-right"><Button type="button" onClick={saveProgress} className="w-full sm:w-auto">Salva e Chiudi</Button></div>}
            </TabsContent>

            {/* --- TAB 2: PREVENTIVO (Con Voci Multiple) --- */}
            <TabsContent value="quote" className="space-y-4 py-4">
                {/* 1. SEZIONE VOCI DETTAGLIATE (NUOVA) */}
                <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                    <Label className="font-bold text-slate-700">Dettaglio Voci Spesa</Label>
                    {!isReadOnly && (
                        <div className="flex gap-2 items-end">
                            <Input placeholder="Es. Materiali..." value={newQuoteItem.desc} onChange={e => setNewQuoteItem({...newQuoteItem, desc: e.target.value})} className="bg-white flex-1"/>
                            <div className="w-[100px] relative">
                                <Euro className="w-3 h-3 absolute left-2 top-3 text-gray-400"/>
                                <Input type="number" placeholder="0.00" value={newQuoteItem.amount} onChange={e => setNewQuoteItem({...newQuoteItem, amount: e.target.value})} className="bg-white pl-6"/>
                            </div>
                            <Button size="icon" className="bg-green-600 hover:bg-green-700" onClick={() => addQuoteExpense.mutate()}><Plus className="w-4 h-4"/></Button>
                        </div>
                    )}
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {ticketExpenses.map((exp: any) => (
                            <div key={exp.id} className="flex justify-between items-center p-2 bg-white border rounded text-sm">
                                <span>{exp.descrizione.replace('[Preventivo] ', '')}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">€{exp.importo}</span>
                                    {!isReadOnly && <Trash2 className="w-3 h-3 text-red-500 cursor-pointer" onClick={() => deleteExpense.mutate(exp.id)}/>}
                                </div>
                            </div>
                        ))}
                    </div>
                    {totalDetailedQuotes > 0 && <div className="text-right font-bold text-blue-700 text-sm">Totale Voci: € {totalDetailedQuotes}</div>}
                </div>

                {/* 2. SEZIONE UPLOAD E TOTALE (ORIGINALE) */}
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
                        <div className="flex gap-2 items-center">
                             <Input type="number" placeholder="Totale €" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} className="bg-white"/>
                             {totalDetailedQuotes > 0 && <Button variant="outline" size="icon" onClick={() => setQuoteAmount(totalDetailedQuotes.toString())} title="Usa Somma Voci"><Calculator className="w-4 h-4 text-blue-600"/></Button>}
                        </div>
                        <Input type="file" onChange={e => setQuoteFile(e.target.files?.[0] || null)} className="bg-white"/>
                        <Button className="w-full" disabled={uploading} onClick={handleQuoteUpload}>{uploading ? '...' : 'Invia Preventivo'}</Button>
                    </div>
                )}
            </TabsContent>

            {/* --- TAB 3: CHIUSURA (Con Calcolatrice) --- */}
            <TabsContent value="closing" className="space-y-4 py-4">
                {status === 'in_verifica' && (
                    <div className="bg-orange-50 p-4 rounded text-center space-y-2 border border-orange-200">
                        <h3 className="font-bold text-orange-800">In Attesa di Verifica</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <Button className="bg-green-600" onClick={attemptClose}>Approva e Chiudi</Button>
                            <Button variant="outline" className="text-red-600" onClick={handleReopen}>Riapri</Button>
                        </div>
                    </div>
                )}
                {status !== 'in_verifica' && status !== 'risolto' && (
                    <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                        <Label className="font-bold text-yellow-800 block mb-2">Chiusura</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex gap-2">
                                <Input type="number" placeholder="Totale €" value={costAmount} onChange={e => setCostAmount(e.target.value)} disabled={isReadOnly} className="bg-white"/>
                                {totalDetailedQuotes > 0 && <Button variant="outline" size="icon" onClick={() => setCostAmount(totalDetailedQuotes.toString())} title="Copia Preventivo"><Calculator className="w-4 h-4 text-blue-600"/></Button>}
                            </div>
                            <div className="flex items-center gap-2"><Switch checked={costVisible} onCheckedChange={setCostVisible} disabled={isReadOnly}/><Label className="text-xs">Addebita Ospite</Label></div>
                        </div>
                        
                        <div className="mt-4">
                            <Label className="text-xs mb-1 block">Carica Ricevuta/Fattura</Label>
                            <Input type="file" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="bg-white" disabled={isReadOnly}/>
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