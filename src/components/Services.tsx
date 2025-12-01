import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, ExternalLink, Image as ImageIcon, MapPin, Trash2, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';

export default function Services() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: properties } = usePropertiesReal();

  const emptyForm = {
    titolo: '', descrizione: '', prezzo: '', immagine_url: '', link_prenotazione: '', property_ids: [] as string[]
  };
  const [formData, setFormData] = useState(emptyForm);

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const upsertService = useMutation({
    mutationFn: async (serviceData: any) => {
      const payload = {
        titolo: serviceData.titolo,
        descrizione: serviceData.descrizione,
        prezzo: parseFloat(serviceData.prezzo) || 0,
        immagine_url: serviceData.immagine_url,
        link_prenotazione: serviceData.link_prenotazione,
        property_ids: serviceData.property_ids
      };

      if (editingService) {
        const { error } = await supabase.from('services').update(payload).eq('id', editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setIsDialogOpen(false);
      setEditingService(null);
      setFormData(emptyForm);
      toast({ title: editingService ? 'Aggiornato!' : 'Creato!', description: 'Il servizio è online.' });
    },
    onError: () => toast({ title: 'Errore', variant: 'destructive' })
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: 'Eliminato', variant: 'destructive' });
    }
  });

  const toggleProperty = (propId: string) => {
    setFormData(prev => {
      const exists = prev.property_ids?.includes(propId);
      return {
        ...prev,
        property_ids: exists ? prev.property_ids.filter(id => id !== propId) : [...(prev.property_ids || []), propId]
      };
    });
  };

  const openEdit = (service: any) => {
    setEditingService(service);
    setFormData({
      titolo: service.titolo,
      descrizione: service.descrizione,
      prezzo: service.prezzo,
      immagine_url: service.immagine_url,
      link_prenotazione: service.link_prenotazione,
      property_ids: service.property_ids || []
    });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingService(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-gray-900">Servizi & Esperienze</h1><p className="text-gray-500">Gestisci i servizi per gli ospiti.</p></div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nuovo Servizio</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader><DialogTitle>{editingService ? 'Modifica Servizio' : 'Nuovo Servizio'}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid gap-2"><Label>Titolo</Label><Input value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})} /></div>
              <div className="grid gap-2"><Label>Descrizione</Label><Textarea value={formData.descrizione} onChange={e => setFormData({...formData, descrizione: e.target.value})} /></div>
              
              <div className="grid gap-2 border p-3 rounded-md bg-slate-50">
                <Label className="mb-2 flex items-center gap-2 text-blue-700 font-semibold"><MapPin className="w-4 h-4" /> Disponibilità:</Label>
                <ScrollArea className="h-[120px] pr-4">
                    <div className="grid grid-cols-2 gap-2">
                        {properties?.map(prop => (
                            <div key={prop.id} className="flex items-center space-x-2 bg-white p-2 rounded border">
                                <Checkbox id={`prop-${prop.id}`} checked={formData.property_ids?.includes(prop.id)} onCheckedChange={() => toggleProperty(prop.id)} />
                                <label htmlFor={`prop-${prop.id}`} className="text-xs font-medium cursor-pointer truncate w-full">{prop.nome}</label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Prezzo (€)</Label><Input type="number" value={formData.prezzo} onChange={e => setFormData({...formData, prezzo: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Link Partner/Pagamento</Label><Input placeholder="https://..." value={formData.link_prenotazione} onChange={e => setFormData({...formData, link_prenotazione: e.target.value})} /></div>
              </div>
              <div className="grid gap-2"><Label>URL Immagine</Label><Input placeholder="https://..." value={formData.immagine_url} onChange={e => setFormData({...formData, immagine_url: e.target.value})} /></div>
              <Button className="w-full bg-blue-600" onClick={() => upsertService.mutate(formData)}>{editingService ? 'Salva Modifiche' : 'Pubblica'}</Button>
            </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <p>Caricamento...</p> : services?.map((service) => (
          <Card key={service.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col group relative">
            <div className="h-48 bg-gray-100 relative">
              {service.immagine_url ? <img src={service.immagine_url} alt={service.titolo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon className="w-12 h-12" /></div>}
              <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full font-bold text-sm shadow-sm">€{service.prezzo}</div>
            </div>
            
            <div className="absolute top-2 left-2 flex gap-2">
                <Button size="icon" variant="secondary" className="h-8 w-8 bg-white shadow-md hover:bg-blue-50 border" onClick={() => openEdit(service)}><Pencil className="w-4 h-4 text-blue-600" /></Button>
                <Button size="icon" variant="secondary" className="h-8 w-8 bg-white shadow-md hover:bg-red-50 border" onClick={() => deleteService.mutate(service.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
            </div>

            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">{service.titolo}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1"><p className="text-sm text-gray-600 line-clamp-3">{service.descrizione}</p></CardContent>
            {service.link_prenotazione && <CardFooter className="pt-0"><Button variant="outline" className="w-full bg-slate-50" onClick={() => window.open(service.link_prenotazione, '_blank')}><ExternalLink className="w-4 h-4 mr-2" /> Vedi Offerta</Button></CardFooter>}
          </Card>
        ))}
      </div>
    </div>
  );
}