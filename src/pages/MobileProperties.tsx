import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Car, Plus, Trash2, FileText, Shield, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Tipo aggiornato manualmente per includere i file (in attesa di codegen)
type MobileProperty = {
  id: string;
  veicolo: string;
  targa: string;
  status: string;
  proprietario: string | null;
  libretto_url?: string | null;
  insurance_url?: string | null;
};

export default function MobileProperties() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // STATO FORM
  const [formData, setFormData] = useState({
    veicolo: '',
    targa: '',
    proprietario: '',
    libretto: null as File | null,
    insurance: null as File | null
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // FETCH VEICOLI
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['mobile-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties_mobile')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MobileProperty[];
    }
  });

  // HELPER UPLOAD
  const uploadFile = async (file: File, path: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}_${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('vehicle-docs')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Ottieni URL pubblico
    const { data } = supabase.storage.from('vehicle-docs').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // CREATE VEICOLO
  const createVehicle = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        let librettoUrl = null;
        let insuranceUrl = null;

        // Upload Libretto
        if (formData.libretto) {
          librettoUrl = await uploadFile(formData.libretto, `libretto_${formData.targa}`);
        }

        // Upload Assicurazione
        if (formData.insurance) {
          insuranceUrl = await uploadFile(formData.insurance, `insurance_${formData.targa}`);
        }

        const { error } = await supabase.from('properties_mobile').insert({
          veicolo: formData.veicolo,
          targa: formData.targa,
          proprietario: formData.proprietario,
          user_id: user.id,
          status: 'active',
          libretto_url: librettoUrl,
          insurance_url: insuranceUrl
        });

        if (error) throw error;

      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-properties'] });
      setIsDialogOpen(false);
      setFormData({ veicolo: '', targa: '', proprietario: '', libretto: null, insurance: null });
      toast({ title: "Veicolo Aggiunto", description: "Documenti caricati con successo." });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  });

  // DELETE VEICOLO
  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties_mobile').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-properties'] });
      toast({ title: "Veicolo Eliminato" });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'libretto' | 'insurance') => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, [field]: e.target.files![0] }));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Flotta</h1>
          <p className="text-gray-500">Monitora veicoli, scadenze e documenti.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Aggiungi Veicolo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nuovo Veicolo</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="veicolo">Modello Veicolo</Label>
                <Input 
                  id="veicolo" 
                  placeholder="Es. Fiat Panda 4x4" 
                  value={formData.veicolo} 
                  onChange={(e) => setFormData({...formData, veicolo: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="targa">Targa</Label>
                  <Input 
                    id="targa" 
                    placeholder="GG 000 ZZ" 
                    className="uppercase font-mono"
                    value={formData.targa} 
                    onChange={(e) => setFormData({...formData, targa: e.target.value.toUpperCase()})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="proprietario">Intestatario</Label>
                  <Input 
                    id="proprietario" 
                    placeholder="Nome Cognome / Azienda" 
                    value={formData.proprietario} 
                    onChange={(e) => setFormData({...formData, proprietario: e.target.value})} 
                  />
                </div>
              </div>

              {/* SEZIONE UPLOAD DOCUMENTI */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="grid gap-2">
                    <Label className="flex items-center gap-2 text-blue-600"><FileText className="w-4 h-4"/> Libretto</Label>
                    <Input type="file" className="text-xs" accept=".pdf,.jpg,.png" onChange={(e) => handleFileChange(e, 'libretto')} />
                </div>
                <div className="grid gap-2">
                    <Label className="flex items-center gap-2 text-green-600"><Shield className="w-4 h-4"/> Polizza Ass.</Label>
                    <Input type="file" className="text-xs" accept=".pdf,.jpg,.png" onChange={(e) => handleFileChange(e, 'insurance')} />
                </div>
              </div>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
              <Button onClick={() => createVehicle.mutate()} disabled={!formData.veicolo || !formData.targa || isUploading}>
                {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Caricamento...</> : 'Salva Veicolo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
            <p className="text-gray-500">Caricamento veicoli...</p>
        ) : vehicles.map((vehicle) => (
          <Card key={vehicle.id} className="hover:shadow-lg transition-shadow border-t-4 border-t-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Car className="w-5 h-5" />
                </div>
                {vehicle.veicolo}
              </CardTitle>
              <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => { if(confirm("Eliminare veicolo?")) deleteVehicle.mutate(vehicle.id) }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm border-b pb-2">
                  <span className="text-gray-500">Targa:</span>
                  <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-300">{vehicle.targa}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2">
                  <span className="text-gray-500">Proprietario:</span>
                  <span className="font-medium text-gray-900">{vehicle.proprietario || '-'}</span>
                </div>

                {/* PULSANTI DOCUMENTI */}
                <div className="flex gap-2 pt-2">
                    {vehicle.libretto_url ? (
                        <a href={vehicle.libretto_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50">
                                <FileText className="w-3 h-3 mr-2" /> Libretto
                            </Button>
                        </a>
                    ) : (
                        <Button variant="ghost" size="sm" disabled className="flex-1 text-gray-300 border border-dashed">
                             No Libretto
                        </Button>
                    )}

                    {vehicle.insurance_url ? (
                        <a href={vehicle.insurance_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full text-green-600 border-green-200 hover:bg-green-50">
                                <Shield className="w-3 h-3 mr-2" /> Polizza
                            </Button>
                        </a>
                    ) : (
                        <Button variant="ghost" size="sm" disabled className="flex-1 text-gray-300 border border-dashed">
                             No Polizza
                        </Button>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {vehicles.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nessun veicolo registrato. Aggiungine uno con i documenti.</p>
            </div>
        )}
      </div>
    </div>
  );
}