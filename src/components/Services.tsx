import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Ship, Euro, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Services() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    titolo: '',
    descrizione: '',
    prezzo: '',
    immagine_url: '',
    link_prenotazione: ''
  });

  // 1. LEGGI I SERVIZI
  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // 2. CREA SERVIZIO
  const createService = useMutation({
    mutationFn: async (newService: any) => {
      const { data, error } = await supabase.from('services').insert([{
        ...newService,
        prezzo: parseFloat(newService.prezzo) || 0
      }]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setIsDialogOpen(false);
      setFormData({ titolo: '', descrizione: '', prezzo: '', immagine_url: '', link_prenotazione: '' });
      toast({ title: 'Servizio creato', description: 'Ora visibile agli ospiti.' });
    },
    onError: () => toast({ title: 'Errore', variant: 'destructive' })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createService.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Servizi & Esperienze</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Servizio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crea Nuova Esperienza</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Titolo (es. Gita in Barca)</Label>
                <Input required value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Descrizione</Label>
                <Textarea required value={formData.descrizione} onChange={e => setFormData({...formData, descrizione: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Prezzo (€)</Label>
                  <Input type="number" required value={formData.prezzo} onChange={e => setFormData({...formData, prezzo: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Link Esterno (Opzionale)</Label>
                  <Input placeholder="https://..." value={formData.link_prenotazione} onChange={e => setFormData({...formData, link_prenotazione: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>URL Immagine (Copia indirizzo immagine da Google)</Label>
                <Input placeholder="https://..." value={formData.immagine_url} onChange={e => setFormData({...formData, immagine_url: e.target.value})} />
              </div>
              <Button type="submit" className="w-full bg-blue-600">Pubblica Servizio</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <p>Caricamento...</p> : services?.map((service) => (
          <Card key={service.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="h-48 bg-gray-100 relative">
              {service.immagine_url ? (
                <img src={service.immagine_url} alt={service.titolo} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-12 h-12" />
                </div>
              )}
              <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full font-bold text-sm shadow-sm">
                €{service.prezzo}
              </div>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="w-5 h-5 text-blue-500" />
                {service.titolo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 line-clamp-3">{service.descrizione}</p>
            </CardContent>
            {service.link_prenotazione && (
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => window.open(service.link_prenotazione, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Vedi Link
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}