import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Filter, User, Home, Truck, Plus } from 'lucide-react';
import { format } from 'date-fns';
import TicketManager from '@/components/TicketManager';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';

export default function Tickets() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const [newTicketType, setNewTicketType] = useState<'real' | 'mobile'>('real');
  const [newTicketData, setNewTicketData] = useState({
      target_id: '',
      title: '',
      description: '',
      priority: 'media'
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: realProps } = usePropertiesReal();
  const { data: mobileProps } = useQuery({
      queryKey: ['mobile-props-simple'],
      queryFn: async () => {
          const { data } = await supabase.from('properties_mobile').select('id, veicolo, targa').eq('status', 'active');
          return data || [];
      }
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['all-tickets', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select(`*, properties_real (nome), properties_mobile (veicolo, targa), bookings (nome_ospite)`)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        if (filterStatus === 'active') query = query.neq('stato', 'risolto');
        else query = query.eq('stato', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const createTicket = useMutation({
      mutationFn: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          const payload: any = {
              titolo: newTicketData.title,
              descrizione: newTicketData.description,
              priorita: newTicketData.priority,
              stato: 'aperto',
              creato_da: 'staff',
              user_id: user?.id,
              property_real_id: newTicketType === 'real' ? newTicketData.target_id : null,
              property_mobile_id: newTicketType === 'mobile' ? newTicketData.target_id : null
          };
          const { error } = await supabase.from('tickets').insert(payload);
          if (error) throw error;
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['all-tickets'] });
          setIsCreateOpen(false);
          setNewTicketData({ target_id: '', title: '', description: '', priority: 'media' });
          toast({ title: "Ticket creato" });
      },
      onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'aperto': return 'bg-red-100 text-red-800';
      case 'in_lavorazione': return 'bg-blue-100 text-blue-800';
      case 'in_verifica': return 'bg-orange-100 text-orange-800';
      case 'risolto': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Ticket</h1>
          <p className="text-gray-500 text-sm">Segnalazioni Immobili e Parco Mezzi</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2"/> Nuovo Ticket
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b bg-slate-50">
            <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Elenco Segnalazioni</CardTitle>
                <div className="flex gap-2">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[180px] bg-white"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Filtra stato" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutti</SelectItem>
                            <SelectItem value="active">Attivi (Non risolti)</SelectItem>
                            <SelectItem value="aperto">Aperti</SelectItem>
                            <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
                            <SelectItem value="in_verifica">In Verifica</SelectItem>
                            <SelectItem value="risolto">Risolti</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Oggetto</TableHead>
                        <TableHead>Titolo</TableHead>
                        <TableHead>Priorità</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tickets.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center p-8 text-gray-400">Nessun ticket trovato.</TableCell></TableRow>
                    ) : (
                        tickets.map((ticket: any) => (
                            <TableRow key={ticket.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedTicket(ticket)}>
                                <TableCell className="text-xs text-gray-500 font-mono">
                                    {format(new Date(ticket.created_at), 'dd/MM/yy')}
                                </TableCell>
                                <TableCell>
                                    {ticket.properties_mobile ? (
                                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                                            <Truck className="w-4 h-4 text-blue-600"/> {ticket.properties_mobile.veicolo}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                                            <Home className="w-4 h-4 text-orange-600"/> {ticket.properties_real?.nome || 'Generale'}
                                        </div>
                                    )}
                                    {ticket.bookings && <span className="text-[10px] text-gray-400 flex items-center gap-1"><User className="w-3 h-3"/> {ticket.bookings.nome_ospite}</span>}
                                </TableCell>
                                <TableCell className="font-semibold text-gray-900">{ticket.titolo}</TableCell>
                                <TableCell>
                                    {ticket.priorita === 'alta' && <Badge variant="destructive">ALTA</Badge>}
                                    {ticket.priorita === 'media' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">MEDIA</Badge>}
                                    {ticket.priorita === 'bassa' && <Badge variant="outline">BASSA</Badge>}
                                </TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(ticket.stato)}`}>{ticket.stato.replace('_', ' ')}</span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">Gestisci</Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
              <DialogHeader><DialogTitle>Nuovo Ticket di Manutenzione</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="flex p-1 bg-slate-100 rounded-lg">
                      <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${newTicketType === 'real' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`} onClick={() => { setNewTicketType('real'); setNewTicketData({...newTicketData, target_id: ''}); }}><Home className="w-4 h-4"/> Immobile</button>
                      <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${newTicketType === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`} onClick={() => { setNewTicketType('mobile'); setNewTicketData({...newTicketData, target_id: ''}); }}><Truck className="w-4 h-4"/> Veicolo</button>
                  </div>
                  <div className="grid gap-2">
                      <Label>Seleziona {newTicketType === 'real' ? 'Proprietà' : 'Mezzo'}</Label>
                      <Select value={newTicketData.target_id} onValueChange={(v) => setNewTicketData({...newTicketData, target_id: v})}>
                          <SelectTrigger><SelectValue placeholder="Seleziona..."/></SelectTrigger>
                          <SelectContent>
                              {newTicketType === 'real' ? realProps?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>) : mobileProps?.map(m => <SelectItem key={m.id} value={m.id}>{m.veicolo} ({m.targa})</SelectItem>)}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="grid gap-2"><Label>Titolo</Label><Input value={newTicketData.title} onChange={e => setNewTicketData({...newTicketData, title: e.target.value})} /></div>
                  <div className="grid gap-2"><Label>Descrizione</Label><Input value={newTicketData.description} onChange={e => setNewTicketData({...newTicketData, description: e.target.value})} /></div>
                  <Button className="w-full bg-blue-600" onClick={() => createTicket.mutate()} disabled={!newTicketData.target_id || !newTicketData.title}>Crea Ticket</Button>
              </div>
          </DialogContent>
      </Dialog>

      {selectedTicket && <TicketManager ticket={selectedTicket} isOpen={!!selectedTicket} onClose={() => setSelectedTicket(null)} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['all-tickets'] })} />}
    </div>
  );
}