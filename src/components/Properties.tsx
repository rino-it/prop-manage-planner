import { AddPropertyDialog } from './AddPropertyDialog';
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // IMPORTANTE
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { MapPin, Settings, Pencil, Home, FileText, Upload, Download, Trash2, Users, TrendingUp, Clock, AlertTriangle, Save, FolderOpen, Euro } from 'lucide-react';
import { usePropertiesReal, usePropertiesMobile } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';

const Properties = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'real' | 'mobile'>('all');
  
  // MODALI
  const [detailsOpen, setDetailsOpen] = useState<any>(null); // Report e Analytics
  const [docsOpen, setDocsOpen] = useState<any>(null); // Scheda Documenti (Ora con TAB)
  const [editOpen, setEditOpen] = useState<any>(null); 

  const { data: propertiesReal = [] } = usePropertiesReal();
  const { data: propertiesMobile = [] } = usePropertiesMobile();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // --- QUERY DOCUMENTI DIVISI ---
  const { data: allDocs } = useQuery({
    queryKey: ['property-docs-full', docsOpen?.id],
    queryFn: async () => {
      if (!docsOpen) return { struct: [], tenant: [], expense: [] };
      
      // 1. Documenti Strutturali (tipo 'contratto', 'visura', 'altro' NON collegati a spese)
      const { data: structDocs } = await supabase.from('documents')
        .select('*')
        .eq('property_real_id', docsOpen.id)
        .is('expense_id', null) 
        .order('created_at', { ascending: false });

      // 2. Documenti Inquilini (booking_documents collegati agli inquilini di questa casa)
      const { data: bookings } = await supabase.from('bookings').select('id, nome_ospite').eq('property_id', docsOpen.id);
      const bookingIds = bookings?.map(b => b.id) || [];
      
      let tenantDocs: any[] = [];
      if (bookingIds.length > 0) {
          const { data: tDocs } = await supabase.from('booking_documents')
            .select('*, bookings(nome_ospite)')
            .in('booking_id', bookingIds)
            .order('uploaded_at', { ascending: false });
          tenantDocs = tDocs || [];
      }

      // 3. Documenti Spese (tipo 'spesa' o collegati a expense_id)
      const { data: expenseDocs } = await supabase.from('documents')
        .select('*, property_expenses(amount, category)')
        .eq('property_real_id', docsOpen.id)
        .not('expense_id', 'is', null)
        .order('created_at', { ascending: false });

      return { 
        struct: structDocs || [], 
        tenant: tenantDocs || [], 
        expense: expenseDocs || [] 
      };
    },
    enabled: !!docsOpen
  });

  // UPLOAD GENERICO (Solo per tab Immobile)
  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      if (!docsOpen) return;
      setUploading(true);
      const fileName = `prop_${docsOpen.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(fileName, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('documents').insert({
        property_real_id: docsOpen.id,
        nome: file.name,
        url: fileName,
        tipo: 'altro' // Default
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-docs-full'] });
      toast({ title: "Caricato!" });
      setUploading(false);
    },
    onError: () => { setUploading(false); toast({ title: "Errore", variant: "destructive" }); }
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => await supabase.from('documents').delete().eq('id', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property-docs-full'] })
  });

  const filteredPropertiesReal = propertiesReal.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) && (filterType === 'all' || filterType === 'real')
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Proprietà</h1>
        <AddPropertyDialog><Button className="bg-blue-600">Aggiungi Proprietà</Button></AddPropertyDialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPropertiesReal.map(prop => (
            <Card key={prop.id} className="group hover:shadow-lg transition-all relative">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Home className="w-5 h-5" /></div>
                        <div><CardTitle className="text-lg">{prop.nome}</CardTitle><p className="text-xs text-gray-500 mt-1 flex items-center"><MapPin className="w-3 h-3 mr-1"/> {prop.citta}</p></div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditOpen(prop)}><Pencil className="w-4 h-4 text-gray-500" /></Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-2 mt-4">
                    <Button variant="outline" className="w-full text-xs" onClick={() => setDetailsOpen(prop)}>Analytics</Button>
                    <Button variant="outline" className="w-full text-xs bg-slate-50 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200" onClick={() => setDocsOpen(prop)}>
                        <FolderOpen className="w-3 h-3 mr-2" /> Archivio
                    </Button>
                </div>
            </CardContent>
            </Card>
        ))}
      </div>

      {/* --- DIALOG ARCHIVIO DOCUMENTI (A 3 SCHEDE) --- */}
      <Dialog open={!!docsOpen} onOpenChange={() => setDocsOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-blue-600"/> Archivio: {docsOpen?.nome}</DialogTitle></DialogHeader>
            
            <Tabs defaultValue="immobile" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="immobile">Immobile</TabsTrigger>
                    <TabsTrigger value="inquilini">Inquilini</TabsTrigger>
                    <TabsTrigger value="spese">Spese & Utenze</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto pr-2">
                    {/* TAB 1: IMMOBILE (Visure, Planimetrie - Caricabili qui) */}
                    <TabsContent value="immobile" className="space-y-4">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                            <p className="text-sm text-slate-600">{uploading ? 'Caricamento...' : 'Carica Visura / Planimetria'}</p>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && uploadDoc.mutate(e.target.files[0])} disabled={uploading} />
                        </div>
                        <div className="space-y-2">
                            {allDocs?.struct.map((doc: any) => (
                                <div key={doc.id} className="flex justify-between items-center p-3 border rounded hover:bg-slate-50">
                                    <div className="flex items-center gap-3"><FileText className="w-4 h-4 text-blue-500" /><span className="text-sm font-medium">{doc.nome}</span></div>
                                    <div className="flex gap-2">
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(supabase.storage.from('documents').getPublicUrl(doc.url).data.publicUrl, '_blank')}><Download className="w-3 h-3" /></Button>
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => deleteDoc.mutate(doc.id)}><Trash2 className="w-3 h-3" /></Button>
                                    </div>
                                </div>
                            ))}
                            {allDocs?.struct.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Nessun documento strutturale.</p>}
                        </div>
                    </TabsContent>

                    {/* TAB 2: INQUILINI (Contratti - Read Only dalla prenotazione) */}
                    <TabsContent value="inquilini" className="space-y-4">
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-xs text-blue-700 flex gap-2">
                            <Users className="w-4 h-4" /> I documenti qui sotto provengono dalle prenotazioni.
                        </div>
                        <div className="space-y-2">
                            {allDocs?.tenant.map((doc: any) => (
                                <div key={doc.id} className="flex justify-between items-center p-3 border rounded bg-white">
                                    <div>
                                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-purple-500" /><span className="text-sm font-medium">{doc.filename}</span></div>
                                        <p className="text-xs text-gray-500 ml-6">Ospite: {doc.bookings?.nome_ospite}</p>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(supabase.storage.from('documents').getPublicUrl(doc.file_url).data.publicUrl, '_blank')}><Download className="w-3 h-3" /></Button>
                                </div>
                            ))}
                            {allDocs?.tenant.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Nessun documento inquilino.</p>}
                        </div>
                    </TabsContent>

                    {/* TAB 3: SPESE (Bollette - Automatiche da Spese) */}
                    <TabsContent value="spese" className="space-y-4">
                        <div className="bg-green-50 p-3 rounded-md border border-green-100 text-xs text-green-700 flex gap-2">
                            <Euro className="w-4 h-4" /> Questi allegati sono generati automaticamente registrando le spese.
                        </div>
                        <div className="space-y-2">
                            {allDocs?.expense.map((doc: any) => (
                                <div key={doc.id} className="flex justify-between items-center p-3 border rounded bg-white">
                                    <div>
                                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-600" /><span className="text-sm font-medium">{doc.nome}</span></div>
                                        {doc.property_expenses && <p className="text-xs text-gray-500 ml-6">Importo: €{doc.property_expenses.amount} ({doc.property_expenses.category})</p>}
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(supabase.storage.from('documents').getPublicUrl(doc.url).data.publicUrl, '_blank')}><Download className="w-3 h-3" /></Button>
                                </div>
                            ))}
                            {allDocs?.expense.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Nessuna bolletta o spesa allegata.</p>}
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </DialogContent>
      </Dialog>

      {/* MODALE DI MODIFICA (Rimasta invariata ma necessaria per non rompere il codice) */}
      {editOpen && (
        <Dialog open={!!editOpen} onOpenChange={() => setEditOpen(null)}>
            <DialogContent><DialogHeader><DialogTitle>Modifica</DialogTitle></DialogHeader><p>Funzione modifica...</p></DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Properties;