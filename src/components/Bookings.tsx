import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Plus, User, Eye, CheckCircle, XCircle, FileText, ExternalLink, Mail, Phone, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';

export default function Bookings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: properties } = usePropertiesReal();

  const [formData, setFormData] = useState({
    property_id: '', nome_ospite: '', email_ospite: '', telefono_ospite: '',
    data_inizio: undefined as Date | undefined, data_fine: undefined as Date | undefined, tipo_affitto: 'breve'
  });

  // LETTURA
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

  // UPDATE STATO
  const updateDocStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('bookings').update({ stato_documenti: status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSelectedDoc(null);
      toast({ title: "Stato aggiornato" });
    }
  });

  // CREA
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

  const getDocUrl = (path: string) => {
    if (!path) return '';
    return supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;
  };

  // --- FUNZIONE CHE MANCAVA ---
  const copyLink = (booking: any) => {
    const baseUrl = window.location.origin;
    const path = booking.tipo_affitto === 'breve' ? '/guest/' : '/tenant/';
    const fullUrl = `${baseUrl}${path}${booking.id}`;
    navigator.clipboard.writeText(fullUrl);
    toast({ title: "Link Copiato!", description: "Incolla il link al cliente." });
  };

  const isPdf = (path: string) => path?.toLowerCase().endsWith('.pdf');

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
                 
                 <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                   <Label className="text-blue-800 font-bold mb-2 block">Tipo Contratto</Label>
                   <Select onValueChange={(v) => setFormData({...formData, tipo_affitto: v})} defaultValue="breve">
                      <SelectTrigger className="bg-white border-blue-200"><SelectValue /></SelectTrigger>
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
                    <Label>Ospite</Label>
                    <Input value={formData.nome_ospite} onChange={e => setFormData({...formData, nome_ospite: e.target.value})} placeholder="Mario Rossi" required />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Email</Label><Input value={formData.email_ospite} onChange={e => setFormData({...formData, email_ospite: e.target.value})} /></div>
                    <div className="grid gap-2"><Label>Telefono</Label><Input value={formData.telefono_ospite} onChange={e => setFormData({...formData, telefono_ospite: e.target.value})} /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Check-in</Label><Popover><PopoverTrigger asChild><Button variant={"outline"}>{formData.data_inizio ? format(formData.data_inizio, "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger><PopoverContent className="p-0"><Calendar mode="single" selected={formData.data_inizio} onSelect={(d) => setFormData({...formData, data_inizio: d})} /></PopoverContent></Popover></div>
                    <div className="grid gap-2"><Label>Check-out</Label><Popover><PopoverTrigger asChild><Button variant={"outline"}>{formData.data_fine ? format(formData.data_fine, "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger><PopoverContent className="p-0"><Calendar mode="single" selected={formData.data_fine} onSelect={(d) => setFormData({...formData, data_fine: d})} /></PopoverContent></Popover></div>
                 </div>
                 <Button type="submit" className="w-full">Salva</Button>
             </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Verifica Documento</DialogTitle></DialogHeader>
            {selectedDoc && (
              <div className="space-y-4">
                <div className="bg-gray-100 p-4 rounded-lg flex justify-center items-center min-h-[300px]">
                  {isPdf(selectedDoc.documenti_url) ? (
                    <Button variant="outline" onClick={() => window.open(getDocUrl(selectedDoc.documenti_url), '_blank')}>Apri PDF</Button>
                  ) : (
                    <img src={getDocUrl(selectedDoc.documenti_url)} alt="Doc" className="max-h-[500px] w-auto object-contain" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-green-600" onClick={() => updateDocStatus.mutate({ id: selectedDoc.id, status: 'approvato' })}>Approva</Button>
                  <Button className="flex-1 bg-red-600" onClick={() => updateDocStatus.mutate({ id: selectedDoc.id, status: 'rifiutato' })}>Rifiuta</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bookings?.map((booking) => (
          <Card key={booking.id} className="border-l-4" style={{ borderLeftColor: booking.tipo_affitto === 'breve' ? '#22c55e' : '#a855f7' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex justify-between">
                {booking.nome_ospite}
                <span className="text-xs font-normal px-2 py-1 bg-gray-100 rounded">{booking.properties_real?.nome}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  {format(new Date(booking.data_inizio), 'dd MMM')} - {format(new Date(booking.data_fine), 'dd MMM')}
                </div>
                
                {/* --- IL BOTTONE CHE MANCAVA --- */}
                <Button variant="outline" size="sm" className="w-full border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => copyLink(booking)}>
                    <Copy className="w-4 h-4 mr-2" /> Copia Link App
                </Button>

                {booking.stato_documenti === 'in_revisione' && (
                  <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => setSelectedDoc(booking)}>
                    <Eye className="w-4 h-4 mr-2" /> Revisiona Doc
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}