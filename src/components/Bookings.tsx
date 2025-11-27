import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Plus, Copy, Eye, Palmtree, Home } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';
import { Badge } from '@/components/ui/badge';

export default function Bookings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: properties } = usePropertiesReal();

  const [formData, setFormData] = useState({
    property_id: '', nome_ospite: '', email_ospite: '', telefono_ospite: '',
    data_inizio: undefined as Date | undefined, data_fine: undefined as Date | undefined, tipo_affitto: 'breve'
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, properties_real(nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const createBooking = useMutation({
    mutationFn: async (newBooking: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('bookings').insert({ ...newBooking, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setIsDialogOpen(false);
      toast({ title: 'Prenotazione creata' });
      setFormData({
        property_id: '', nome_ospite: '', email_ospite: '', telefono_ospite: '',
        data_inizio: undefined, data_fine: undefined, tipo_affitto: 'breve'
      });
    },
    onError: (err: any) => {
        toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.property_id || !formData.data_inizio || !formData.data_fine || !formData.nome_ospite) return;
    createBooking.mutate({
      property_id: formData.property_id,
      nome_ospite: formData.nome_ospite,
      email_ospite: formData.email_ospite,
      telefono_ospite: formData.telefono_ospite,
      data_inizio: format(formData.data_inizio, 'yyyy-MM-dd'),
      data_fine: format(formData.data_fine, 'yyyy-MM-dd'),
      tipo_affitto: formData.tipo_affitto,
    });
  };

  const copyLink = (booking: any) => {
    const baseUrl = window.location.origin;
    // Logica intelligente: Link diverso in base al tipo
    const path = booking.tipo_affitto === 'breve' ? '/guest/' : '/tenant/';
    const fullUrl = `${baseUrl}${path}${booking.id}`;
    navigator.clipboard.writeText(fullUrl);
    toast({ title: "Link Copiato!", description: `Link per ${booking.tipo_affitto === 'breve' ? 'Turista' : 'Inquilino'} pronto.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Prenotazioni</h1>
        
         <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> Nuova</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
             <DialogHeader><DialogTitle>Nuova Prenotazione</DialogTitle></DialogHeader>
             <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                 
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                   <Label className="text-slate-700 font-bold mb-2 block">Tipo Contratto</Label>
                   <Select onValueChange={(v) => setFormData({...formData, tipo_affitto: v})} defaultValue="breve">
                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breve">🏖️ Affitto Breve (Turistico)</SelectItem>
                        <SelectItem value="lungo">🏠 Lungo Termine (Inquilino)</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>

                 <div className="grid gap-2">
                    <Label>Immobile</Label>
                    <Select onValueChange={(v) => setFormData({...formData, property_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>{properties?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}</SelectContent>
                    </Select>
                 </div>
                 <div className="grid gap-2">
                    <Label>Ospite / Inquilino</Label>
                    <Input value={formData.nome_ospite} onChange={e => setFormData({...formData, nome_ospite: e.target.value})} placeholder="Mario Rossi" required />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Check-in / Inizio</Label><Popover><PopoverTrigger asChild><Button variant={"outline"}>{formData.data_inizio ? format(formData.data_inizio, "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger><PopoverContent className="p-0"><Calendar mode="single" selected={formData.data_inizio} onSelect={(d) => setFormData({...formData, data_inizio: d})} /></PopoverContent></Popover></div>
                    <div className="grid gap-2"><Label>Check-out / Fine</Label><Popover><PopoverTrigger asChild><Button variant={"outline"}>{formData.data_fine ? format(formData.data_fine, "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger><PopoverContent className="p-0"><Calendar mode="single" selected={formData.data_fine} onSelect={(d) => setFormData({...formData, data_fine: d})} /></PopoverContent></Popover></div>
                 </div>
                 <Button type="submit" className="w-full">Salva</Button>
             </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bookings?.map((booking) => {
            const isShort = booking.tipo_affitto === 'breve';
            return (
              <Card key={booking.id} className={`border-l-4 shadow-sm hover:shadow-md transition-shadow ${isShort ? 'border-l-orange-400' : 'border-l-purple-500'}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-bold text-gray-800">{booking.nome_ospite}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">{booking.properties_real?.nome}</p>
                    </div>
                    <Badge variant="secondary" className={isShort ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}>
                        {isShort ? <Palmtree className="w-3 h-3 mr-1"/> : <Home className="w-3 h-3 mr-1"/>}
                        {isShort ? 'Turista' : 'Inquilino'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600 flex items-center gap-2 bg-gray-50 p-2 rounded">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      {format(new Date(booking.data_inizio), 'dd MMM')} - {format(new Date(booking.data_fine), 'dd MMM yyyy')}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="w-full border-dashed border-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200" onClick={() => copyLink(booking)}>
                            <Copy className="w-4 h-4 mr-2" /> Link Portale
                        </Button>
                        {booking.documenti_caricati ? (
                            <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => window.open(booking.documenti_url, '_blank')}>
                                <Eye className="w-4 h-4 mr-2" /> Vedi Doc
                            </Button>
                        ) : (
                            <Button size="sm" variant="ghost" className="w-full text-gray-400 cursor-not-allowed">
                                No Documenti
                            </Button>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
        })}
      </div>
    </div>
  );
}