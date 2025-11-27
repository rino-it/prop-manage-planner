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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar, CheckCircle, AlertTriangle, Clock, Plus, MessageSquare, CalendarPlus, MessageCircle, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Activities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Stato per la schedulazione
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    titolo: '',
    descrizione: '',
    priorita: 'media'
  });

  // 1. LEGGI I TICKET
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

  // 2. CREA TICKET
  const createTicket = useMutation({
    mutationFn: async (newTicket: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tickets').insert({
        ...newTicket,
        user_id: user?.id,
        creato_da: 'manager',
        stato: 'aperto'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsDialogOpen(false);
      setFormData({ titolo: '', descrizione: '', priorita: 'media' });
      toast({ title: "Ticket creato" });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" })
  });

  // 3. RISOLVI TICKET
  const resolveTicket = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tickets').update({ stato: 'risolto' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: "Ticket risolto!" });
    }
  });

  // --- LOGICA SCHEDULAZIONE ---
  const handleWhatsApp = (ticket: any) => {
    if (!scheduleDate) return;
    const phone = ticket.bookings?.telefono_ospite || ''; 
    const dateStr = format(scheduleDate, 'dd/MM/yyyy');
    const text = `Ciao ${ticket.bookings?.nome_ospite}, in merito alla segnalazione "${ticket.titolo}", confermo l'intervento tecnico per il giorno ${dateStr}. Cordiali saluti.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleGCalendar = (ticket: any) => {
    if (!scheduleDate) return;
    const title = `Intervento: ${ticket.titolo}`;
    const details = `Problema: ${ticket.descrizione}\nPresso: ${ticket.bookings?.properties_real?.nome}`;
    // Formato data YYYYMMDD
    const dateStr = format(scheduleDate, 'yyyyMMdd'); 
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&dates=${dateStr}/${dateStr}`;
    window.open(url, '_blank');
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
          <p className="text-gray-500">Gestisci le segnalazioni e pianifica gli interventi.</p>
        </div>
        
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
                <Input value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})} />
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
              <Button className="w-full" onClick={() => createTicket.mutate(formData)}>Salva Ticket</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* LISTA TICKET */}
      <div className="grid gap-4">
        {isLoading ? <p>Caricamento...</p> : tickets?.map((ticket) => (
          <Card key={ticket.id} className={`border-l-4 shadow-sm ${ticket.stato === 'risolto' ? 'border-l-green-500 opacity-70' : 'border-l-red-500'}`}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg">{ticket.titolo}</h3>
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
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center bg-gray-100 px-2 py-1 rounded"><Calendar className="w-3 h-3 mr-1" /> {format(new Date(ticket.created_at), 'dd MMM HH:mm')}</span>
                    {ticket.bookings?.properties_real?.nome && (
                      <span className="font-medium text-gray-700">🏠 {ticket.bookings.properties_real.nome}</span>
                    )}
                    {ticket.bookings?.nome_ospite && (
                      <span>👤 {ticket.bookings.nome_ospite}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 w-full md:w-auto">
                   {/* BOTTONE SCHEDULA (POPOVER) */}
                   {ticket.stato !== 'risolto' && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full border-orange-200 text-orange-700 hover:bg-orange-50">
                             <Wrench className="w-4 h-4 mr-2" /> Schedula
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="end">
                          <div className="space-y-4">
                            <h4 className="font-semibold leading-none border-b pb-2">Pianifica Intervento</h4>
                            <CalendarComponent mode="single" selected={scheduleDate} onSelect={setScheduleDate} className="rounded-md border shadow-sm" />
                            <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleWhatsApp(ticket)}>
                                    <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                                </Button>
                                <Button size="sm" variant="outline" className="w-full" onClick={() => handleGCalendar(ticket)}>
                                    <CalendarPlus className="w-4 h-4 mr-2" /> GCal
                                </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                   )}

                   {ticket.stato !== 'risolto' ? (
                      <Button size="sm" variant="outline" className="w-full text-green-600 border-green-200 hover:bg-green-50" onClick={() => resolveTicket.mutate(ticket.id)}>
                        <CheckCircle className="w-4 h-4 mr-2" /> Risolvi
                      </Button>
                   ) : (
                      <Badge variant="outline" className="w-full justify-center py-1 bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" /> Risolto
                      </Badge>
                   )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}