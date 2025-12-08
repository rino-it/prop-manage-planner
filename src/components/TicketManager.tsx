import React, { useState, useEffect } from 'react';
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
import { 
  CheckCircle, Save, User, Send, Clock, 
  Euro, FileText, Share2, Hammer, Eye, Upload 
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
  
  // DATI GENERALI
  const [notes, setNotes] = useState(ticket?.admin_notes || '');
  const [shareNotes, setShareNotes] = useState(ticket?.share_notes || false);
  
  // DATI ASSEGNAZIONE
  const [supplier, setSupplier] = useState(ticket?.supplier || '');
  const [supplierContact, setSupplierContact] = useState(''); // Nuovo campo ipotetico se non salvato
  const [assignedPartner, setAssignedPartner] = useState('');

  // DATI CHIUSURA & COSTI
  const [costAmount, setCostAmount] = useState(ticket?.cost || '');
  const [costVisible, setCostVisible] = useState(ticket?.spesa_visibile_ospite || false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Recupera soci per la delega
  const { data: colleagues } = useQuery({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
  });

  // SALVA AGGIORNAMENTI PARZIALI
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

  // INVIA DELEGA WHATSAPP
  const handleDelegate = () => {
    if (!assignedPartner) return toast({ title: "Chi se ne occupa?", description: "Seleziona un socio prima di delegare.", variant: "destructive" });
    
    const partner = colleagues?.find(c => c.phone === assignedPartner || c.id === assignedPartner); // Logica semplificata match
    const phone = partner?.phone || assignedPartner; // Fallback se value è il telefono

    const text = `Ciao, ti delego questo ticket:\n\n🏠 *${ticket.bookings?.properties_real?.nome}*\n⚠️ *${ticket.titolo}*\n📝 Note: ${notes}\n🛠 Fornitore suggerito: ${supplier}\n\nFammi sapere quando è risolto.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // CHIUDI TICKET (CONFERMA O RISOLUZIONE)
  const handleResolveFlow = async () => {
    try {
        setUploading(true);
        let receiptUrl = ticket.ricevuta_url;

        // 1. Upload Ricevuta se presente
        if (receiptFile) {
            const fileExt = receiptFile.name.split('.').pop();
            const fileName = `receipt_${ticket.id}_${Date.now()}.${fileExt}`;
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, receiptFile);
            if (upError) throw upError;
            receiptUrl = fileName;
        }

        // 2. Aggiorna Ticket
        const finalStatus = 'in_verifica'; // Mettiamo in verifica per far confermare all'ospite

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
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="management">1. Gestione & Delega</TabsTrigger>
                <TabsTrigger value="closing">2. Costi & Chiusura</TabsTrigger>
            </TabsList>

            {/* TAB 1: OPERATIVITÀ */}
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
                        />
                        <Input 
                            placeholder="Tel. Fornitore" 
                            value={supplierContact} 
                            onChange={e => setSupplierContact(e.target.value)} 
                            className="bg-white w-1/3"
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
                            />
                        </div>
                    </div>
                    <Textarea 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        placeholder="Es: Contattato idraulico, viene domani..."
                        className={shareNotes ? "border-blue-300 bg-blue-50" : ""}
                    />
                </div>

                {/* Delega a Socio */}
                <div className="border-t pt-4 mt-2">
                    <Label className="mb-2 block font-semibold text-slate-700">Non puoi farlo tu? Delega a un socio.</Label>
                    <div className="flex gap-2">
                        <Select onValueChange={setAssignedPartner}>
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
                            disabled={!assignedPartner}
                        >
                            <Share2 className="w-4 h-4 mr-2" /> Delega WhatsApp
                        </Button>
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={saveProgress}>Salva Stato (Senza Chiudere)</Button>
                </DialogFooter>
            </TabsContent>

            {/* TAB 2: COSTI & CHIUSURA */}
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
                                />
                            </div>
                            <div className="flex items-end">
                                <div className="flex items-center gap-2 mb-2">
                                    <Switch 
                                        id="cost-visible" 
                                        checked={costVisible} 
                                        onCheckedChange={setCostVisible} 
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
                                <Input type="file" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="bg-white text-sm" />
                                {ticket.ricevuta_url && !receiptFile && (
                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-white">
                                        <CheckCircle className="w-3 h-3 mr-1"/> Già presente
                                    </Badge>
                                )}
                            </div>
                            {costVisible && <p className="text-[10px] text-red-500 mt-1">* Se spuntato, l'ospite vedrà questo documento nel suo portale.</p>}
                        </div>
                    </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                    <Label className="font-bold text-green-800">Conclusione Intervento</Label>
                    <p className="text-sm text-gray-500">
                        Cliccando su "Completa", lo stato passerà a <b>In Verifica</b>. 
                        L'ospite o inquilino riceverà una notifica per confermare che il problema è stato risolto.
                    </p>
                    <Button 
                        className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg font-bold shadow-md mt-2"
                        onClick={handleResolveFlow}
                        disabled={uploading}
                    >
                        {uploading ? "Caricamento in corso..." : "✅ Completa Lavoro e Notifica Ospite"}
                    </Button>
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}