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
import { CheckCircle, Share2, Hammer, Euro, Upload, XCircle } from 'lucide-react';
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
  
  // STATI ESISTENTI
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [shareNotes, setShareNotes] = useState(ticket?.share_notes || false);
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [supplierContact, setSupplierContact] = useState(''); 
  const [assignedPartner, setAssignedPartner] = useState('');
  
  const [costAmount, setCostAmount] = useState(ticket?.cost || '');
  const [costVisible, setCostVisible] = useState(ticket?.spesa_visibile_ospite || false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  // STATI NUOVI (PREVENTIVI)
  const [quoteAmount, setQuoteAmount] = useState(ticket?.quote_amount || '');
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

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
        admin_notes: notes, share_notes: shareNotes, supplier: supplier, stato: 'in_lavorazione' 
      }).eq('id', ticket.id);
    if (error) toast({ title: "Errore", variant: "destructive" });
    else { toast({ title: "Salvato" }); onUpdate(); }
  };

  const handleDelegate = () => {
    if (!assignedPartner) return toast({ title: "Seleziona socio", variant: "destructive" });
    const partner = colleagues?.find(c => c.phone === assignedPartner || c.id === assignedPartner);
    const phone = partner?.phone || assignedPartner;
    const text = `Ciao, delego ticket: ${ticket.titolo}\nNote: ${notes}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

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
        const { error } = await supabase.from('tickets').update({
            quote_amount: parseFloat(quoteAmount), quote_url: quoteUrl, quote_status: 'pending', stato: 'in_attesa'
          }).eq('id', ticket.id);
        if (error) throw error;
        toast({ title: "Preventivo caricato" }); onUpdate(); onClose();
      } catch (e: any) { toast({ title: "Errore", description: e.message, variant: "destructive" }); } finally { setUploading(false); }
  };

  const handleQuoteDecision = async (decision: 'approved' | 'rejected') => {
      const newState = decision === 'approved' ? 'in_corso' : 'aperto';
      const { error } = await supabase.from('tickets').update({ quote_status: decision, stato: newState }).eq('id', ticket.id);
      if (error) toast({ title: "Errore", variant: "destructive" });
      else { toast({ title: decision === 'approved' ? "Approvato" : "Rifiutato" }); onUpdate(); onClose(); }
  };

  const handleResolveFlow = async () => {
    try {
        setUploading(true);
        let receiptUrl = ticket.ricevuta_url;
        if (receiptFile) {
            const fileName = `receipt_${ticket.id}_${Date.now()}.${receiptFile.name.split('.').pop()}`;
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, receiptFile);
            if (upError) throw upError;
            receiptUrl = fileName;
        }
        const { error } = await supabase.from('tickets').update({ 
            stato: 'in_verifica', cost: parseFloat(costAmount) || 0, ricevuta_url: receiptUrl,
            spesa_visibile_ospite: costVisible, admin_notes: notes 
        }).eq('id', ticket.id);
        if (error) throw error;
        toast({ title: "Ticket Completato" }); onUpdate(); onClose();
    } catch (e: any) { toast({ title: "Errore", description: e.message, variant: "destructive" }); } finally { setUploading(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 p-1 rounded"><Hammer className="w-5 h-5"/></span>
            Gestione: {ticket.titolo}
          </DialogTitle>
          <DialogDescription>Aperto il {format(new Date(ticket.created_at), 'dd/MM/yyyy')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="management" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="management">1. Gestione</TabsTrigger>
                <TabsTrigger value="quote">2. Preventivo</TabsTrigger>
                <TabsTrigger value="closing">3. Chiusura</TabsTrigger>
            </TabsList>

            <TabsContent value="management" className="space-y-4 py-4">
                <div className="grid gap-2 p-3 bg-slate-50 rounded border">
                    <Label>Fornitore</Label>
                    <div className="flex gap-2">
                        <Input placeholder="Ditta" value={supplier} onChange={e => setSupplier(e.target.value)} disabled={isReadOnly}/>
                        <Input placeholder="Tel" value={supplierContact} onChange={e => setSupplierContact(e.target.value)} className="w-1/3" disabled={isReadOnly}/>
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label>Note</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={isReadOnly}/>
                    <div className="flex items-center gap-2 mt-1">
                        <Switch checked={shareNotes} onCheckedChange={setShareNotes} disabled={isReadOnly}/>
                        <Label className="text-xs">Visibile a ospite</Label>
                    </div>
                </div>
                <div className="border-t pt-4 flex gap-2">
                    <Select onValueChange={setAssignedPartner} disabled={isReadOnly}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Delega a..." /></SelectTrigger>
                        <SelectContent>{colleagues?.map(c => <SelectItem key={c.id} value={c.phone || c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button onClick={handleDelegate} disabled={!assignedPartner || isReadOnly} className="bg-green-600"><Share2 className="w-4 h-4 mr-2"/> WhatsApp</Button>
                </div>
                {!isReadOnly && <DialogFooter className="mt-4"><Button variant="outline" onClick={saveProgress}>Salva Stato</Button></DialogFooter>}
            </TabsContent>

            <TabsContent value="quote" className="space-y-4 py-4">
                {(ticket.quote_amount || ticket.quote_url) && (
                    <div className="border rounded p-4 mb-4 bg-white shadow-sm flex justify-between items-center">
                        <div className="flex items-center gap-2 font-bold"><Euro className="w-5 h-5"/> {ticket.quote_amount}</div>
                        <Badge>{ticket.quote_status}</Badge>
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
                        <h4 className="font-bold text-sm mb-3 flex gap-2"><Upload className="w-4 h-4"/> Carica Preventivo</h4>
                        <div className="space-y-3">
                            <Input type="number" placeholder="Importo" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} className="bg-white"/>
                            <Input type="file" onChange={e => setQuoteFile(e.target.files?.[0] || null)} className="bg-white"/>
                            <Button className="w-full" disabled={uploading} onClick={handleQuoteUpload}>{uploading ? '...' : 'Invia'}</Button>
                        </div>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="closing" className="space-y-4 py-4">
                <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                    <Label className="font-bold text-yellow-800 block mb-2">Spese Finali</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <Input type="number" placeholder="Totale €" value={costAmount} onChange={e => setCostAmount(e.target.value)} disabled={isReadOnly}/>
                        <div className="flex items-center gap-2">
                            <Switch checked={costVisible} onCheckedChange={setCostVisible} disabled={isReadOnly}/>
                            <Label className="text-xs">Mostra a Ospite</Label>
                        </div>
                    </div>
                    <div className="mt-3">
                        <Label className="text-xs block mb-1">Scontrino</Label>
                        <Input type="file" onChange={e => setReceiptFile(e.target.files?.[0] || null)} disabled={isReadOnly} className="bg-white"/>
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