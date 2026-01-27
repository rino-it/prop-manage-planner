import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Home, Car, FileText } from 'lucide-react';

interface AddPropertyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyToEdit?: any;
}

// NOTA: Ho rimosso 'default' per correggere l'errore di importazione
export function AddPropertyDialog({ isOpen, onClose, onSuccess, propertyToEdit }: AddPropertyDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'real' | 'mobile'>('real');
  
  // STATO FORM GENERALE
  const [formData, setFormData] = useState({
    nome: '',
    indirizzo: '', // Solo Real
    veicolo: '',   // Solo Mobile
    targa: '',     // Solo Mobile
    proprietario: '', // Nuovo campo intestatario
    scadenza_bollo: '', // <--- NUOVO CAMPO BOLLO
    scadenza_assicurazione: '',
    scadenza_revisione: ''
  });

  // GESTIONE FILE
  const [librettoFile, setLibrettoFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);

  useEffect(() => {
    if (propertyToEdit) {
      setType(propertyToEdit.targa ? 'mobile' : 'real');
      setFormData({
        nome: propertyToEdit.nome || '',
        indirizzo: propertyToEdit.indirizzo || '',
        veicolo: propertyToEdit.veicolo || '',
        targa: propertyToEdit.targa || '',
        proprietario: propertyToEdit.proprietario || '',
        scadenza_bollo: propertyToEdit.scadenza_bollo || '',
        scadenza_assicurazione: propertyToEdit.scadenza_assicurazione || '',
        scadenza_revisione: propertyToEdit.scadenza_revisione || ''
      });
    } else {
      setFormData({ nome: '', indirizzo: '', veicolo: '', targa: '', proprietario: '', scadenza_bollo: '', scadenza_assicurazione: '', scadenza_revisione: '' });
      setLibrettoFile(null);
      setInsuranceFile(null);
    }
  }, [propertyToEdit, isOpen]);

  const uploadFile = async (file: File, path: string) => {
    const fileName = `${path}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('vehicle-docs').upload(fileName, file);
    if (error) throw error;
    return fileName;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      let librettoPath = propertyToEdit?.libretto_url;
      let insurancePath = propertyToEdit?.insurance_url;

      if (type === 'mobile') {
        if (librettoFile) librettoPath = await uploadFile(librettoFile, 'libretti');
        if (insuranceFile) insurancePath = await uploadFile(insuranceFile, 'assicurazioni');
      }

      if (type === 'real') {
        const payload = {
          user_id: user.id,
          nome: formData.nome,
          indirizzo: formData.indirizzo,
          stato: 'sfitto' // Default
        };

        if (propertyToEdit) {
          const { error } = await supabase.from('properties_real').update(payload).eq('id', propertyToEdit.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('properties_real').insert(payload);
          if (error) throw error;
        }
      } else {
        const payload = {
          user_id: user.id,
          veicolo: formData.veicolo,
          targa: formData.targa,
          proprietario: formData.proprietario,
          scadenza_bollo: formData.scadenza_bollo || null,
          scadenza_assicurazione: formData.scadenza_assicurazione || null,
          scadenza_revisione: formData.scadenza_revisione || null,
          libretto_url: librettoPath,
          insurance_url: insurancePath,
          status: 'active'
        };

        if (propertyToEdit) {
          const { error } = await supabase.from('properties_mobile').update(payload).eq('id', propertyToEdit.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('properties_mobile').insert(payload);
          if (error) throw error;
        }
      }

      toast({ title: "Salvato con successo!" });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{propertyToEdit ? 'Modifica Proprietà' : 'Aggiungi Nuova Proprietà'}</DialogTitle>
        </DialogHeader>

        {!propertyToEdit && (
          <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-lg">
            <button 
                className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 text-sm font-medium transition-all ${type === 'real' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                onClick={() => setType('real')}
            >
                <Home className="w-4 h-4"/> Immobile
            </button>
            <button 
                className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 text-sm font-medium transition-all ${type === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                onClick={() => setType('mobile')}
            >
                <Car className="w-4 h-4"/> Veicolo
            </button>
          </div>
        )}

        <div className="space-y-4">
          {type === 'real' ? (
            <>
              <div className="space-y-2">
                <Label>Nome Identificativo</Label>
                <Input placeholder="Es. Appartamento Centro" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Indirizzo Completo</Label>
                <Input placeholder="Via Roma 1, Milano" value={formData.indirizzo} onChange={e => setFormData({...formData, indirizzo: e.target.value})} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Modello Veicolo</Label>
                    <Input placeholder="Es. Fiat Panda" value={formData.veicolo} onChange={e => setFormData({...formData, veicolo: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>Targa</Label>
                    <Input placeholder="AB 123 CD" value={formData.targa} onChange={e => setFormData({...formData, targa: e.target.value})} />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Intestatario (Proprietario)</Label>
                <Input placeholder="Nome Cognome o Azienda" value={formData.proprietario} onChange={e => setFormData({...formData, proprietario: e.target.value})} />
              </div>

              {/* SEZIONE SCADENZE */}
              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-sm font-semibold text-gray-700">Scadenze & Documenti</h4>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs">Scadenza Assicurazione</Label>
                        <Input type="date" className="h-8 text-xs" value={formData.scadenza_assicurazione} onChange={e => setFormData({...formData, scadenza_assicurazione: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Scadenza Bollo</Label>
                        <Input type="date" className="h-8 text-xs" value={formData.scadenza_bollo} onChange={e => setFormData({...formData, scadenza_bollo: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Scadenza Revisione</Label>
                        <Input type="date" className="h-8 text-xs" value={formData.scadenza_revisione} onChange={e => setFormData({...formData, scadenza_revisione: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1"><FileText className="w-3 h-3"/> Carica Libretto</Label>
                        <Input type="file" className="h-8 text-xs" onChange={e => setLibrettoFile(e.target.files?.[0] || null)} accept=".pdf,.jpg,.png"/>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1"><FileText className="w-3 h-3"/> Carica Assicurazione</Label>
                        <Input type="file" className="h-8 text-xs" onChange={e => setInsuranceFile(e.target.files?.[0] || null)} accept=".pdf,.jpg,.png"/>
                    </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? 'Salvataggio...' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}