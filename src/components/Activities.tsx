import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Calendar, MessageSquare, UserCog, Plus, CheckCircle, RotateCcw, 
    Eye, Home, User, AlertTriangle, AlertCircle, StickyNote, 
    Phone, FileText, Share2 
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';
import TicketManager from '@/components/TicketManager';

// Helper locale per link
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

export default function Activities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: properties } = usePropertiesReal();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ticketManagerOpen, setTicketManagerOpen] = useState<any>(null); 

  const [formData, setFormData] = useState({
    titolo: '',
    descrizione: '',
    priorita: 'media',
    property_real_id: '',
    booking_id: 'none'
  });

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

  // CARICA TICKET CON TUTTE LE RELAZIONI
  const { data: tickets, isLoading, isError, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          properties_real (nome),
          assigned_partner: profiles!assigned_partner_id(first_name, phone),
          bookings (
            nome_ospite,
            telefono_ospite,
            properties_real (nome, indirizzo)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) { console.error(error); throw error; }
      return data;
    }
  });

  const createTicket = useMutation({
    mutationFn: async (newTicket: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        titolo: newTicket.titolo,
        descrizione: newTicket.descrizione,
        priorita: newTicket.priorita,
        property_real_id: newTicket.property_real_id || null,
        user_id: user?.id,
        creato_da: 'manager',
        stato: 'aperto',
        booking_id: newTicket.booking_id === 'none' ? null : newTicket.booking_id
      };
      
      const { error } = await supabase.from('tickets').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsDialogOpen(false);
      setFormData({ titolo: '', descrizione: '', priorita: 'media', property_real_id: '', booking_id: 'none' });
      toast({ title: "Ticket creato" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  const reopenTicket = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tickets')
        .update({ stato: 'aperto', cost: null, resolution_photo_url: null, quote_status: 'none' }) 
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: "Ticket Riaperto" });
    }
  });

  // Helper per aprire file
  const openFile = async (path: string) => {
      if(!path) return;
      const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  // Helper per WhatsApp Socio
  const contactPartner = (phone: string, title: string) => {
      window.open(`https://wa.me/${phone}?text=Ciao, info su ticket: ${title}`, '_blank');
  };

  const getPriorityColor = (p: string) => {
    if (p === 'alta' || p === 'critica') return 'bg-red-100 text-red-800 border-red-200';
    if (p === 'media') return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ticket & Manutenzioni</h1>
          <p className="text-gray-500">Gestione centralizzata di tutte le segnalazioni.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nuovo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Apri Ticket Interno</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label className="flex items-center gap-2"><Home className="w-4 h-4 text-blue-600"/> Proprietà</Label>
                <Select value={formData.property_real_id} onValueChange={v => setFormData({...formData, property_real_id: v, booking_id: 'none'})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2"><User className="w-4 h-4 text-green-600"/> Inquilino</Label>
                <Select value={formData.booking_id} onValueChange={v => setFormData({...formData, booking_id: v})} disabled={!formData.property_real_id}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Nessuno --</SelectItem>
                    {activeTenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.nome_ospite}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Titolo</Label><Input value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})} /></div>
              <div className="grid gap-2">
                <Label>Priorità</Label>
                <Select value={formData.priorita} onValueChange={v => setFormData({...formData, priorita: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bassa">Bassa</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Critica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Descrizione</Label><Textarea value={formData.descrizione} onChange={e => setFormData({...formData, descrizione: e.target.value})} /></div>
              <Button className="w-full bg-blue-600" onClick={() => createTicket.mutate(formData)}>Salva Ticket</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isError && <div className="bg-red-50 text-red-700 p-4 rounded flex gap-2"><AlertCircle className="w-5 h-5"/> Errore caricamento dati: {(error as any)?.message}</div>}

      <div className="grid gap-4">
        {isLoading ? <p>Caricamento...</p> : tickets?.map((ticket: any) => (
          <Card key={ticket.id} className={`border-l-4 shadow-sm hover:shadow-md ${ticket.stato === 'risolto' ? 'border-l-green-500 opacity-80 bg-slate-50' : 'border-l-red-500'}`}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg text-gray-900">{ticket.titolo}</h3>
                    <Badge variant="outline" className={getPriorityColor(ticket.priorita)}>{ticket.priorita}</Badge>
                    {ticket.creato_da === 'ospite' && <Badge className="bg-blue-100 text-blue-800 border-blue-200">Ospite</Badge>}
                    {ticket.stato === 'risolto' && <Badge className="bg-green-100 text-green-800 border-green-200">Risolto</Badge>}
                    {ticket.quote_status === 'pending' && <Badge className="bg-orange-100 text-orange-800 border-orange-200">Preventivo</Badge>}
                  </div>
                  
                  <p className="text-gray-700 text-sm mb-3">{ticket.descrizione}</p>
                  
                  {/* NOTE STAFF (Con Link Cliccabili) */}
                  {ticket.admin_notes && (
                    <div className="mt-2 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-2">
                        <StickyNote className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                        <div className="text-xs text-yellow-900 break-all">
                            <span className="font-bold block mb-1">Note Staff:</span> 
                            {renderTextWithLinks(ticket.admin_notes)}
                        </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-2">
                    <span className="flex items-center bg-gray-100 px-2 py-1 rounded border"><Calendar className="w-3 h-3 mr-1" /> {format(new Date(ticket.created_at), 'dd MMM')}</span>
                    {ticket.properties_real?.nome && <span className="font-medium text-gray-700 bg-orange-50 px-2 py-1 rounded border border-orange-100">🏠 {ticket.properties_real.nome}</span>}
                    {!ticket.properties_real?.nome && ticket.bookings?.properties_real?.nome && <span className="font-medium text-gray-700 bg-orange-50 px-2 py-1 rounded border border-orange-100">🏠 {ticket.bookings.properties_real.nome}</span>}
                    {ticket.bookings?.nome_ospite && <span className="font-medium text-blue-700">👤 {ticket.bookings.nome_ospite}</span>}
                  </div>

                  {/* AZIONI RAPIDE */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                      {ticket.supplier_contact && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50" 
                            onClick={() => window.open(`tel:${ticket.supplier_contact}`)} title={`Chiama: ${ticket.supplier}`}>
                              <Phone className="w-3 h-3" /> Chiama Fornitore
                          </Button>
                      )}
                      
                      {ticket.assigned_partner && ticket.assigned_partner.phone && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => contactPartner(ticket.assigned_partner.phone, ticket.titolo)} title={`Delegato a: ${ticket.assigned_partner.first_name}`}>
                              <Share2 className="w-3 h-3" /> Contatta {ticket.assigned_partner.first_name}
                          </Button>
                      )}

                      {(ticket.quote_url || ticket.ricevuta_url) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                            onClick={() => openFile(ticket.quote_url || ticket.ricevuta_url)}>
                              <FileText className="w-3 h-3" /> {ticket.quote_url ? 'Vedi Preventivo' : 'Vedi Ricevuta'}
                          </Button>
                      )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 w-full md:w-auto min-w-[140px]">
                   {ticket.stato !== 'risolto' ? (
                      <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => setTicketManagerOpen(ticket)}><UserCog className="w-4 h-4 mr-2" /> Gestisci</Button>
                   ) : (
                      <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" className="w-full text-gray-600 bg-white hover:bg-gray-50" onClick={() => setTicketManagerOpen(ticket)}><Eye className="w-3 h-3 mr-2" /> Vedi Storico</Button>
                          <Button size="sm" variant="ghost" className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { if(confirm("Vuoi riaprire questo ticket?")) reopenTicket.mutate(ticket.id); }}><RotateCcw className="w-3 h-3 mr-1" /> Riapri</Button>
                      </div>
                   )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {ticketManagerOpen && (
        <TicketManager 
            ticket={ticketManagerOpen} 
            isOpen={!!ticketManagerOpen} 
            onClose={() => setTicketManagerOpen(null)}
            onUpdate={() => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); }}
            isReadOnly={ticketManagerOpen.stato === 'risolto'} 
        />
      )}
    </div>
  );
}