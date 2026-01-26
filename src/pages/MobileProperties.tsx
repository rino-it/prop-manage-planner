import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Car, Plus, Trash2, FileText, Shield, Loader2, Calendar, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

// Tipo completo
type MobileProperty = {
  id: string;
  veicolo: string;
  targa: string;
  status: string;
  proprietario: string | null;
  scadenza_bollo?: string | null;
  scadenza_assicurazione?: string | null;
  scadenza_revisione?: string | null;
  libretto_url?: string | null;
  insurance_url?: string | null;
};

export default function MobileProperties() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // STATO FORM COMPLETO
  const [formData, setFormData] = useState({
    veicolo: '',
    targa: '',
    proprietario: '',
    scadenza_bollo: '',
    scadenza_assicurazione: '',
    scadenza_revisione: '',
    libretto: null as File | null,
    insurance: null as File | null
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    const { error } = await supabase.storage.from('vehicle-docs').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('vehicle-docs').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const createVehicle = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user");

        let librettoUrl = null;
        let insuranceUrl = null;

        if (formData.libretto) librettoUrl = await uploadFile(formData.libretto, `libretto_${formData.targa}`);
        if (formData.insurance) insuranceUrl = await uploadFile(formData.insurance, `insurance_${formData.targa}`);

        const { error } = await supabase.from('properties_mobile').insert({
          veicolo: formData.veicolo,
          targa: formData.targa,
          proprietario: formData.proprietario,
          user_id: user.id,
          status: 'active',
          // SALVA LE DATE
          scadenza_bollo: formData.scadenza_bollo || null,
          scadenza_assicurazione: formData.scadenza_assicurazione || null,
          scadenza_revisione: formData.scadenza_revisione || null,
          // SALVA I FILE
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
      resetForm();
      toast({ title: "Veicolo Aggiunto", description: "Dati, scadenze e documenti salvati." });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

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

  const resetForm = () => {
    setFormData({
      veicolo: '', targa: '', proprietario: '',
      scadenza_bollo: '', scadenza_assicurazione: '', scadenza_revisione: '',
      libretto: null, insurance: null
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, f: 'libretto' | 'insurance') => {
    if (e.target.files?.[0]) setFormData(p => ({ ...p, [f]: e.target.files![0] }));
  };

  // Helper UI per le scadenze nella card
  const DeadlineBadge = ({ label, date }: { label: string, date?: string | null }) => {
    if (!date) return <div className="text-xs text-gray-400 flex justify-between"><span>{label}:</span> <span>-</span></div>;
    const expired = isPast(parseISO(date));
    return (
      <div className={`text-xs flex justify-between items-center p-1 rounded ${expired ? 'bg-red-50 text-red-700 font-bold' : 'text-gray-600'}`}>
        <span>{label}:</span>
        <span className="flex items-center gap-1">
            {format(parseISO(date), 'dd/MM/yy')}
            {expired && <AlertTriangle className="w-3 h-3"/>}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Flotta</h1>
          <p className="text-gray-500">Documenti, scadenze e manutenzione veicoli.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" /> Aggiungi Veicolo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo Veicolo</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              
              {/* DATI BASE */}
              <div className="grid gap-2">
                <Label>Modello</Label>
                <Input placeholder="Es. Fiat Panda" value={formData.veicolo} onChange={e => setFormData({...formData, veicolo: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Targa</Label>
                  <Input placeholder="AA 000 BB" className="uppercase" value={formData.targa} onChange={e => setFormData({...formData, targa: e.target.value.toUpperCase()})} />
                </div>
                <div className="grid gap-2">
                  <Label>Intestatario</Label>
                  <Input placeholder="Nome o Azienda" value={formData.proprietario} onChange={e => setFormData({...formData, proprietario: e.target.value})} />
                </div>
              </div>

              {/* SEZIONE SCADENZE */}
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 space-y-3">
                <h4 className="text-xs font-bold text-orange-800 uppercase flex items-center gap-2">
                    <Calendar className="w-3 h-3"/> Scadenze Obbligatorie
                </h4>
                <div className="grid grid-cols-3 gap-2">
                    <div className="grid gap-1">
                        <Label className="text-xs">Assicurazione</Label>
                        <Input type="date" className="h-8 text-xs bg-white" value={formData.scadenza_assicurazione} onChange={e => setFormData({...formData, scadenza_assicurazione: e.target.value})} />
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-xs">Bollo</Label>
                        <Input type="date" className="h-8 text-xs bg-white" value={formData.scadenza_bollo} onChange={e => setFormData({...formData, scadenza_bollo: e.target.value})} />
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-xs">Revisione</Label>
                        <Input type="date" className="h-8 text-xs bg-white" value={formData.scadenza_revisione} onChange={e => setFormData({...formData, scadenza_revisione: e.target.value})} />
                    </div>
                </div>
              </div>

              {/* SEZIONE DOCUMENTI */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                 <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                    <FileText className="w-3 h-3"/> Upload Documenti
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label className="text-xs text-blue-600 font-medium">Libretto (PDF/Foto)</Label>
                        <Input type="file" className="text-xs bg-white h-9" accept=".pdf,.jpg,.png" onChange={(e) => handleFile(e, 'libretto')} />
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs text-green-600 font-medium">Polizza (PDF/Foto)</Label>
                        <Input type="file" className="text-xs bg-white h-9" accept=".pdf,.jpg,.png" onChange={(e) => handleFile(e, 'insurance')} />
                    </div>
                </div>
              </div>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
              <Button onClick={() => createVehicle.mutate()} disabled={!formData.veicolo || !formData.targa || isUploading}>
                {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Salvataggio...</> : 'Salva Veicolo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? <p>Caricamento...</p> : vehicles.map((v) => (
          <Card key={v.id} className="hover:shadow-md transition-shadow border-t-4 border-t-blue-500 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded text-blue-600"><Car className="w-5 h-5" /></div>
                {v.veicolo}
              </CardTitle>
              <Button variant="ghost" size="icon" className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { if(confirm("Eliminare?")) deleteVehicle.mutate(v.id) }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Info Base */}
              <div className="grid grid-cols-2 gap-2 text-sm border-b pb-3">
                 <div><span className="text-gray-400 text-xs block">Targa</span><span className="font-mono font-bold">{v.targa}</span></div>
                 <div className="text-right"><span className="text-gray-400 text-xs block">Intestatario</span><span className="font-medium">{v.proprietario || '-'}</span></div>
              </div>

              {/* Scadenze */}
              <div className="space-y-1 bg-slate-50 p-2 rounded">
                 <DeadlineBadge label="Assicurazione" date={v.scadenza_assicurazione} />
                 <DeadlineBadge label="Bollo" date={v.scadenza_bollo} />
                 <DeadlineBadge label="Revisione" date={v.scadenza_revisione} />
              </div>

              {/* Pulsanti Documenti */}
              <div className="flex gap-2 pt-1">
                <Button variant={v.libretto_url ? "outline" : "ghost"} size="sm" className={`flex-1 ${v.libretto_url ? 'text-blue-600 border-blue-200' : 'text-gray-300'}`} disabled={!v.libretto_url} onClick={() => window.open(v.libretto_url || '', '_blank')}>
                    <FileText className="w-3 h-3 mr-2" /> Libretto
                </Button>
                <Button variant={v.insurance_url ? "outline" : "ghost"} size="sm" className={`flex-1 ${v.insurance_url ? 'text-green-600 border-green-200' : 'text-gray-300'}`} disabled={!v.insurance_url} onClick={() => window.open(v.insurance_url || '', '_blank')}>
                    <Shield className="w-3 h-3 mr-2" /> Polizza
                </Button>
              </div>

            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}