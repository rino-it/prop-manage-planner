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
import { Calendar, MessageSquare, UserCog, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import TicketManager from '@/components/TicketManager'; // <--- IL NOSTRO SUPER COMPONENTE

export default function Activities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // STATI
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ticketManagerOpen, setTicketManagerOpen] = useState<any>(null); // Per aprire il pannello gestione

  const [formData, setFormData] = useState({
    titolo: '',
    descrizione: '',
    priorita: 'media',
    booking_id: 'none' // Opzionale: collegare a una prenotazione specifica se serve
  });

  // 1. CARICA TUTTI I TICKET (Globali)
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          bookings (
            nome_ospite,
            telefono_ospite,
            properties_real (nome, indirizzo)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // 2. CREA TICKET INTERNO
  const createTicket = useMutation({
    mutationFn: async (newTicket: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Se non è collegato a un booking, lasciamo booking_id null
      const payload = {
        ...newTicket,
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
      setFormData({ titolo: '', descrizione: '', priorita: 'media', booking_id: 'none' });
      toast({ title: "Ticket creato", description: "Aggiunto alla lista attività." });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" })
  });

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
        
        {/* DIALOG NUOVO TICKET */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nuovo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Apri Ticket Interno</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Titolo Problema</Label>
                <Input value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})} placeholder="Es. Controllo Caldaia Generale" />
              </div>
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
              <div className="grid gap-2">
                <Label>Descrizione</Label>
                <Textarea value={formData.descrizione} onChange={e => setFormData({...formData, descrizione: e.target.value})} />
              </div>
              <Button className="w-full bg-blue-600" onClick={() => createTicket.mutate(formData)}>Salva Ticket</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* LISTA TICKET */}
      <div className="grid gap-4">
        {isLoading ? <p>Caricamento...</p> : tickets?.map((ticket) => (
          <Card key={ticket.id} className={`border-l-4 shadow-sm transition-all hover:shadow-md ${ticket.stato === 'risolto' ? 'border-l-green-500 opacity-60 bg-gray-50' : 'border-l-red-500'}`}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                
                {/* INFO TICKET */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg text-gray-900">{ticket.titolo}</h3>
                    <Badge variant="outline" className={getPriorityColor(ticket.priorita || 'media')}>
                      {ticket.priorita}
                    </Badge>
                    {ticket.creato_da === 'ospite' && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        <MessageSquare className="w-3 h-3 mr-1" /> Ospite
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-gray-700 text-sm mb-3">{ticket.descrizione}</p>
                  
                  {/* METADATI */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center bg-gray-100 px-2 py-1 rounded border">
                        <Calendar className="w-3 h-3 mr-1" /> {format(new Date(ticket.created_at), 'dd MMM HH:mm')}
                    </span>
                    {ticket.bookings?.properties_real?.nome && (
                      <span className="font-medium text-gray-700 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                        🏠 {ticket.bookings.properties_real.nome}
                      </span>
                    )}
                    {ticket.bookings?.nome_ospite && (
                      <span className="font-medium text-blue-700">
                        👤 {ticket.bookings.nome_ospite}
                      </span>
                    )}
                    {ticket.supplier && (
                        <span className="font-medium text-purple-700">
                            🛠️ {ticket.supplier}
                        </span>
                    )}
                  </div>
                </div>
                
                {/* AZIONI */}
                <div className="flex flex-col gap-2 w-full md:w-auto min-w-[140px]">
                   {ticket.stato !== 'risolto' ? (
                      <Button 
                        size="sm" 
                        className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm"
                        onClick={() => setTicketManagerOpen(ticket)} // APRE IL SUPER PANNELLO
                      >
                         <UserCog className="w-4 h-4 mr-2" /> Gestisci
                      </Button>
                   ) : (
                      <div className="flex flex-col gap-2">
                          <Badge variant="outline" className="w-full justify-center py-1 bg-green-50 text-green-700 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" /> Risolto
                          </Badge>
                          {/* Permetti comunque di riaprire/rivedere lo storico */}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full text-xs text-gray-400 hover:text-gray-600"
                            onClick={() => setTicketManagerOpen(ticket)}
                          >
                             Vedi dettagli
                          </Button>
                      </div>
                   )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* INTEGRAZIONE TICKET MANAGER */}
      {ticketManagerOpen && (
        <TicketManager 
            ticket={ticketManagerOpen} 
            isOpen={!!ticketManagerOpen} 
            onClose={() => setTicketManagerOpen(null)}
            onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['tickets'] }); // Ricarica la lista globale
            }}
        />
      )}
    </div>
  );
}