import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePropertyReal, useCreatePropertyMobile } from "@/hooks/useProperties";
import { useToast } from "@/hooks/use-toast";
import { Building2, Car, Key, CalendarClock } from "lucide-react";

export function AddPropertyDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createReal = useCreatePropertyReal();
  const createMobile = useCreatePropertyMobile();

  // Stati per Immobile
  const [realForm, setRealForm] = useState({
    nome: "", 
    via: "", 
    citta: "", 
    cap: "", 
    provincia: "", 
    tipo: "appartamento" as const,
    tipo_affitto: "breve" as const // <--- NUOVO CAMPO
  });

  // Stati per Mobile
  const [mobileForm, setMobileForm] = useState({
    nome: "", categoria: "veicolo" as const, marca: "", modello: "", targa: ""
  });

  const handleSubmitReal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({ title: "Errore", description: "Devi essere loggato per salvare.", variant: "destructive" });
        return;
      }

      await createReal.mutateAsync({
        ...realForm,
        user_id: user.id
      });
      
      setOpen(false);
      // Reset form
      setRealForm({ nome: "", via: "", citta: "", cap: "", provincia: "", tipo: "appartamento", tipo_affitto: "breve" });
      toast({ title: "Successo", description: "Immobile salvato correttamente!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile salvare.", variant: "destructive" });
    }
  };

  const handleSubmitMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({ title: "Errore", description: "Devi essere loggato.", variant: "destructive" });
        return;
      }

      await createMobile.mutateAsync({
        ...mobileForm,
        user_id: user.id
      });
      
      setOpen(false);
      setMobileForm({ nome: "", categoria: "veicolo", marca: "", modello: "", targa: "" });
      toast({ title: "Successo", description: "Bene mobile salvato correttamente!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile salvare.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuova Proprietà</DialogTitle>
          <DialogDescription>Inserisci i dettagli del bene da gestire.</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="real" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="real" className="flex gap-2"><Building2 className="w-4 h-4"/> Immobile</TabsTrigger>
            <TabsTrigger value="mobile" className="flex gap-2"><Car className="w-4 h-4"/> Bene Mobile</TabsTrigger>
          </TabsList>

          {/* FORM IMMOBILE */}
          <TabsContent value="real">
            <form onSubmit={handleSubmitReal} className="space-y-4 py-4">
              
              {/* SELEZIONE TIPO GESTIONE (Nuova Logica) */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <Label className="text-blue-800 font-semibold mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Strategia di Affitto
                </Label>
                <Select 
                  onValueChange={(v: any) => setRealForm({...realForm, tipo_affitto: v})} 
                  defaultValue="breve"
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breve">🏖️ Affitto Breve (Turistico / Airbnb)</SelectItem>
                    <SelectItem value="lungo">🏠 Lungo Termine (4+4 / Transitorio)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Nome Identificativo</Label>
                <Input required placeholder="Es. Casa Mare" value={realForm.nome} onChange={e => setRealForm({...realForm, nome: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo Immobile</Label>
                  <Select onValueChange={(v: any) => setRealForm({...realForm, tipo: v})} defaultValue="appartamento">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appartamento">Appartamento</SelectItem>
                      <SelectItem value="casa">Casa Indipendente</SelectItem>
                      <SelectItem value="ufficio">Ufficio</SelectItem>
                      <SelectItem value="magazzino">Magazzino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Città</Label>
                  <Input required value={realForm.citta} onChange={e => setRealForm({...realForm, citta: e.target.value})} />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>Indirizzo Completo</Label>
                <Input required value={realForm.via} onChange={e => setRealForm({...realForm, via: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>CAP</Label>
                  <Input required value={realForm.cap} onChange={e => setRealForm({...realForm, cap: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Provincia</Label>
                  <Input required value={realForm.provincia} onChange={e => setRealForm({...realForm, provincia: e.target.value})} />
                </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Salva Immobile</Button>
            </form>
          </TabsContent>

          {/* FORM MOBILE (Invariato ma incluso per completezza) */}
          <TabsContent value="mobile">
            <form onSubmit={handleSubmitMobile} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input required placeholder="Es. Auto Aziendale" value={mobileForm.nome} onChange={e => setMobileForm({...mobileForm, nome: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select onValueChange={(v: any) => setMobileForm({...mobileForm, categoria: v})} defaultValue="veicolo">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veicolo">Veicolo</SelectItem>
                    <SelectItem value="imbarcazione">Imbarcazione</SelectItem>
                    <SelectItem value="attrezzatura">Attrezzatura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Marca</Label>
                  <Input value={mobileForm.marca} onChange={e => setMobileForm({...mobileForm, marca: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Modello</Label>
                  <Input value={mobileForm.modello} onChange={e => setMobileForm({...mobileForm, modello: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Targa / Seriale</Label>
                <Input value={mobileForm.targa} onChange={e => setMobileForm({...mobileForm, targa: e.target.value})} />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Salva Bene Mobile</Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}