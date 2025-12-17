import React, { useState } from 'react';
import { useActivities, Activity } from '@/hooks/useActivities';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Wrench, AlertTriangle, CheckCircle, XCircle, FileText, Upload, Paperclip, Euro } from 'lucide-react';
import { format } from 'date-fns';

export default function TicketManager() {
  const { activities, createActivity, updateActivity, handleQuoteDecision, deleteActivity, isLoading } = useActivities();
  const { data: properties } = usePropertiesReal();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // FORM STATE
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    tipo: 'manutenzione',
    priorita: 'media',
    property_real_id: '',
    booking_id: '', // Inquilino
    quote_amount: ''
  });

  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // FETCH INQUILINI ATTIVI (Dipende dalla proprietà selezionata)
  const { data: activeTenants } = useQuery({
    queryKey: ['active-tenants-ticket', formData.property_real_id],
    queryFn: async () => {
        if (!formData.property_real_id) return [];
        const today = new Date().toISOString();
        const { data } = await supabase
            .from('bookings')
            .select('id, nome_ospite')
            .eq('property_id', formData.property_real_id)
            .lte('data_inizio', today)
            .gte('data_fine', today);
        return data || [];
    },
    enabled: !!formData.property_real_id
  });

  const resetForm = () => {
      setFormData({ nome: '', descrizione: '', tipo: 'manutenzione', priorita: 'media', property_real_id: '', booking_id: '', quote_amount: '' });
      setQuoteFile(null);
      setEditMode(false);
      setSelectedTicketId(null);
  };

  const openNewTicket = () => {
      resetForm();
      setIsDialogOpen(true);
  };

  const openEditTicket = (ticket: Activity) => {
      setEditMode(true);
      setSelectedTicketId(ticket.id);
      setFormData({
          nome: ticket.nome,
          descrizione: ticket.descrizione || '',
          tipo: ticket.tipo || 'manutenzione',
          priorita: ticket.priorita || 'media',
          property_real_id: ticket.property_real_id || '',
          booking_id: ticket.booking_id || '',
          quote_amount: ticket.quote_amount?.toString() || ''
      });
      setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
      setUploading(true);
      try {
          let quoteUrl = null;
          
          // Gestione Upload Preventivo
          if (quoteFile) {
            const fileName = `quote_${Date.now()}_${quoteFile.name}`;
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, quoteFile);
            if (upError) throw upError;
            quoteUrl = fileName;
          }

          const payload: any = {
              nome: formData.nome,
              descrizione: formData.descrizione,
              tipo: formData.tipo,
              priorita: formData.priorita,
              property_real_id: formData.property_real_id || null,
              booking_id: formData.booking_id || null,
          };

          // Se stiamo caricando un preventivo
          if (quoteUrl || formData.quote_amount) {
             if (quoteUrl) payload.quote_url = quoteUrl;
             if (formData.quote_amount) payload.quote_amount = parseFloat(formData.quote_amount);
             if (!editMode) payload.quote_status = 'pending'; // Se nuovo con preventivo
             else if (editMode && (quoteUrl || formData.quote_amount)) payload.quote_status = 'pending'; // Reset a pending se modifico
          }

          if (editMode && selectedTicketId) {
              await updateActivity.mutateAsync({ id: selectedTicketId, updates: payload });
          } else {
              await createActivity.mutateAsync(payload);
          }
          setIsDialogOpen(false);
          resetForm();
      } catch (error) {
          console.error(error);
      } finally {
          setUploading(false);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Manutenzione & Ticket</h1>
            <p className="text-gray-500">Gestisci guasti, preventivi e assegnazioni.</p>
        </div>
        <Button onClick={openNewTicket} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Apri Ticket
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>{editMode ? 'Gestione Ticket' : 'Nuovo Ticket Manutenzione'}</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="info" className="w-full mt-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="info">Dettagli Guasto</TabsTrigger>
                    <TabsTrigger value="quote" disabled={!editMode && !formData.quote_amount}>Preventivo & Costi</TabsTrigger>
                </TabsList>

                {/* TAB 1: INFO GENERALI */}
                <TabsContent value="info" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-red-600 font-semibold">Proprietà (Obbligatorio)*</Label>
                            <Select value={formData.property_real_id} onValueChange={(v) => setFormData({...formData, property_real_id: v})}>
                                <SelectTrigger><SelectValue placeholder="Seleziona casa..." /></SelectTrigger>
                                <SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Inquilino Coinvolto</Label>
                            <Select value={formData.booking_id} onValueChange={(v) => setFormData({...formData, booking_id: v})} disabled={!formData.property_real_id}>
                                <SelectTrigger><SelectValue placeholder={!formData.property_real_id ? "Prima la casa" : "Seleziona (Opzionale)..."} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="nessuno">-- Nessuno / Area Comune --</SelectItem>
                                    {activeTenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.nome_ospite}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Oggetto Ticket</Label>
                        <Input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Es. Perdita lavandino cucina" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div className="grid gap-2">
                            <Label>Tipo</Label>
                            <Select value={formData.tipo} onValueChange={(v: any) => setFormData({...formData, tipo: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manutenzione">🔧 Manutenzione</SelectItem>
                                    <SelectItem value="pulizia">🧹 Pulizia</SelectItem>
                                    <SelectItem value="ispezione">🔍 Ispezione</SelectItem>
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="grid gap-2">
                            <Label>Priorità</Label>
                            <Select value={formData.priorita} onValueChange={(v: any) => setFormData({...formData, priorita: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bassa">🟢 Bassa</SelectItem>
                                    <SelectItem value="media">🟡 Media</SelectItem>
                                    <SelectItem value="alta">🔴 Alta</SelectItem>
                                </SelectContent>
                            </Select>
                         </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Descrizione Dettagliata</Label>
                        <Textarea value={formData.descrizione} onChange={e => setFormData({...formData, descrizione: e.target.value})} placeholder="Descrivi il problema..." />
                    </div>
                </TabsContent>

                {/* TAB 2: GESTIONE PREVENTIVI */}
                <TabsContent value="quote" className="space-y-4 pt-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <Euro className="w-5 h-5 text-blue-600" /> Caricamento Preventivo
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                             <div className="grid gap-2">
                                <Label>Importo Preventivato (€)</Label>
                                <Input type="number" value={formData.quote_amount} onChange={e => setFormData({...formData, quote_amount: e.target.value})} placeholder="0.00" />
                             </div>
                             <div className="grid gap-2">
                                <Label>Allegato (PDF/IMG)</Label>
                                <Input type="file" onChange={e => setQuoteFile(e.target.files?.[0] || null)} />
                             </div>
                        </div>
                        <p className="text-xs text-gray-500">*Caricando un nuovo preventivo, lo stato tornerà "In Valutazione".</p>
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
                <Button onClick={handleSubmit} disabled={uploading || !formData.property_real_id || !formData.nome}>
                    {uploading ? "Salvataggio..." : (editMode ? "Aggiorna Ticket" : "Crea Ticket")}
                </Button>
            </div>
          </DialogContent>
      </Dialog>

      {/* LISTA TICKETS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? <p>Caricamento...</p> : activities?.map((ticket) => (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow relative overflow-hidden">
                  {/* Status Bar Colorata */}
                  <div className={`absolute top-0 left-0 w-1 h-full 
                      ${ticket.stato === 'completato' ? 'bg-green-500' : 
                        ticket.priorita === 'alta' ? 'bg-red-500' : 'bg-blue-500'}`} 
                  />
                  
                  <CardHeader className="pb-2 pl-6">
                      <div className="flex justify-between items-start">
                          <Badge variant="outline" className="uppercase text-[10px] tracking-wider mb-1">
                              {ticket.tipo}
                          </Badge>
                          <Badge className={
                              ticket.stato === 'completato' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 
                              ticket.quote_status === 'pending' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' : 'bg-slate-100 text-slate-700 hover:bg-slate-100'
                          }>
                              {ticket.quote_status === 'pending' ? 'PREVENTIVO?' : ticket.stato}
                          </Badge>
                      </div>
                      <CardTitle className="text-lg leading-tight">{ticket.nome}</CardTitle>
                      <CardDescription className="flex flex-col gap-1 mt-1">
                          <span className="flex items-center gap-1 font-medium text-gray-900">
                             🏠 {ticket.properties_real?.nome || 'N/A'}
                          </span>
                          {ticket.bookings && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit">
                                  👤 {ticket.bookings.nome_ospite}
                              </span>
                          )}
                      </CardDescription>
                  </CardHeader>

                  <CardContent className="pl-6 pt-2">
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                          {ticket.descrizione || "Nessuna descrizione."}
                      </p>

                      {/* SEZIONE PREVENTIVO SMART */}
                      {ticket.quote_amount && (
                          <div className="bg-slate-50 p-3 rounded-md mb-4 border border-slate-100">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-bold text-slate-700">Preventivo: €{ticket.quote_amount}</span>
                                  {ticket.quote_url && (
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Scarica">
                                          <Paperclip className="w-3 h-3" />
                                      </Button>
                                  )}
                              </div>
                              
                              {/* Workflow Approvazione */}
                              {ticket.quote_status === 'pending' && (
                                  <div className="flex gap-2">
                                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 h-7 text-xs" 
                                        onClick={() => handleQuoteDecision.mutate({ id: ticket.id, decision: 'approved' })}>
                                          <CheckCircle className="w-3 h-3 mr-1" /> Approva
                                      </Button>
                                      <Button size="sm" variant="destructive" className="w-full h-7 text-xs"
                                        onClick={() => handleQuoteDecision.mutate({ id: ticket.id, decision: 'rejected' })}>
                                          <XCircle className="w-3 h-3 mr-1" /> Rifiuta
                                      </Button>
                                  </div>
                              )}
                              
                              {ticket.quote_status === 'approved' && (
                                  <div className="text-xs text-green-600 flex items-center gap-1 font-bold bg-green-50 p-1 rounded justify-center">
                                      <CheckCircle className="w-3 h-3" /> SPESA APPROVATA
                                  </div>
                              )}
                               {ticket.quote_status === 'rejected' && (
                                  <div className="text-xs text-red-600 flex items-center gap-1 font-bold bg-red-50 p-1 rounded justify-center">
                                      <XCircle className="w-3 h-3" /> RIFIUTATO
                                  </div>
                              )}
                          </div>
                      )}

                      <div className="flex justify-between items-center mt-4 border-t pt-3">
                          <span className="text-xs text-gray-400">{format(new Date(ticket.created_at), 'dd MMM yyyy')}</span>
                          <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditTicket(ticket)}>Gestisci</Button>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          ))}
      </div>
    </div>
  );
}