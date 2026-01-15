import { AddPropertyDialog } from './AddPropertyDialog';
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { MapPin, Pencil, Home, FileText, Upload, Download, Trash2, Users, TrendingUp, Clock, AlertCircle, FolderOpen, Euro, Calendar as CalendarIcon, MessageSquare, CreditCard, Eye, Check, X, UserCog, User, Wrench, AlertTriangle } from 'lucide-react';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import TicketManager from '@/components/TicketManager';

const Properties = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'real' | 'mobile'>('all');
  
  const [detailsOpen, setDetailsOpen] = useState<any>(null);
  const [docsOpen, setDocsOpen] = useState<any>(null);
  const [editOpen, setEditOpen] = useState<any>(null);
  
  const [deleteOpen, setDeleteOpen] = useState<any>(null); 
  const [deleteConfirmText, setDeleteConfirmText] = useState(''); 

  const [editFormData, setEditFormData] = useState({ nome: '', indirizzo: '', citta: '' });
  
  const [selectedTenant, setSelectedTenant] = useState<any>(null); 
  const [managingTicket, setManagingTicket] = useState<any>(null); 

  const [smartFile, setSmartFile] = useState<File | null>(null);
  const [isExpense, setIsExpense] = useState(false);
  const [smartData, setSmartData] = useState({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), description: '' });

  const { data: propertiesReal = [] } = usePropertiesReal();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editOpen) {
      setEditFormData({
        nome: editOpen.nome || '',
        indirizzo: editOpen.indirizzo || '',
        citta: editOpen.citta || ''
      });
    }
  }, [editOpen]);

  const updateProperty = useMutation({
    mutationFn: async () => {
      if (!editOpen) return;
      const { error } = await supabase.from('properties_real').update({
          nome: editFormData.nome, indirizzo: editFormData.indirizzo, citta: editFormData.citta
        }).eq('id', editOpen.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties_real'] });
      setEditOpen(null);
      toast({ title: "Proprietà aggiornata" });
    },
    onError: () => toast({ title: "Errore aggiornamento", variant: "destructive" })
  });

  const deleteProperty = useMutation({
    mutationFn: async () => {
      if (!deleteOpen) return;
      const { error } = await supabase.from('properties_real').delete().eq('id', deleteOpen.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties_real'] });
      setDeleteOpen(null);
      toast({ title: "Proprietà eliminata" });
    },
    onError: (err:any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  const { data: propertyHistory } = useQuery({
    queryKey: ['property-history', detailsOpen?.id],
    queryFn: async () => {
      if (!detailsOpen) return [];
      const { data } = await supabase.from('bookings').select('*, tenant_payments(*)').eq('property_id', detailsOpen.id).order('data_inizio', { ascending: false });
      return data || [];
    },
    enabled: !!detailsOpen
  });

  // QUERY DOCUMENTI
  const { data: allDocs } = useQuery({
    queryKey: ['property-docs-full', docsOpen?.id],
    queryFn: async () => {
      if (!docsOpen) return { struct: [], tenant: [], expense: [] };
      
      // 1. Documenti Strutturali (Senza Spesa)
      const { data: structDocs } = await supabase.from('documents')
        .select('*')
        .eq('property_real_id', docsOpen.id)
        .is('payment_id', null) 
        .order('uploaded_at', { ascending: false });

      // 2. Documenti Inquilini
      const { data: bookings } = await supabase.from('bookings').select('id').eq('property_id', docsOpen.id);
      const bookingIds = bookings?.map(b => b.id) || [];
      let tenantDocs: any[] = [];
      if (bookingIds.length > 0) {
          const { data: tDocs } = await supabase.from('booking_documents')
            .select('*, bookings(nome_ospite)').in('booking_id', bookingIds).order('uploaded_at', { ascending: false });
          tenantDocs = tDocs || [];
      }

      // 3. Documenti Spese (Con pagamento)
      const { data: expenseDocs } = await supabase.from('documents')
        .select(`*, payments (*)`)
        .eq('property_real_id', docsOpen.id)
        .not('payment_id', 'is', null)
        .order('uploaded_at', { ascending: false });

      return { struct: structDocs || [], tenant: tenantDocs || [], expense: expenseDocs || [] };
    },
    enabled: !!docsOpen
  });

  // Funzione helper per unire e ordinare tutto nella vista "Tutti"
  const getCombinedDocs = () => {
      if (!allDocs) return [];
      // Unisce strutturali e spese
      const combined = [...(allDocs.struct || []), ...(allDocs.expense || [])];
      // Ordina dal più recente
      return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const { data: tenantDetails } = useQuery({
    queryKey: ['tenant-details-full', selectedTenant?.id],
    queryFn: async () => {
        if (!selectedTenant) return { tickets: [], payments: [], docs: [] };
        const [tickets, payments, docs] = await Promise.all([
            supabase.from('tickets').select('*').eq('booking_id', selectedTenant.id).order('created_at', { ascending: false }),
            supabase.from('tenant_payments').select('*').eq('booking_id', selectedTenant.id).order('data_scadenza', { ascending: true }),
            supabase.from('booking_documents').select('*').eq('booking_id', selectedTenant.id).order('uploaded_at', { ascending: false })
        ]);
        return { tickets: tickets.data || [], payments: payments.data || [], docs: docs.data || [] };
    },
    enabled: !!selectedTenant
  });

  const handleSmartUpload = async () => {
      if (!docsOpen || !smartFile) return;
      setUploading(true);
      try {
          const { data: { user } } = await supabase.auth.getUser();
          
          const fileExt = smartFile.name.split('.').pop();
          const fileName = `prop_${docsOpen.id}_${Date.now()}.${fileExt}`;
          
          const { error: upError } = await supabase.storage.from('documents').upload(fileName, smartFile);
          if (upError) throw upError;

          let generatedExpenseId = null;

          if (isExpense && smartData.amount) {
              const { data: expenseData, error: expError } = await supabase.from('payments').insert({
                  user_id: user?.id,
                  property_real_id: docsOpen.id,
                  categoria: 'manutenzione', 
                  importo: parseFloat(smartData.amount),
                  importo_originale: parseFloat(smartData.amount),
                  descrizione: smartData.description || `Spesa da Doc: ${smartFile.name}`,
                  scadenza: smartData.date,
                  stato: 'pagato',
                  ricorrenza_tipo: 'nessuna'
              }).select().single();

              if (expError) throw expError;
              generatedExpenseId = expenseData.id;
          }

          const { error: docError } = await supabase.from('documents').insert({
              user_id: user?.id,
              property_real_id: docsOpen.id,
              nome: smartData.description || smartFile.name,
              tipo: isExpense ? 'fattura' : 'generico',
              url: fileName,
              formato: fileExt,
              importo: isExpense ? parseFloat(smartData.amount) : null,
              data_riferimento: smartData.date,
              payment_id: generatedExpenseId
          });

          if (docError) throw docError;

          toast({ title: "Caricamento completato", description: isExpense ? "Spesa registrata!" : "Archiviato." });
          
          setSmartFile(null);
          setIsExpense(false);
          setSmartData({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), description: '' });
          queryClient.invalidateQueries({ queryKey: ['property-docs-full'] });
          queryClient.invalidateQueries({ queryKey: ['unified-expenses'] });

      } catch (error: any) {
          toast({ title: "Errore", description: error.message, variant: "destructive" });
      } finally {
          setUploading(false);
      }
  };

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => await supabase.from('documents').delete().eq('id', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property-docs-full'] })
  });

  const filteredPropertiesReal = propertiesReal.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) && (filterType === 'all' || filterType === 'real')
  );

  const getDocUrl = (path: string) => supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestione Proprietà</h1>
            <p className="text-gray-500 text-sm">Gestisci immobili, documenti e storico</p>
        </div>
        <AddPropertyDialog><Button className="bg-blue-600">Aggiungi Proprietà</Button></AddPropertyDialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPropertiesReal.map(prop => (
            <Card key={prop.id} className="group hover:shadow-lg transition-all relative">
                <div className="h-32 bg-slate-100 relative overflow-hidden rounded-t-lg">
                    {prop.immagine_url ? (
                        <img src={prop.immagine_url} alt={prop.nome} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Home className="w-12 h-12"/></div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="secondary" className="h-8 w-8 bg-white/90" onClick={() => setEditOpen(prop)}>
                            <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => { setDeleteOpen(prop); setDeleteConfirmText(''); }}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
                <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-lg flex justify-between">
                        <span>{prop.nome}</span>
                        <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">Attivo</Badge>
                    </CardTitle>
                    <p className="text-xs text-gray-500 flex items-center"><MapPin className="w-3 h-3 mr-1"/> {prop.citta}</p>
                </CardHeader>
                <CardFooter className="bg-slate-50 p-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" className="w-full text-xs h-8" onClick={() => setDetailsOpen(prop)}>Analytics</Button>
                    <Button variant="outline" className="w-full text-xs h-8 bg-white hover:text-blue-700" onClick={() => setDocsOpen(prop)}>
                        <FolderOpen className="w-3 h-3 mr-1" /> Documenti
                    </Button>
                </CardFooter>
            </Card>
        ))}
      </div>

      <Dialog open={!!editOpen} onOpenChange={() => setEditOpen(null)}>
        <DialogContent>
            <DialogHeader><DialogTitle>Modifica Profilo</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <Input placeholder="Nome" value={editFormData.nome} onChange={e => setEditFormData({...editFormData, nome: e.target.value})} />
                <Input placeholder="Indirizzo" value={editFormData.indirizzo} onChange={e => setEditFormData({...editFormData, indirizzo: e.target.value})} />
                <Input placeholder="Città" value={editFormData.citta} onChange={e => setEditFormData({...editFormData, citta: e.target.value})} />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(null)}>Annulla</Button>
                <Button onClick={() => updateProperty.mutate()} className="bg-blue-600">Salva</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOpen} onOpenChange={() => setDeleteOpen(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600">Eliminazione Definitiva</AlertDialogTitle>
                <AlertDialogDescription>
                    Scrivi <strong>{deleteOpen?.nome}</strong> per confermare. Questa azione è irreversibile.
                    <Input className="mt-2 border-red-200" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={deleteOpen?.nome} />
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <Button variant="destructive" disabled={deleteConfirmText !== deleteOpen?.nome} onClick={() => deleteProperty.mutate()}>Elimina</Button>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!detailsOpen} onOpenChange={() => setDetailsOpen(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2"><Home className="w-5 h-5 text-blue-600"/> {detailsOpen?.nome}</SheetTitle>
                <SheetDescription>Registro storico occupanti.</SheetDescription>
            </SheetHeader>
            <div className="space-y-4">
                {propertyHistory?.map((booking) => (
                    <div key={booking.id} className="p-3 rounded-lg border bg-slate-50 cursor-pointer hover:bg-white hover:border-blue-300 transition-all" onClick={() => setSelectedTenant(booking)}>
                        <div className="flex justify-between">
                            <p className="font-bold text-sm">{booking.nome_ospite}</p>
                            <Badge variant="outline">{booking.tipo_affitto}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{format(new Date(booking.data_inizio), 'dd/MM/yy')} - {format(new Date(booking.data_fine), 'dd/MM/yy')}</p>
                    </div>
                ))}
            </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
            <div className="p-6 border-b bg-slate-50"><DialogTitle>{selectedTenant?.nome_ospite}</DialogTitle></div>
            <Tabs defaultValue="tickets" className="flex-1 p-6">
                <TabsList className="mb-4">
                    <TabsTrigger value="tickets">Ticket</TabsTrigger>
                    <TabsTrigger value="payments">Pagamenti</TabsTrigger>
                </TabsList>
                <TabsContent value="tickets">
                    {tenantDetails?.tickets.map((t:any) => (
                        <div key={t.id} className="p-3 border rounded mb-2 flex justify-between items-center">
                            <span>{t.titolo}</span>
                            <Button size="sm" variant="ghost" onClick={() => setManagingTicket(t)}>Gestisci</Button>
                        </div>
                    ))}
                </TabsContent>
                <TabsContent value="payments">
                    {tenantDetails?.payments.map((p:any) => (
                        <div key={p.id} className="p-3 border rounded mb-2 flex justify-between">
                            <span>{p.description || p.tipo}</span>
                            <span className="font-bold">€{p.importo}</span>
                        </div>
                    ))}
                </TabsContent>
            </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={!!docsOpen} onOpenChange={() => setDocsOpen(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-blue-600"/> Archivio: {docsOpen?.nome}</DialogTitle></DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden mt-2">
                
                <div className="bg-slate-50 p-4 rounded-lg border flex flex-col gap-4 overflow-y-auto">
                    <h4 className="font-bold flex items-center gap-2 text-sm uppercase text-slate-500">Carica Nuovo</h4>
                    <div className="space-y-2">
                        <Label>Seleziona File</Label>
                        <Input type="file" className="bg-white" onChange={(e) => { setSmartFile(e.target.files?.[0] || null); setSmartData({...smartData, description: e.target.files?.[0]?.name || ''}) }} />
                    </div>
                    {smartFile && (
                        <div className="bg-white p-3 rounded border shadow-sm space-y-3 animate-in fade-in">
                            <div className="flex items-center justify-between">
                                <Label className="cursor-pointer text-sm font-bold text-blue-800">Genera Spesa?</Label>
                                <Switch checked={isExpense} onCheckedChange={setIsExpense} />
                            </div>
                            {isExpense && (
                                <>
                                  <div className="grid gap-1">
                                      <Label className="text-xs">Importo (€)</Label>
                                      <div className="relative">
                                          <Euro className="absolute left-2 top-2.5 w-3 h-3 text-gray-400"/>
                                          <Input className="pl-7 h-8" type="number" value={smartData.amount} onChange={e => setSmartData({...smartData, amount: e.target.value})} />
                                      </div>
                                  </div>
                                  <div className="grid gap-1">
                                      <Label className="text-xs">Data Rif.</Label>
                                      <Input className="h-8" type="date" value={smartData.date} onChange={e => setSmartData({...smartData, date: e.target.value})} />
                                  </div>
                                </>
                            )}
                            <div className="grid gap-1">
                                <Label className="text-xs">Descrizione</Label>
                                <Input className="h-8" value={smartData.description} onChange={e => setSmartData({...smartData, description: e.target.value})} />
                            </div>
                            <Button className="w-full bg-blue-600" size="sm" onClick={handleSmartUpload} disabled={uploading}>
                                {uploading ? '...' : (isExpense ? 'Salva & Contabilizza' : 'Archivia')}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="md:col-span-2 overflow-y-auto">
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="all">Tutti</TabsTrigger>
                            <TabsTrigger value="spese">Spese</TabsTrigger>
                        </TabsList>
                        
                        {/* TAB TUTTI - ORA COMBINA I DOCUMENTI */}
                        <TabsContent value="all" className="space-y-2 mt-2">
                            {getCombinedDocs().map((doc: any) => (
                                <div key={doc.id} className="flex justify-between items-center p-3 border rounded bg-white hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        {/* Icona Diversa se Spesa o Doc */}
                                        {doc.payment_id ? <Euro className="w-4 h-4 text-green-600"/> : <FileText className="w-4 h-4 text-gray-400"/>}
                                        <div>
                                            <span className="text-sm font-medium truncate max-w-[200px] block">{doc.nome}</span>
                                            {/* Se è spesa, mostra importo */}
                                            {doc.payments && (
                                                <span className="text-[10px] text-green-600 bg-green-50 px-1 rounded">
                                                    € {doc.payments.importo} - {doc.payments.categoria}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(getDocUrl(doc.url), '_blank')}><Eye className="w-3 h-3"/></Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteDoc.mutate(doc.id)}><Trash2 className="w-3 h-3"/></Button>
                                    </div>
                                </div>
                            ))}
                            {getCombinedDocs().length === 0 && <p className="text-gray-400 text-center text-sm mt-4">Nessun documento.</p>}
                        </TabsContent>

                        {/* TAB SOLO SPESE */}
                        <TabsContent value="spese" className="space-y-2 mt-2">
                            {allDocs?.expense.map((doc: any) => (
                                <div key={doc.id} className="flex justify-between items-center p-3 border rounded bg-white hover:bg-slate-50 border-l-4 border-l-green-500">
                                    <div>
                                        <div className="flex items-center gap-2"><Euro className="w-4 h-4 text-green-600"/><span className="text-sm font-bold">{doc.nome}</span></div>
                                        {doc.payments && <p className="text-xs text-gray-500 ml-6">€ {doc.payments.importo} ({doc.payments.categoria})</p>}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(getDocUrl(doc.url), '_blank')}><Eye className="w-3 h-3"/></Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteDoc.mutate(doc.id)}><Trash2 className="w-3 h-3"/></Button>
                                    </div>
                                </div>
                            ))}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {managingTicket && (
        <TicketManager 
            ticket={managingTicket} 
            isOpen={!!managingTicket} 
            onClose={() => setManagingTicket(null)}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['tenant-details-full'] })}
            isReadOnly={managingTicket.stato === 'risolto'} 
        />
      )}
    </div>
  );
};

export default Properties;