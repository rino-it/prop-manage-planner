import { AddPropertyDialog } from './AddPropertyDialog';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Pencil, Home, FileText, Trash2, Users, FolderOpen, Euro, Calendar as CalendarIcon, Eye, UserCog, User, AlertTriangle, Loader2, Plus, X, Link2, RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import TicketManager from '@/components/TicketManager';
import PaymentSettingsComponent from '@/components/PaymentSettings';
import { PropertyMapWidget } from '@/components/PropertyMapWidget';
import { PageHeader } from '@/components/ui/page-header';
import { PropertyThumbnail } from '@/components/ui/property-thumbnail';
import { StatusDot } from '@/components/ui/status-dot';

const Properties = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'real' | 'mobile'>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState<any>(null);
  const [docsOpen, setDocsOpen] = useState<any>(null);
  const [editOpen, setEditOpen] = useState<any>(null);

  const [deleteOpen, setDeleteOpen] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [editFormData, setEditFormData] = useState({ nome: '', indirizzo: '', citta: '' });

  const [renamingDoc, setRenamingDoc] = useState<{id: string, nome: string, type: string} | null>(null);
  const [newName, setNewName] = useState('');

  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [managingTicket, setManagingTicket] = useState<any>(null);

  const [smartFile, setSmartFile] = useState<File | null>(null);
  const [isExpense, setIsExpense] = useState(false);
  const [shareWithTenant, setShareWithTenant] = useState(false);
  const [smartData, setSmartData] = useState({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), description: '' });
  const [uploading, setUploading] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: propertiesReal = [], isLoading } = useQuery({
    queryKey: ['properties_real'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties_real')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    if (editOpen) {
      setEditFormData({
        nome: editOpen.nome || '',
        indirizzo: editOpen.indirizzo || '',
        citta: editOpen.citta || ''
      });
    }
  }, [editOpen]);

  useEffect(() => {
    if (renamingDoc) {
        setNewName(renamingDoc.nome);
    }
  }, [renamingDoc]);

  useEffect(() => {
    if (!smartFile) {
        setIsExpense(false);
        setShareWithTenant(false);
    }
  }, [smartFile, docsOpen]);

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
      toast({ title: "Proprieta aggiornata" });
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
      toast({ title: "Proprieta eliminata" });
    },
    onError: (err:any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  const renameDocument = useMutation({
      mutationFn: async () => {
          if (!renamingDoc) return;

          if (renamingDoc.type === 'tenant') {
              const { error } = await supabase.from('booking_documents')
                  .update({ filename: newName })
                  .eq('id', renamingDoc.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('documents')
                  .update({ nome: newName })
                  .eq('id', renamingDoc.id);
              if (error) throw error;
          }
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['property-docs-full'] });
          setRenamingDoc(null);
          toast({ title: "Documento rinominato" });
      },
      onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
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

  const { data: allDocs } = useQuery({
    queryKey: ['property-docs-full', docsOpen?.id],
    queryFn: async () => {
      if (!docsOpen) return { struct: [], tenant: [], expense: [] };

      try {
          const { data: rawDocs, error } = await supabase.from('documents')
            .select(`*, payments(*)`)
            .eq('property_real_id', docsOpen.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const { data: bookings } = await supabase.from('bookings').select('id').eq('property_id', docsOpen.id);
          const bookingIds = bookings?.map(b => b.id) || [];
          let tenantDocs: any[] = [];

          if (bookingIds.length > 0) {
              const { data: tDocs } = await supabase.from('booking_documents')
                .select('*, bookings(nome_ospite, tipo_affitto)')
                .in('booking_id', bookingIds)
                .order('uploaded_at', { ascending: false });
              tenantDocs = tDocs || [];
          }

          const structDocs = rawDocs?.filter(d => !d.payment_id) || [];
          const expenseDocs = rawDocs?.filter(d => d.payment_id) || [];

          return { struct: structDocs, tenant: tenantDocs, expense: expenseDocs };

      } catch (e) {
          console.error("Eccezione fetch docs:", e);
          return { struct: [], tenant: [], expense: [] };
      }
    },
    enabled: !!docsOpen
  });

  const getCombinedDocs = () => {
      if (!allDocs) return [];

      const normalizedStruct = allDocs.struct.map((d: any) => ({...d, type: 'struct', date: d.created_at}));
      const normalizedExpense = allDocs.expense.map((d: any) => ({...d, type: 'expense', date: d.created_at}));
      const normalizedTenant = allDocs.tenant.map((d: any) => ({
          id: d.id,
          nome: d.filename,
          url: d.file_url,
          created_at: d.uploaded_at,
          date: d.uploaded_at,
          type: 'tenant',
          bookings: d.bookings
      }));

      const combined = [...normalizedStruct, ...normalizedExpense, ...normalizedTenant];
      return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

          if (shareWithTenant) {
              const today = new Date().toISOString().split('T')[0];
              const { data: activeBooking, error: bookingError } = await supabase
                  .from('bookings')
                  .select('id, nome_ospite')
                  .eq('property_id', docsOpen.id)
                  .lte('data_inizio', today)
                  .gte('data_fine', today)
                  .maybeSingle();

              if (bookingError) throw bookingError;

              if (!activeBooking) {
                  toast({ title: "Attenzione", description: "Nessun inquilino attivo trovato oggi per condividere il file.", variant: "destructive" });
                  setUploading(false);
                  return;
              }

              const { error: shareError } = await supabase.from('booking_documents').insert({
                  booking_id: activeBooking.id,
                  filename: smartData.description || smartFile.name,
                  file_url: fileName
              });

              if (shareError) throw shareError;
              toast({ title: "Condiviso", description: `File inviato a ${activeBooking.nome_ospite}` });

          } else {
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
          }

          setSmartFile(null);
          setIsExpense(false);
          setShareWithTenant(false);
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
    mutationFn: async ({ id, type }: { id: string, type: string }) => {
        if (type === 'tenant') {
            await supabase.from('booking_documents').delete().eq('id', id);
        } else {
            await supabase.from('documents').delete().eq('id', id);
        }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property-docs-full'] })
  });

  const filteredPropertiesReal = propertiesReal.filter((p: any) =>
    p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) && (filterType === 'all' || filterType === 'real')
  );

  const getDocUrl = (path: string) => supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;

  return (
    <div className="space-y-5 pb-20 animate-in fade-in">
      <PageHeader title="Proprieta" count={filteredPropertiesReal.length}>
        <Button variant="outline" size="sm" onClick={() => {}}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Importa
        </Button>
        <Button size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Aggiungi Proprieta
        </Button>
      </PageHeader>

      <AddPropertyDialog
        isOpen={isAddOpen}
        onOpenChange={(open) => setIsAddOpen(open)}
        onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['properties_real'] });
        }}
      />

      {/* FILTER BAR */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca proprieta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-card"
          />
        </div>
        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 bg-card">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="real">Immobili</SelectItem>
            <SelectItem value="mobile">Mezzi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* DATA TABLE */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[35%]">Proprieta</TableHead>
              <TableHead className="hidden md:table-cell">Citta</TableHead>
              <TableHead className="hidden lg:table-cell">Stato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : filteredPropertiesReal.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <Home className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nessuna proprieta trovata.
                </TableCell>
              </TableRow>
            ) : (
              filteredPropertiesReal.map((prop: any) => (
                <TableRow key={prop.id} className="group cursor-pointer" onClick={() => setDetailsOpen(prop)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <PropertyThumbnail
                        src={prop.immagine_url}
                        name={prop.nome || 'Proprieta'}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">{prop.nome}</div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          {prop.indirizzo || prop.citta || 'Indirizzo non specificato'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">{prop.citta || '-'}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <StatusDot variant="success" label="Attivo" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDocsOpen(prop); }} title="Documenti">
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditOpen(prop); }} title="Modifica">
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteOpen(prop); setDeleteConfirmText(''); }}
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs hidden lg:inline-flex"
                        onClick={(e) => {
                          e.stopPropagation();
                          const link = `https://prop-manage-planner.vercel.app/guest/auto?name=NOME_OSPITE&checkin=DATA_CHECKIN&checkout=DATA_CHECKOUT&property=${prop.id}`;
                          navigator.clipboard.writeText(link);
                          toast({ title: "Link Auto copiato!", description: "Incollalo nei messaggi automatici di Airbnb/Booking. Sostituisci i placeholder con gli shortcode della piattaforma." });
                        }}
                      >
                        <Link2 className="w-3 h-3 mr-1" /> Link Auto
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* DIALOG MODIFICA */}
      <Dialog open={!!editOpen} onOpenChange={() => setEditOpen(null)}>
        <DialogContent className="sm:max-w-md w-[95vw]">
            <DialogHeader><DialogTitle>Modifica Profilo</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <div className="grid gap-2"><Label>Nome</Label><Input placeholder="Nome" value={editFormData.nome} onChange={e => setEditFormData({...editFormData, nome: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Indirizzo</Label><Input placeholder="Indirizzo" value={editFormData.indirizzo} onChange={e => setEditFormData({...editFormData, indirizzo: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Citta</Label><Input placeholder="Citta" value={editFormData.citta} onChange={e => setEditFormData({...editFormData, citta: e.target.value})} /></div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setEditOpen(null)} className="w-full sm:w-auto">Annulla</Button>
                <Button onClick={() => updateProperty.mutate()} className="w-full sm:w-auto">Salva</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG ELIMINAZIONE */}
      <AlertDialog open={!!deleteOpen} onOpenChange={() => setDeleteOpen(null)}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Eliminazione Definitiva</AlertDialogTitle>
                <AlertDialogDescription>
                    Scrivi <strong>{deleteOpen?.nome}</strong> per confermare. Questa azione e irreversibile.
                    <Input className="mt-4 border-destructive/30" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={deleteOpen?.nome} />
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel className="w-full sm:w-auto">Annulla</AlertDialogCancel>
                <Button variant="destructive" disabled={deleteConfirmText !== deleteOpen?.nome} onClick={() => deleteProperty.mutate()} className="w-full sm:w-auto">Elimina</Button>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SHEET STORICO */}
      <Sheet open={!!detailsOpen} onOpenChange={() => setDetailsOpen(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col">
            <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2"><Home className="w-5 h-5 text-primary"/> {detailsOpen?.nome}</SheetTitle>
                <SheetDescription>Gestione proprieta.</SheetDescription>
            </SheetHeader>
            {detailsOpen?.latitude && detailsOpen?.longitude && (
              <div className="mb-4">
                <PropertyMapWidget
                  latitude={detailsOpen.latitude}
                  longitude={detailsOpen.longitude}
                  address={detailsOpen.indirizzo}
                  height={180}
                />
              </div>
            )}
            <Tabs defaultValue="history" className="flex-1 flex flex-col">
                <TabsList className="mb-4 w-full grid grid-cols-2">
                    <TabsTrigger value="history">Storico</TabsTrigger>
                    <TabsTrigger value="settings">Pagamenti & Email</TabsTrigger>
                </TabsList>
                <TabsContent value="history" className="flex-1 overflow-y-auto">
                    <div className="space-y-3">
                        {propertyHistory?.map((booking) => (
                            <div key={booking.id} className="p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-card hover:border-primary/30 transition-all" onClick={() => setSelectedTenant(booking)}>
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-sm">{booking.nome_ospite}</p>
                                    <Badge variant="outline">{booking.tipo_affitto}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <CalendarIcon className="w-3 h-3"/>
                                    {format(new Date(booking.data_inizio), 'dd/MM/yy')} - {format(new Date(booking.data_fine), 'dd/MM/yy')}
                                </p>
                            </div>
                        ))}
                        {propertyHistory?.length === 0 && <p className="text-muted-foreground text-center py-8">Nessun dato storico.</p>}
                    </div>
                </TabsContent>
                <TabsContent value="settings" className="flex-1 overflow-y-auto">
                    <PaymentSettingsComponent propertyId={detailsOpen?.id} />
                </TabsContent>
            </Tabs>
        </SheetContent>
      </Sheet>

      {/* DIALOG INQUILINO */}
      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="sm:max-w-4xl w-[95vw] h-[85vh] max-h-[85vh] p-0 !overflow-hidden">
          <div className="flex flex-col h-full min-h-0">
            <div className="p-4 md:p-6 border-b bg-muted/30 flex justify-between items-center shrink-0">
                <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary"/> {selectedTenant?.nome_ospite}</DialogTitle>
                <Button size="sm" variant="ghost" onClick={() => setSelectedTenant(null)}><X className="w-4 h-4"/></Button>
            </div>
            <Tabs defaultValue="tickets" className="flex-1 min-h-0 p-4 md:p-6 overflow-hidden flex flex-col">
                <TabsList className="mb-4 w-full grid grid-cols-2">
                    <TabsTrigger value="tickets">Ticket</TabsTrigger>
                    <TabsTrigger value="payments">Pagamenti</TabsTrigger>
                </TabsList>
                <TabsContent value="tickets" className="flex-1 overflow-y-auto">
                    {tenantDetails?.tickets.map((t:any) => (
                        <div key={t.id} className="p-3 border rounded-lg mb-2 flex justify-between items-center bg-card hover:bg-muted/30">
                            <div>
                                <span className="text-sm font-semibold block">{t.titolo}</span>
                                <span className="text-xs text-muted-foreground">{format(new Date(t.created_at), 'dd MMM yyyy')}</span>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => setManagingTicket(t)} className="text-primary h-8"><UserCog className="w-4 h-4"/></Button>
                        </div>
                    ))}
                    {tenantDetails?.tickets.length === 0 && <p className="text-muted-foreground text-center py-4">Nessun ticket.</p>}
                </TabsContent>
                <TabsContent value="payments" className="flex-1 overflow-y-auto">
                    {tenantDetails?.payments.map((p:any) => (
                        <div key={p.id} className="p-3 border rounded-lg mb-2 flex justify-between items-center bg-card">
                            <div>
                                <span className="text-sm font-medium block capitalize">{p.tipo?.replace('_', ' ') || 'Rata'}</span>
                                <span className="text-xs text-muted-foreground">Scad: {format(new Date(p.data_scadenza), 'dd MMM')}</span>
                            </div>
                            <span className={`font-bold text-sm ${p.stato === 'pagato' ? 'text-emerald-600' : 'text-destructive'}`}>{p.importo} EUR</span>
                        </div>
                    ))}
                    {tenantDetails?.payments.length === 0 && <p className="text-muted-foreground text-center py-4">Nessun pagamento.</p>}
                </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG DOCUMENTI */}
      <Dialog open={!!docsOpen} onOpenChange={() => setDocsOpen(null)}>
        <DialogContent className="sm:max-w-4xl w-[95vw] h-[85vh] max-h-[85vh] !overflow-hidden">
          <div className="flex flex-col h-full min-h-0">
            <DialogHeader className="shrink-0"><DialogTitle className="flex items-center gap-2 truncate"><FolderOpen className="w-5 h-5 text-primary"/> Archivio: {docsOpen?.nome}</DialogTitle></DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden mt-2">
                <div className="bg-muted/30 p-4 rounded-lg border flex flex-col gap-4 overflow-y-auto">
                    <h4 className="font-semibold flex items-center gap-2 text-sm uppercase text-muted-foreground tracking-wider">Carica Nuovo</h4>
                    <div className="space-y-2">
                        <Label>Seleziona File</Label>
                        <Input type="file" className="bg-card" onChange={(e) => { setSmartFile(e.target.files?.[0] || null); setSmartData({...smartData, description: e.target.files?.[0]?.name || ''}) }} />
                    </div>
                    {smartFile && (
                        <div className="bg-card p-3 rounded-lg border shadow-sm space-y-3 animate-in fade-in">

                            <div className="flex items-center justify-between p-2 bg-primary/5 border border-primary/10 rounded-lg mb-2">
                                <Label className="text-sm font-semibold text-primary cursor-pointer">Condividi con Inquilino?</Label>
                                <Switch checked={shareWithTenant} onCheckedChange={(val) => { setShareWithTenant(val); if(val) setIsExpense(false); }} />
                            </div>

                            {!shareWithTenant && (
                                <div className="flex items-center justify-between">
                                    <Label className="cursor-pointer text-sm font-semibold text-muted-foreground">Genera Spesa?</Label>
                                    <Switch checked={isExpense} onCheckedChange={setIsExpense} />
                                </div>
                            )}

                            {isExpense && !shareWithTenant && (
                                <>
                                    <div className="grid gap-1">
                                        <Label className="text-xs">Importo (EUR)</Label>
                                        <div className="relative">
                                            <Euro className="absolute left-2 top-2.5 w-3 h-3 text-muted-foreground"/>
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
                            <Button className="w-full" size="sm" onClick={handleSmartUpload} disabled={uploading}>
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : (shareWithTenant ? 'Condividi Ora' : (isExpense ? 'Salva Spesa' : 'Archivia'))}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="md:col-span-2 overflow-y-auto">
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
                            <TabsTrigger value="all" className="flex-1">Tutti</TabsTrigger>
                            <TabsTrigger value="spese" className="flex-1">Spese</TabsTrigger>
                        </TabsList>

                        <TabsContent value="all" className="space-y-2 mt-2">
                            {getCombinedDocs().map((doc: any) => (
                                <div key={doc.id} className="flex justify-between items-center p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                        {doc.type === 'tenant' ? (
                                            <User className="w-8 h-8 p-1.5 bg-violet-100 text-violet-600 rounded-lg shrink-0"/>
                                        ) : doc.payment_id ? (
                                            <Euro className="w-8 h-8 p-1.5 bg-emerald-100 text-emerald-600 rounded-lg shrink-0"/>
                                        ) : (
                                            <FileText className="w-8 h-8 p-1.5 bg-muted text-muted-foreground rounded-lg shrink-0"/>
                                        )}

                                        <div className="min-w-0 flex-1 mr-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium truncate block max-w-[150px] sm:max-w-[200px]" title={doc.nome}>{doc.nome}</span>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-muted rounded-full" onClick={() => setRenamingDoc(doc)}>
                                                    <Pencil className="w-3 h-3 text-muted-foreground"/>
                                                </Button>
                                            </div>

                                            {doc.type === 'tenant' && doc.bookings && (
                                                <span className="text-[10px] text-violet-700 bg-violet-50 px-1.5 rounded truncate block w-fit mb-0.5">
                                                    {doc.bookings.nome_ospite}
                                                </span>
                                            )}

                                            {doc.payments && (
                                                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 rounded truncate block w-fit mb-0.5">
                                                    {doc.payments.importo} EUR - {doc.payments.categoria}
                                                </span>
                                            )}

                                            <span className="text-[10px] text-muted-foreground block">{format(new Date(doc.date), 'dd/MM/yyyy')}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-primary" onClick={() => window.open(getDocUrl(doc.url), '_blank')}><Eye className="w-4 h-4"/></Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteDoc.mutate({ id: doc.id, type: doc.type })}><Trash2 className="w-4 h-4"/></Button>
                                    </div>
                                </div>
                            ))}
                            {getCombinedDocs().length === 0 && <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed text-muted-foreground"><FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-20"/><p>Nessun documento.</p></div>}
                        </TabsContent>

                        <TabsContent value="spese" className="space-y-2 mt-2">
                            {allDocs?.expense.map((doc: any) => (
                                <div key={doc.id} className="flex justify-between items-center p-3 border rounded-lg bg-card hover:bg-muted/30 border-l-4 border-l-emerald-500">
                                    <div className="overflow-hidden flex-1">
                                        <div className="flex items-center gap-2">
                                            <Euro className="w-4 h-4 text-emerald-600 shrink-0"/>
                                            <span className="text-sm font-semibold truncate max-w-[200px]">{doc.nome}</span>
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setRenamingDoc({...doc, type: 'expense'})}>
                                                <Pencil className="w-3 h-3 text-muted-foreground"/>
                                            </Button>
                                        </div>
                                        {doc.payments && <p className="text-xs text-muted-foreground ml-6">{doc.payments.importo} EUR ({doc.payments.categoria})</p>}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(getDocUrl(doc.url), '_blank')}><Eye className="w-3 h-3"/></Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteDoc.mutate({ id: doc.id, type: 'expense' })}><Trash2 className="w-3 h-3"/></Button>
                                    </div>
                                </div>
                            ))}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG RINOMINA */}
      <Dialog open={!!renamingDoc} onOpenChange={() => setRenamingDoc(null)}>
        <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>Rinomina Documento</DialogTitle>
            </DialogHeader>
            <div className="py-4">
                <Label>Nuovo Nome</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-2" placeholder="Es. Fattura Idraulico" />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setRenamingDoc(null)}>Annulla</Button>
                <Button onClick={() => renameDocument.mutate()} disabled={!newName || newName === renamingDoc?.nome}>Salva</Button>
            </DialogFooter>
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