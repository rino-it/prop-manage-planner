import { AddPropertyDialog } from './AddPropertyDialog';
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { MapPin, Settings, Pencil, Car, Home, FileText, Upload, Download, Trash2, Users, TrendingUp, Clock, AlertTriangle, Save } from 'lucide-react';
import { usePropertiesReal, usePropertiesMobile } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';

const Properties = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'real' | 'mobile'>('all');
  
  // STATI PER MODALI
  const [detailsOpen, setDetailsOpen] = useState<any>(null); // Per il Report
  const [docsOpen, setDocsOpen] = useState<any>(null); // Per i Documenti
  const [editOpen, setEditOpen] = useState<any>(null); // Per la Modifica

  const { data: propertiesReal = [], isLoading: isLoadingReal } = usePropertiesReal();
  const { data: propertiesMobile = [], isLoading: isLoadingMobile } = usePropertiesMobile();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // --- 1. LOGICA DETTAGLI (ANALYTICS) ---
  const { data: propertyStats } = useQuery({
    queryKey: ['property-stats', detailsOpen?.id],
    queryFn: async () => {
      if (!detailsOpen) return null;
      
      // Chi c'è dentro?
      const { data: activeBooking } = await supabase
        .from('bookings')
        .select('*')
        .eq('property_id', detailsOpen.id)
        .gte('data_fine', new Date().toISOString())
        .order('data_inizio', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Soldi?
      const { data: payments } = await supabase
        .from('tenant_payments')
        .select('importo, stato')
        .eq('booking_id', activeBooking?.id); // Solo del contratto attuale

      const paid = payments?.filter(p => p.stato === 'pagato').reduce((acc, c) => acc + Number(c.importo), 0) || 0;
      const pending = payments?.filter(p => p.stato === 'da_pagare').reduce((acc, c) => acc + Number(c.importo), 0) || 0;

      return { activeBooking, paid, pending };
    },
    enabled: !!detailsOpen
  });

  // --- 2. LOGICA DOCUMENTI IMMOBILE ---
  const { data: propertyDocs } = useQuery({
    queryKey: ['property-docs', docsOpen?.id],
    queryFn: async () => {
      if (!docsOpen) return [];
      const { data } = await supabase.from('documents')
        .select('*')
        .eq('property_real_id', docsOpen.id) // O mobile, da gestire
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!docsOpen
  });

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      if (!docsOpen) return;
      setUploading(true);
      const fileName = `prop_${docsOpen.id}/${Date.now()}_${file.name}`;
      
      const { error: upErr } = await supabase.storage.from('documents').upload(fileName, file);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from('documents').insert({
        property_real_id: docsOpen.id, // Assumo immobili per ora
        nome: file.name,
        url: fileName,
        tipo: 'altro',
        user_id: (await supabase.auth.getUser()).data.user?.id
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-docs'] });
      toast({ title: "Caricato!" });
      setUploading(false);
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
      setUploading(false);
    }
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('documents').delete().eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property-docs'] })
  });

  // --- 3. LOGICA MODIFICA ---
  const updateProperty = useMutation({
    mutationFn: async (formData: any) => {
        const { error } = await supabase
            .from('properties_real')
            .update({
                nome: formData.nome,
                via: formData.via,
                citta: formData.citta,
                tipo: formData.tipo
            })
            .eq('id', editOpen.id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['properties-real'] });
        setEditOpen(null);
        toast({ title: "Aggiornato!" });
    }
  });


  // --- RENDER ---
  const filteredPropertiesReal = propertiesReal.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) && (filterType === 'all' || filterType === 'real')
  );

  const renderRealProp = (prop: any) => (
    <Card key={prop.id} className="group hover:shadow-lg transition-all relative">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Home className="w-5 h-5" /></div>
                <div>
                    <CardTitle className="text-lg">{prop.nome}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1 flex items-center"><MapPin className="w-3 h-3 mr-1"/> {prop.citta}</p>
                </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditOpen(prop)}><Pencil className="w-4 h-4 text-gray-500" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8"><Settings className="w-4 h-4 text-gray-500" /></Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
            <Badge variant="secondary" className="text-xs">{prop.tipo}</Badge>
            <Badge variant="outline" className="text-xs">{prop.stato || 'Disponibile'}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="w-full text-xs" onClick={() => setDetailsOpen(prop)}>Dettagli</Button>
            <Button variant="outline" className="w-full text-xs" onClick={() => setDocsOpen(prop)}>Documenti</Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Proprietà</h1>
        <AddPropertyDialog><Button className="bg-blue-600">Aggiungi Proprietà</Button></AddPropertyDialog>
      </div>

      {/* FILTRI */}
      <div className="flex gap-4">
        <Input placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-md bg-white" />
        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-48 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Tutto</SelectItem><SelectItem value="real">Immobili</SelectItem><SelectItem value="mobile">Mobili</SelectItem></SelectContent>
        </Select>
      </div>

      {/* LISTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPropertiesReal.map(renderRealProp)}
      </div>

      {/* --- 1. SHEET DETTAGLI (REPORT) --- */}
      <Sheet open={!!detailsOpen} onOpenChange={() => setDetailsOpen(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2"><Home className="w-5 h-5 text-blue-600"/> {detailsOpen?.nome}</SheetTitle>
                <SheetDescription>{detailsOpen?.via}, {detailsOpen?.citta}</SheetDescription>
            </SheetHeader>
            
            <div className="space-y-6">
                {/* BOX INQUILINO */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="font-semibold text-sm text-slate-500 mb-3 uppercase flex items-center gap-2"><Users className="w-4 h-4"/> Attualmente dentro</h4>
                    {propertyStats?.activeBooking ? (
                        <div>
                            <p className="text-lg font-bold text-slate-900">{propertyStats.activeBooking.nome_ospite}</p>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs bg-white px-2 py-1 rounded border text-slate-600">
                                    Scade il: {format(new Date(propertyStats.activeBooking.data_fine), 'dd MMM yyyy')}
                                </span>
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">
                                    -{differenceInDays(new Date(propertyStats.activeBooking.data_fine), new Date())} gg
                                </Badge>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-slate-400"><Home className="w-8 h-8 mx-auto mb-2 opacity-50"/><p>Nessun inquilino attivo</p></div>
                    )}
                </div>

                {/* BOX ECONOMICO */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                        <p className="text-xs text-green-600 font-medium uppercase mb-1">Incassato</p>
                        <p className="text-2xl font-bold text-green-800">€{propertyStats?.paid || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                        <p className="text-xs text-orange-600 font-medium uppercase mb-1">Da Saldare</p>
                        <p className="text-2xl font-bold text-orange-800">€{propertyStats?.pending || 0}</p>
                    </div>
                </div>

                {/* BOX AZIONI RAPIDE */}
                <div className="pt-4 border-t">
                    <h4 className="font-semibold text-sm mb-3">Azioni Rapide</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm"><Clock className="w-4 h-4 mr-2"/> Storico</Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"><AlertTriangle className="w-4 h-4 mr-2"/> Segnala Guasto</Button>
                    </div>
                </div>
            </div>
        </SheetContent>
      </Sheet>

      {/* --- 2. DIALOG DOCUMENTI --- */}
      <Dialog open={!!docsOpen} onOpenChange={() => setDocsOpen(null)}>
        <DialogContent>
            <DialogHeader><DialogTitle>Archivio {docsOpen?.nome}</DialogTitle></DialogHeader>
            <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center bg-slate-50 hover:bg-slate-100 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600">{uploading ? 'Caricamento...' : 'Clicca per caricare un documento'}</p>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && uploadDoc.mutate(e.target.files[0])} disabled={uploading} />
                </div>
                <ScrollArea className="h-[200px]">
                    {propertyDocs?.map((doc) => (
                        <div key={doc.id} className="flex justify-between items-center p-2 border-b hover:bg-slate-50">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <span className="text-sm truncate">{doc.nome}</span>
                            </div>
                            <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(supabase.storage.from('documents').getPublicUrl(doc.url!).data.publicUrl, '_blank')}><Download className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => deleteDoc.mutate(doc.id)}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                        </div>
                    ))}
                </ScrollArea>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- 3. DIALOG MODIFICA --- */}
      {editOpen && (
        <Dialog open={!!editOpen} onOpenChange={() => setEditOpen(null)}>
            <DialogContent>
                <DialogHeader><DialogTitle>Modifica Proprietà</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid gap-2"><Input placeholder="Nome" value={editOpen.nome} onChange={e => setEditOpen({...editOpen, nome: e.target.value})} /></div>
                    <div className="grid gap-2"><Input placeholder="Indirizzo" value={editOpen.via} onChange={e => setEditOpen({...editOpen, via: e.target.value})} /></div>
                    <div className="grid gap-2"><Input placeholder="Città" value={editOpen.citta} onChange={e => setEditOpen({...editOpen, citta: e.target.value})} /></div>
                    <Button className="w-full bg-blue-600" onClick={() => updateProperty.mutate(editOpen)}><Save className="w-4 h-4 mr-2"/> Salva Modifiche</Button>
                </div>
            </DialogContent>
        </Dialog>
      )}

    </div>
  );
};

export default Properties;