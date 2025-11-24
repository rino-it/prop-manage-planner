import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CheckCircle, AlertTriangle, Clock, Plus, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function Activities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form per nuovi ticket manuali (Admin)
  const [formData, setFormData] = useState({
    titolo: '',
    descrizione: '',
    priorita: 'media'
  });

  // 1. LEGGI I TICKET DAL DB
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          bookings (
            nome_ospite,
            properties_real (nome)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // 2. CREA TICKET (Manuale Admin)
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
      toast({ title: "Ticket creato", description: "Attività registrata con successo." });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" })
  });

  // 3. AGGIORNA STATO (Risolvi)
  const resolveTicket = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tickets').update({ stato: 'risolto' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: "Ticket risolto", description: "Ottimo lavoro!" });
    }
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
          <p className="text-gray-500">Gestisci le segnalazioni degli ospiti e i lavori.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nuovo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apri Ticket Interno</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Titolo Problema</Label>
                <Input value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})} placeholder="Es. Caldaia rotta" />
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

      {/* STATISTICHE RAPIDE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-full text-red-600"><AlertTriangle /></div>
            <div>
              <p className="text-sm text-gray-500">Aperti</p>
              <p className="text-2xl font-bold">{tickets?.filter(t => t.stato === 'aperto').length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-full text-orange-600"><Clock /></div>
            <div>
              <p className="text-sm text-gray-500">In Lavorazione</p>
              <p className="text-2xl font-bold">{tickets?.filter(t => t.stato === 'in_lavorazione').length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full text-green-600"><CheckCircle /></div>
            <div>
              <p className="text-sm text-gray-500">Risolti</p>
              <p className="text-2xl font-bold">{tickets?.filter(t => t.stato === 'risolto').length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LISTA TICKET */}
      <div className="grid gap-4">
        {isLoading ? <p>Caricamento...</p> : tickets?.map((ticket) => (
          <Card key={ticket.id} className={`border-l-4 ${ticket.stato === 'risolto' ? 'border-l-green-500 opacity-60' : 'border-l-red-500'}`}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg">{ticket.titolo}</h3>
                    <Badge variant="outline" className={getPriorityColor(ticket.priorita || 'media')}>
                      {ticket.priorita}
                    </Badge>
                    {ticket.creato_da === 'ospite' && (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
                        <MessageSquare className="w-3 h-3 mr-1" /> Ospite
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{ticket.descrizione}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {format(new Date(ticket.created_at), 'dd MMM HH:mm')}</span>
                    {ticket.bookings?.properties_real?.nome && (
                      <span>🏠 {ticket.bookings.properties_real.nome}</span>
                    )}
                    {ticket.bookings?.nome_ospite && (
                      <span>👤 {ticket.bookings.nome_ospite}</span>
                    )}
                  </div>
                </div>
                
                {ticket.stato !== 'risolto' && (
                  <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => resolveTicket.mutate(ticket.id)}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Risolvi
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {tickets?.length === 0 && (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Tutto tranquillo! Nessun ticket aperto.</p>
          </div>
        )}
      </div>
    </div>
  );
}