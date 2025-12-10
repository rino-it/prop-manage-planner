import { AddPropertyDialog } from './AddPropertyDialog';
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { MapPin, Pencil, Home, FileText, Upload, Download, Trash2, Users, TrendingUp, Clock, AlertCircle, FolderOpen, Euro, Calendar as CalendarIcon, MessageSquare, CreditCard, Eye, Check, X, UserCog, User, Wrench, AlertTriangle } from 'lucide-react';
import { usePropertiesReal, usePropertiesMobile } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, isBefore, addDays } from 'date-fns';
import TicketManager from '@/components/TicketManager';

const Properties = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'real' | 'mobile'>('all');
  
  // --- STATI GESTIONE ---
  const [detailsOpen, setDetailsOpen] = useState<any>(null); // SIDEBAR ANALYTICS & STORICO
  const [docsOpen, setDocsOpen] = useState<any>(null); // ARCHIVIO DOCUMENTI IMMOBILE
  const [editOpen, setEditOpen] = useState<any>(null); // MODIFICA PROPRIETÀ
  
  // --- STATI SCHEDA CLIENTE (DENTRO ANALYTICS) ---
  const [selectedTenant, setSelectedTenant] = useState<any>(null); // APRE IL DIALOG CLIENTE
  const [managingTicket, setManagingTicket] = useState<any>(null); // APRE TICKET MANAGER

  const { data: propertiesReal = [] } = usePropertiesReal();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // 1. QUERY STORICO INQUILINI (Per Analytics)
  const { data: propertyHistory } = useQuery({
    queryKey: ['property-history', detailsOpen?.id],
    queryFn: async () => {
      if (!detailsOpen) return [];
      const { data } = await supabase
        .from('bookings')
        .select('*, tenant_payments(*)') // Prendiamo anche i pagamenti per calcolare i totali
        .eq('property_id', detailsOpen.id)
        .order('data_inizio', { ascending: false });
      return data || [];
    },
    enabled: !!detailsOpen
  });

  // 2. QUERY DOCUMENTI ARCHIVIO (Divisi in 3 tab)
  const { data: allDocs } = useQuery({
    queryKey: ['property-docs-full', docsOpen?.id],
    queryFn: async () => {
      if (!docsOpen) return { struct: [], tenant: [], expense: [] };
      
      const { data: structDocs } = await supabase.from('documents')
        .select('*').eq('property_real_id', docsOpen.id).is('expense_id', null).order('created_at', { ascending: false });

      const { data: bookings } = await supabase.from('bookings').select('id').eq('property_id', docsOpen.id);
      const bookingIds = bookings?.map(b => b.id) || [];
      
      let tenantDocs: any[] = [];
      if (bookingIds.length > 0) {
          const { data: tDocs } = await supabase.from('booking_documents')
            .select('*, bookings(nome_ospite)').in('booking_id', bookingIds).order('uploaded_at', { ascending: false });
          tenantDocs = tDocs || [];
      }

      const { data: expenseDocs } = await supabase.from('documents')
        .select('*, property_expenses(amount, category)').eq('property_real_id', docsOpen.id).not('expense_id', 'is', null).order('created_at', { ascending: false });

      return { struct: structDocs || [], tenant: tenantDocs || [], expense: expenseDocs || [] };
    },
    enabled: !!docsOpen
  });

  // 3. QUERY DETTAGLI CLIENTE (Quando apro la scheda)
  const { data: tenantDetails } = useQuery({
    queryKey: ['tenant-details-full', selectedTenant?.id],
    queryFn: async () => {
        if (!selectedTenant) return { tickets: [], payments: [], docs: [] };
        
        const [tickets, payments, docs] = await Promise.all([
            supabase.from('tickets').select('*').eq('booking_id', selectedTenant.id).order('created_at', { ascending: false }),
            supabase.from('tenant_payments').select('*').eq('booking_id', selectedTenant.id).order('data_scadenza', { ascending: true }),
            supabase.from('booking_documents').select('*').eq('booking_id', selectedTenant.id).order('uploaded_at', { ascending: false })
        ]);

        return { 
            tickets: tickets.data || [], 
            payments: payments.data || [], 
            docs: docs.data || [] 
        };
    },
    enabled: !!selectedTenant
  });

  // MUTATIONS (Upload, Delete, Review)
  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      if (!docsOpen) return;
      setUploading(true);
      const fileName = `prop_${docsOpen.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(fileName, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('documents').insert({
        property_real_id: docsOpen.id, nome: file.name, url: fileName, tipo: 'altro'
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

  const reviewDoc = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
        await supabase.from('booking_documents').update({ status }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-details-full'] })
  });

  const filteredPropertiesReal = propertiesReal.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) && (filterType === 'all' || filterType === 'real')
  );

  const getDocUrl = (path: string) => supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Proprietà</h1>
        <AddPropertyDialog><Button className="bg-blue-600">Aggiungi Proprietà</Button></AddPropertyDialog>
      </div>

      {/* GRID PROPRIETÀ */}
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
                    <Button variant="outline" className="w-full text-xs bg-slate-50 border-slate-200 hover:bg-blue-50 hover:text-blue-700" onClick={() => setDocsOpen(prop)}>
                        <FolderOpen className="w-3 h-3 mr-2" /> Archivio
                    </Button>
                </div>
            </CardContent>
            </Card>
        ))}
      </div>

      {/* --- 1. SIDEBAR ANALYTICS & STORICO --- */}
      <Sheet open={!!detailsOpen} onOpenChange={() => setDetailsOpen(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2"><Home className="w-5 h-5 text-blue-600"/> {detailsOpen?.nome}</SheetTitle>
                <SheetDescription>Registro storico occupanti e performance.</SheetDescription>
            </SheetHeader>
            
            <div className="space-y-6">
                {/* KPI RAPIDI */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100 text-center">
                        <p className="text-xs text-green-600 font-bold uppercase">Tot. Incassato</p>
                        <p className="text-xl font-bold text-green-800">
                            € {propertyHistory?.reduce((acc, b) => acc + (b.tenant_payments?.filter((p:any) => p.stato === 'pagato').reduce((pa:number, pc:any) => pa + Number(pc.importo), 0) || 0), 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
                        <p className="text-xs text-blue-600 font-bold uppercase">Tot. Inquilini</p>
                        <p className="text-xl font-bold text-blue-800">{propertyHistory?.length || 0}</p>
                    </div>
                </div>

                <div className="border-t pt-4">
                    <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2"><Clock className="w-4 h-4"/> Cronologia Inquilini</h4>
                    <div className="space-y-3">
                        {propertyHistory?.map((booking) => {
                            const isCurrent = new Date(booking.data_fine) >= new Date();
                            return (
                                <div key={booking.id} className={`p-3 rounded-lg border flex justify-between items-center cursor-pointer hover:shadow-sm transition-all ${isCurrent ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-200 opacity-80'}`} onClick={() => setSelectedTenant(booking)}>
                                    <div>
                                        <p className="font-bold text-sm text-gray-800">{booking.nome_ospite}</p>
                                        <p className="text-xs text-gray-500">
                                            {format(new Date(booking.data_inizio), 'dd/MM/yy')} - {format(new Date(booking.data_fine), 'dd/MM/yy')}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {isCurrent ? <Badge className="bg-green-100 text-green-700 text-[10px]">Attivo</Badge> : <Badge variant="outline" className="text-[10px]">Passato</Badge>}
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><Users className="w-4 h-4 text-blue-500" /></Button>
                                    </div>
                                </div>
                            );
                        })}
                        {propertyHistory?.length === 0 && <p className="text-center text-sm text-gray-400 py-4">Nessun inquilino registrato.</p>}
                    </div>
                </div>
            </div>
        </SheetContent>
      </Sheet>

      {/* --- 2. DIALOG SCHEDA CLIENTE (Apribile dallo storico) --- */}
      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-start">
                <div className="flex gap-4 items-center">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200"><User className="w-6 h-6" /></div>
                    <div>
                        <DialogTitle className="text-xl font-bold text-gray-900">{selectedTenant?.nome_ospite}</DialogTitle>
                        <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{detailsOpen?.nome}</span> 
                            <span className="capitalize">{selectedTenant?.tipo_affitto} Termine</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                <Tabs defaultValue="overview" className="flex-1 flex flex-col">
                    <div className="px-6 pt-4 border-b bg-white">
                        <TabsList className="grid w-full grid-cols-4 lg:w-[480px]">
                            <TabsTrigger value="overview">Panoramica</TabsTrigger>
                            <TabsTrigger value="docs">Documenti</TabsTrigger>
                            <TabsTrigger value="tickets">Ticket</TabsTrigger>
                            <TabsTrigger value="payments">Contabilità</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-white/50">
                        {/* PANORAMICA */}
                        <TabsContent value="overview" className="mt-0 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="bg-white border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 font-medium uppercase tracking-wider">Soggiorno</CardTitle></CardHeader><CardContent><div className="flex items-center gap-3 text-lg"><CalendarIcon className="w-5 h-5 text-blue-600"/><span className="font-bold">{format(new Date(selectedTenant?.data_inizio || new Date()), 'dd MMM yyyy')}</span><span className="text-gray-300">→</span><span className="font-bold">{format(new Date(selectedTenant?.data_fine || new Date()), 'dd MMM yyyy')}</span></div></CardContent></Card>
                                <Card className="bg-white border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 font-medium uppercase tracking-wider">Contatti</CardTitle></CardHeader><CardContent className="space-y-1"><p className="text-sm flex items-center gap-2"><span className="text-gray-400">✉️</span> {selectedTenant?.email_ospite || 'Nessuna email'}</p><p className="text-sm flex items-center gap-2"><span className="text-gray-400">📞</span> {selectedTenant?.telefono_ospite || 'Nessun telefono'}</p></CardContent></Card>
                            </div>
                        </TabsContent>

                        {/* DOCUMENTI */}
                        <TabsContent value="docs" className="mt-0 space-y-3">
                            {tenantDetails?.docs.map((doc: any) => (
                                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm">
                                    <div className="flex items-center gap-3"><FileText className="w-5 h-5 text-gray-400" /><div className="overflow-hidden"><p className="font-medium text-sm text-gray-900">{doc.filename}</p><p className="text-xs text-gray-500">{format(new Date(doc.uploaded_at), 'dd MMM HH:mm')}</p></div></div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => window.open(getDocUrl(doc.file_url), '_blank')}><Eye className="w-4 h-4 text-gray-500" /></Button>
                                        {doc.status === 'in_revisione' ? <div className="flex gap-1"><Button size="icon" className="h-7 w-7 bg-green-600" onClick={() => reviewDoc.mutate({ id: doc.id, status: 'approvato' })}><Check className="w-4 h-4" /></Button><Button size="icon" className="h-7 w-7 bg-red-600" onClick={() => reviewDoc.mutate({ id: doc.id, status: 'rifiutato' })}><X className="w-4 h-4" /></Button></div> : <Badge variant={doc.status === 'approvato' ? 'default' : 'destructive'} className="capitalize">{doc.status}</Badge>}
                                    </div>
                                </div>
                            ))}
                            {tenantDetails?.docs.length === 0 && <p className="text-center text-gray-400 py-8">Nessun documento.</p>}
                        </TabsContent>

                        {/* TICKET (Con Tasto Gestisci) */}
                        <TabsContent value="tickets" className="mt-0 space-y-3">
                            {tenantDetails?.tickets.map((ticket: any) => (
                                <div key={ticket.id} className="p-4 border rounded-lg bg-white shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-gray-900 flex items-center gap-2">{ticket.priorita === 'alta' && <AlertCircle className="w-4 h-4 text-red-500" />}{ticket.titolo}</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={ticket.stato === 'risolto' ? 'secondary' : 'destructive'} className="uppercase text-[10px] tracking-wider">{ticket.stato}</Badge>
                                            <Button size="sm" variant="ghost" className="h-6 text-blue-600 hover:bg-blue-50" onClick={() => setManagingTicket(ticket)}><UserCog className="w-3 h-3 mr-1" /> Gestisci</Button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3 bg-slate-50 p-2 rounded border border-slate-100">"{ticket.descrizione}"</p>
                                    <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                                        <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> {format(new Date(ticket.created_at), 'dd MMM yyyy')}</span>
                                        {ticket.creato_da === 'ospite' && <span className="flex items-center gap-1 text-blue-500 font-medium"><MessageSquare className="w-3 h-3"/> Creato da Ospite</span>}
                                    </div>
                                </div>
                            ))}
                            {tenantDetails?.tickets.length === 0 && <p className="text-center text-gray-400 py-8">Nessuna segnalazione.</p>}
                        </TabsContent>

                        {/* PAGAMENTI */}
                        <TabsContent value="payments" className="mt-0 space-y-3">
                            {tenantDetails?.payments.map((pay: any) => (
                                <div key={pay.id} className="flex justify-between items-center p-4 border rounded-lg bg-white shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${pay.stato === 'pagato' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}><CreditCard className="w-5 h-5" /></div>
                                        <div><p className="font-bold text-gray-900 capitalize">{pay.tipo?.replace('_', ' ') || 'Rata'}</p><p className="text-xs text-gray-500 font-medium">Scadenza: {format(new Date(pay.data_scadenza), 'dd MMM yyyy')}</p></div>
                                    </div>
                                    <div className="text-right"><p className="font-bold text-lg text-slate-800">€ {pay.importo}</p><Badge variant="outline" className={pay.stato === 'pagato' ? 'text-green-600 border-green-200 bg-green-50' : 'text-red-600 border-red-200 bg-red-50'}>{pay.stato.toUpperCase()}</Badge></div>
                                </div>
                            ))}
                            {tenantDetails?.payments.length === 0 && <p className="text-center text-gray-400 py-8">Nessun movimento.</p>}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedTenant(null)}>Chiudi Scheda</Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- 3. DIALOG ARCHIVIO DOCUMENTI (TABBED) --- */}
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
                    <TabsContent value="immobile" className="space-y-4">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => fileInputRef.current?.click()}><Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" /><p className="text-sm text-slate-600">{uploading ? 'Caricamento...' : 'Carica Visura / Planimetria'}</p><input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && uploadDoc.mutate(e.target.files[0])} disabled={uploading} /></div>
                        <div className="space-y-2">{allDocs?.struct.map((doc: any) => (<div key={doc.id} className="flex justify-between items-center p-3 border rounded hover:bg-slate-50"><div className="flex items-center gap-3"><FileText className="w-4 h-4 text-blue-500" /><span className="text-sm font-medium">{doc.nome}</span></div><div className="flex gap-2"><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(getDocUrl(doc.url), '_blank')}><Download className="w-3 h-3" /></Button><Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => deleteDoc.mutate(doc.id)}><Trash2 className="w-3 h-3" /></Button></div></div>))}</div>
                    </TabsContent>
                    <TabsContent value="inquilini" className="space-y-4">
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-xs text-blue-700 flex gap-2"><Users className="w-4 h-4" /> I documenti provengono dalle prenotazioni.</div>
                        <div className="space-y-2">{allDocs?.tenant.map((doc: any) => (<div key={doc.id} className="flex justify-between items-center p-3 border rounded bg-white"><div><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-purple-500" /><span className="text-sm font-medium">{doc.filename}</span></div><p className="text-xs text-gray-500 ml-6">Ospite: {doc.bookings?.nome_ospite}</p></div><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(getDocUrl(doc.file_url), '_blank')}><Download className="w-3 h-3" /></Button></div>))}</div>
                    </TabsContent>
                    <TabsContent value="spese" className="space-y-4">
                        <div className="bg-green-50 p-3 rounded-md border border-green-100 text-xs text-green-700 flex gap-2"><Euro className="w-4 h-4" /> Generati automaticamente dalle Spese.</div>
                        <div className="space-y-2">{allDocs?.expense.map((doc: any) => (<div key={doc.id} className="flex justify-between items-center p-3 border rounded bg-white"><div><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-600" /><span className="text-sm font-medium">{doc.nome}</span></div>{doc.property_expenses && <p className="text-xs text-gray-500 ml-6">Importo: €{doc.property_expenses.amount} ({doc.property_expenses.category})</p>}</div><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(getDocUrl(doc.url), '_blank')}><Download className="w-3 h-3" /></Button></div>))}</div>
                    </TabsContent>
                </div>
            </Tabs>
        </DialogContent>
      </Dialog>

      {/* --- GESTORE TICKET --- */}
      {managingTicket && (
        <TicketManager 
            ticket={managingTicket} 
            isOpen={!!managingTicket} 
            onClose={() => setManagingTicket(null)}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['tenant-details-full'] })}
            isReadOnly={managingTicket.stato === 'risolto'} 
        />
      )}

      {/* MODALE DI MODIFICA (Placeholder) */}
      {editOpen && (
        <Dialog open={!!editOpen} onOpenChange={() => setEditOpen(null)}>
            <DialogContent><DialogHeader><DialogTitle>Modifica Proprietà</DialogTitle></DialogHeader><p>Funzionalità modifica in arrivo...</p></DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Properties;