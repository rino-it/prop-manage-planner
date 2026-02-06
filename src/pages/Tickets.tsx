import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Calendar, UserCog, Plus, RotateCcw, 
  Eye, Home, User, AlertCircle, StickyNote, 
  Phone, FileText, Share2, Users, ChevronDown, Paperclip, X, Car, Filter, Info, Upload, FileSpreadsheet, Trash2, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';
import TicketManager from '@/components/TicketManager';
import { UserMultiSelect } from '@/components/UserMultiSelect';
import { pdf } from '@react-pdf/renderer';
import { TicketDocument } from '@/components/TicketPDF';

// --- MAPPING ESATTO PER IL TUO DB ---
const PROPERTY_SHORTCUTS = [
  { code: 'M', name: 'MENDOLA', search: 'MENDOLA', color: 'bg-blue-100 text-blue-800' },
  { code: 'V9', name: 'VERTOVA SUB 703', search: 'SUB 703', color: 'bg-green-100 text-green-800' }, 
  { code: 'V7', name: 'VERTOVA SUB 704', search: 'SUB 704', color: 'bg-emerald-100 text-emerald-800' },
  { code: 'C', name: 'CASA ZIE', search: 'ZIE', color: 'bg-yellow-100 text-yellow-800' },
  { code: 'S', name: 'SARDEGNA', search: 'SARDEGNA', color: 'bg-indigo-100 text-indigo-800' },
  { code: 'U', name: 'UFFICIO', search: 'UFFICIO', color: 'bg-gray-100 text-gray-800' },
  { code: 'E', name: 'ENDINE', search: 'ENDINE', color: 'bg-purple-100 text-purple-800' },
  { code: 'R', name: 'ROVARO', search: 'ROVARO', color: 'bg-orange-100 text-orange-800' },
];

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => 
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">{part}</a>
    ) : part
  );
};

export default function Tickets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: realProperties = [] } = usePropertiesReal();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false); // Stato Dialog Import
  const [ticketManagerOpen, setTicketManagerOpen] = useState<any>(null); 
  const [activeTab, setActiveTab] = useState('open'); 
  const [filterType, setFilterType] = useState('all'); 
  const [isProcessing, setIsProcessing] = useState(false);

  // FORM DATA
  const [targetType, setTargetType] = useState<'real' | 'mobile'>('real');
  const [formData, setFormData] = useState({
    titolo: '',
    descrizione: '',
    priorita: 'media',
    target_id: '', 
    booking_id: 'none',
    assigned_to: [] as string[],
    scadenza: '' // Nuovo campo Scadenza
  });

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null); // File per Import

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, email, phone');
      return data?.map(u => ({
        id: u.id,
        label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Utente',
        phone: u.phone,
        firstName: u.first_name
      })) || [];
    }
  });

  const { data: mobileProperties } = useQuery({
    queryKey: ['mobile-properties-ticket'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_mobile').select('id, veicolo, targa').eq('status', 'active');
      return data || [];
    }
  });

  const { data: activeTenants } = useQuery({
    queryKey: ['active-tenants-ticket', formData.target_id],
    queryFn: async () => {
        if (targetType !== 'real' || !formData.target_id) return [];
        const today = new Date().toISOString();
        const { data } = await supabase
            .from('bookings')
            .select('id, nome_ospite')
            .eq('property_id', formData.target_id)
            .lte('data_inizio', today)
            .gte('data_fine', today);
        return data || [];
    },
    enabled: targetType === 'real' && !!formData.target_id
  });

  const { data: tickets, isLoading, isError, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          properties_real (nome),
          properties_mobile (veicolo, targa),
          assigned_partner: profiles!assigned_partner_id(first_name, phone), 
          bookings (
            nome_ospite,
            telefono_ospite,
            properties_real (nome, indirizzo)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000 
  });

  // --- FUNZIONI AGGIUNTIVE ---

  const deleteOrphans = async () => {
      if(!confirm("Vuoi eliminare i ticket non assegnati a nessuna proprietà?")) return;
      setIsProcessing(true);
      try {
          const { error } = await supabase
            .from('tickets')
            .delete()
            .is('property_real_id', null)
            .is('property_mobile_id', null);
          if (error) throw error;
          toast({ title: "Pulizia Completata", description: "Ticket orfani rimossi." });
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
      } catch(e: any) {
          toast({ title: "Errore", description: e.message, variant: "destructive" });
      } finally {
          setIsProcessing(false);
      }
  };

  const processCSVImport = async () => {
    if (!csvFile) return;
    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const text = e.target?.result as string;
            const rows = text.split('\n').filter(row => row.trim() !== '');
            let importedCount = 0;
            const { data: { user } } = await supabase.auth.getUser();

            for (const row of rows) {
                const cols = row.includes(';') ? row.split(';') : row.split(',');
                if (cols.length < 2) continue;

                const code = cols[0].trim().toUpperCase();
                const title = cols[1].trim();
                const desc = cols[2] ? cols[2].trim() : '';
                const deadlineStr = cols[3] ? cols[3].trim() : null;

                if (title.toLowerCase() === 'titolo' || title.toLowerCase() === 'attività') continue;

                const mapping = PROPERTY_SHORTCUTS.find(s => s.code === code);
                let propId = null;
                if (mapping) {
                    const foundProp = realProperties.find(p => p.nome.toUpperCase().includes(mapping.search));
                    if (foundProp) propId = foundProp.id;
                }

                await supabase.from('tickets').insert({
                    titolo: title,
                    descrizione: desc,
                    priorita: 'media',
                    stato: 'aperto',
                    creato_da: 'manager',
                    user_id: user?.id,
                    property_real_id: propId,
                    scadenza: deadlineStr || null
                });
                importedCount++;
            }

            toast({ title: "Importazione Riuscita", description: `${importedCount} ticket creati.` });
            setIsImportOpen(false);
            setCsvFile(null);
            queryClient.invalidateQueries({ queryKey: ['tickets'] });

        } catch (err: any) {
            toast({ title: "Errore Importazione", description: err.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };
    reader.readAsText(csvFile);
  };

  // --- FINE FUNZIONI AGGIUNTIVE ---

  const handleFileUpload = async (files: File[]) => {
    const uploadedUrls: string[] = [];
    for (const file of files) {
        const fileName = `ticket_doc_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const { error } = await supabase.storage.from('ticket-files').upload(fileName, file);
        if (error) throw error;
        uploadedUrls.push(fileName);
    }
    return uploadedUrls;
  };

  const createTicket = useMutation({
    mutationFn: async (newTicket: typeof formData) => {
      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      let attachments: string[] = [];
      if (uploadFiles.length > 0) {
          attachments = await handleFileUpload(uploadFiles);
      }

      const payload: any = {
        titolo: newTicket.titolo,
        descrizione: newTicket.descrizione,
        priorita: newTicket.priorita,
        user_id: user?.id,
        creato_da: 'manager',
        stato: 'aperto',
        booking_id: newTicket.booking_id === 'none' ? null : newTicket.booking_id,
        assigned_to: newTicket.assigned_to,
        attachments: attachments,
        scadenza: newTicket.scadenza || null // Campo scadenza aggiunto
      };

      if (targetType === 'real') {
          payload.property_real_id = newTicket.target_id;
          payload.property_mobile_id = null;
      } else {
          payload.property_real_id = null;
          payload.property_mobile_id = newTicket.target_id;
      }
      
      const { error } = await supabase.from('tickets').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsDialogOpen(false);
      setFormData({ titolo: '', descrizione: '', priorita: 'media', target_id: '', booking_id: 'none', assigned_to: [], scadenza: '' });
      setUploadFiles([]);
      setIsUploading(false);
      toast({ title: "Ticket creato", description: "Assegnato al team e file caricati." });
    },
    onError: (err: any) => {
        setIsUploading(false);
        toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  });

  const reopenTicket = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tickets')
        .update({ stato: 'aperto', cost: null, resolution_photo_url: null, quote_status: 'none' }) 
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: "Ticket Riaperto" });
    }
  });

  const openFile = async (path: string) => {
      if(!path) return;
      const bucket = path.startsWith('ticket_doc_') ? 'ticket-files' : 'documents';
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleContactPartner = async (ticket: any, phone: string | null) => {
      if (!phone) {
          toast({ title: "Nessun telefono", description: "Impossibile inviare WhatsApp.", variant: "destructive" });
          return;
      }

      setGeneratingPdfId(ticket.id);
      toast({ title: "Generazione PDF...", description: "Sto preparando la scheda intervento." });

      try {
          const imageUrls = await Promise.all((ticket.attachments || []).map(async (path: string) => {
              const bucket = path.startsWith('ticket_doc_') ? 'ticket-files' : 'documents';
              const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
              return data?.signedUrl;
          }));

          const blob = await pdf(<TicketDocument ticket={ticket} publicUrls={imageUrls.filter(Boolean)} />).toBlob();

          const fileName = `delega_${ticket.id}_${Date.now()}.pdf`;
          const { error: uploadError } = await supabase.storage.from('ticket-files').upload(fileName, blob);
          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from('ticket-files').getPublicUrl(fileName);

          const msg = `Ciao, ti assegno questo intervento: *${ticket.titolo}*\n\n📄 Scarica scheda e foto qui: ${publicUrl}`;
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');

          toast({ title: "Inviato!", description: "WhatsApp aperto con link PDF." });

      } catch (e: any) {
          console.error(e);
          toast({ title: "Errore", description: "Fallita generazione PDF: " + e.message, variant: "destructive" });
      } finally {
          setGeneratingPdfId(null);
      }
  };

  const getPriorityColor = (p: string) => {
    if (p === 'alta' || p === 'critica') return 'bg-red-100 text-red-800 border-red-200';
    if (p === 'media') return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getAssigneesDetails = (ids: string[] | null) => {
    if (!ids || ids.length === 0) return [];
    return ids.map(id => teamMembers.find(m => m.id === id)).filter(Boolean);
  };

  const handleShortcutClick = (shortcut: any) => {
    const found = realProperties.find(p => p.nome.toUpperCase().includes(shortcut.search));
    
    if (found) {
      setTargetType('real'); 
      setFormData({ ...formData, target_id: found.id });
      toast({ title: "Proprietà Selezionata", description: `${found.nome}` });
    } else {
      toast({ title: "Non trovata", description: `Nessuna proprietà corrisponde a "${shortcut.name}"`, variant: "destructive" });
    }
  };

  const filteredTickets = tickets?.filter((t: any) => {
      const isResolved = t.stato === 'risolto';
      if (activeTab === 'open' && isResolved) return false;
      if (activeTab === 'closed' && !isResolved) return false;

      if (filterType === 'real' && !t.property_real_id && !t.bookings?.properties_real) return false;
      if (filterType === 'mobile' && !t.property_mobile_id && !t.properties_mobile) return false;

      return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ticket e Guasti</h1>
          <p className="text-gray-500">Centro di controllo manutenzioni e interventi.</p>
        </div>
        
        <div className="flex gap-2">
            
            {/* BOTTONE PULIZIA ORFANI */}
            {tickets && tickets.some((t:any) => !t.property_real_id && !t.property_mobile_id) && (
                <Button variant="destructive" className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" onClick={deleteOrphans} disabled={isProcessing}>
                    <Trash2 className="w-4 h-4 mr-2"/> Pulisci Non Assegnati
                </Button>
            )}

            {/* BOTTONE IMPORT CSV */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="text-green-700 border-green-200 hover:bg-green-50 shadow-sm">
                        <FileSpreadsheet className="w-4 h-4 mr-2"/> Importa CSV
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Importazione Massiva</DialogTitle>
                        <DialogDescription>CSV: <code className="bg-slate-100 px-1 rounded text-xs">CODICE; TITOLO; DESCRIZIONE; SCADENZA</code></DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
                            <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="cursor-pointer" />
                            <p className="text-xs text-gray-400 mt-2">Formato data: aaaa-mm-gg</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportOpen(false)}>Annulla</Button>
                        <Button onClick={processCSVImport} disabled={!csvFile || isProcessing} className="bg-green-600 hover:bg-green-700">{isProcessing ? 'Importazione...' : 'Avvia'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                  <Plus className="w-4 h-4 mr-2" /> Nuovo Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Nuovo Ticket di Intervento</DialogTitle>
                    <DialogDescription>Crea un ticket, assegna il team e allega foto.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  
                  {/* --- TASTI RAPIDI --- */}
                  <div className="space-y-2 pb-2 border-b">
                    <Label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Info className="w-3 h-3 text-blue-500"/> Selezione Rapida
                    </Label>
                    <div className="flex flex-wrap gap-2">
                        {PROPERTY_SHORTCUTS.map(sc => (
                            <button
                                key={sc.code}
                                type="button"
                                onClick={() => handleShortcutClick(sc)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all hover:scale-105 active:scale-95 ${sc.color} ${formData.target_id && realProperties.find(p => p.id === formData.target_id)?.nome.toUpperCase().includes(sc.search) ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}
                            >
                                {sc.code}
                            </button>
                        ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-center p-1 bg-slate-100 rounded-lg">
                      <button 
                          className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${targetType === 'real' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                          onClick={() => { setTargetType('real'); setFormData({...formData, target_id: ''}); }}
                      >
                          <Home className="w-4 h-4"/> Immobile
                      </button>
                      <button 
                          className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${targetType === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                          onClick={() => { setTargetType('mobile'); setFormData({...formData, target_id: ''}); }}
                      >
                          <Car className="w-4 h-4"/> Veicolo
                      </button>
                  </div>

                  <div className="grid gap-2">
                    <Label>{targetType === 'real' ? 'Seleziona Immobile' : 'Seleziona Veicolo'}</Label>
                    <Select value={formData.target_id} onValueChange={v => setFormData({...formData, target_id: v, booking_id: 'none'})}>
                      <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>
                        {targetType === 'real' 
                            ? realProperties?.map(p => <SelectItem key={p.id} value={p.id}>🏠 {p.nome}</SelectItem>)
                            : mobileProperties?.map(m => <SelectItem key={m.id} value={m.id}>🚗 {m.veicolo} ({m.targa})</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600"/> Assegna al Team</Label>
                    <UserMultiSelect 
                        options={teamMembers} 
                        selected={formData.assigned_to} 
                        onChange={(selected) => setFormData({...formData, assigned_to: selected})} 
                        placeholder="Seleziona operatori..."
                    />
                  </div>

                  {targetType === 'real' && (
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><User className="w-4 h-4 text-green-600"/> Inquilino (Opzionale)</Label>
                        <Select value={formData.booking_id} onValueChange={v => setFormData({...formData, booking_id: v})} disabled={!formData.target_id}>
                          <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Nessuno --</SelectItem>
                            {activeTenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.nome_ospite}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                          <Label>Titolo</Label>
                          <Input value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})} placeholder="Es. Guasto..." />
                      </div>
                      <div className="grid gap-2">
                          <Label>Scadenza (Opzionale)</Label>
                          <Input type="date" value={formData.scadenza} onChange={e => setFormData({...formData, scadenza: e.target.value})} />
                      </div>
                  </div>

                  <div className="grid gap-2">
                        <Label>Priorità</Label>
                        <Select value={formData.priorita} onValueChange={v => setFormData({...formData, priorita: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bassa">Bassa</SelectItem>
                            <SelectItem value="media">Media</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="critica">Critica</SelectItem>
                          </SelectContent>
                        </Select>
                  </div>
                  
                  <div className="grid gap-2"><Label>Descrizione</Label><Textarea value={formData.descrizione} onChange={e => setFormData({...formData, descrizione: e.target.value})} placeholder="Dettagli..." /></div>
                  
                  <div className="grid gap-2">
                      <Label className="flex items-center gap-2"><Paperclip className="w-4 h-4"/> Allegati (Foto/Doc)</Label>
                      <Input type="file" multiple onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} className="text-xs" />
                      {uploadFiles.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                              {uploadFiles.map((f, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px] flex gap-1 items-center">
                                      {f.name} <X className="w-3 h-3 cursor-pointer" onClick={() => setUploadFiles(uploadFiles.filter((_, idx) => idx !== i))}/>
                                  </Badge>
                              ))}
                          </div>
                      )}
                  </div>

                  <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => createTicket.mutate(formData)} disabled={isUploading || !formData.target_id || !formData.titolo}>
                      {isUploading ? 'Caricamento...' : 'Crea Ticket'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      {isError && <div className="bg-red-50 text-red-700 p-4 rounded flex gap-2"><AlertCircle className="w-5 h-5"/> Errore caricamento dati: {(error as any)?.message}</div>}

      <Tabs defaultValue="open" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
                <TabsTrigger value="open">In Corso / Aperti</TabsTrigger>
                <TabsTrigger value="closed">Storico / Chiusi</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                <Button variant={filterType === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('all')} className="text-xs gap-1"><Filter className="w-3 h-3"/> Tutti</Button>
                <Button variant={filterType === 'real' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('real')} className="text-xs gap-1"><Home className="w-3 h-3"/> Immobili</Button>
                <Button variant={filterType === 'mobile' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('mobile')} className="text-xs gap-1"><Car className="w-3 h-3"/> Veicoli</Button>
            </div>
        </div>

        <TabsContent value={activeTab} className="space-y-4">
            <div className="grid gap-4">
                {isLoading ? <p className="text-center py-8 text-gray-500">Caricamento ticket...</p> : filteredTickets?.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 border border-dashed rounded-lg text-gray-500">
                        Nessun ticket in questa sezione.
                    </div>
                ) : filteredTickets?.map((ticket: any) => {
                    const assignees = getAssigneesDetails(ticket.assigned_to);
                    const isGenerating = generatingPdfId === ticket.id;

                    return (
                <Card key={ticket.id} className={`border-l-4 shadow-sm hover:shadow-md transition-all ${ticket.stato === 'risolto' ? 'border-l-green-500 opacity-90 bg-slate-50' : 'border-l-red-500'}`}>
                    <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="flex-1">
                        
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-bold text-lg text-gray-900">{ticket.titolo}</h3>
                            
                            {/* BADGE SCADENZA (NUOVO) */}
                            {ticket.scadenza && (
                                <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-50 text-yellow-800 border-yellow-200">
                                    <Clock className="w-3 h-3"/> Scade: {format(new Date(ticket.scadenza), 'dd MMM')}
                                </Badge>
                            )}

                            <Badge variant="outline" className={getPriorityColor(ticket.priorita)}>{ticket.priorita}</Badge>
                            {ticket.creato_da === 'ospite' && <Badge className="bg-blue-100 text-blue-800 border-blue-200">Ospite</Badge>}
                            {ticket.stato === 'risolto' && <Badge className="bg-green-100 text-green-800 border-green-200">Risolto</Badge>}
                            {ticket.quote_status === 'pending' && <Badge className="bg-orange-100 text-orange-800 border-orange-200">Preventivo</Badge>}
                            
                            {assignees.length > 0 && (
                                <div className="flex -space-x-2 ml-2">
                                    {assignees.map((u: any, i) => (
                                        <div key={i} className="h-6 w-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700 title-tip" title={`Assegnato a: ${u.label}`}>
                                            {u.firstName?.charAt(0)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <p className="text-gray-700 text-sm mb-3">{ticket.descrizione}</p>
                        
                        {ticket.admin_notes && (
                            <div className="mt-2 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-2">
                                <StickyNote className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                                <div className="text-xs text-yellow-900 break-all">
                                    <span className="font-bold block mb-1">Note Staff:</span> 
                                    {renderTextWithLinks(ticket.admin_notes)}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-2">
                            <span className="flex items-center bg-gray-100 px-2 py-1 rounded border"><Calendar className="w-3 h-3 mr-1" /> {format(new Date(ticket.created_at), 'dd MMM')}</span>
                            {ticket.properties_real?.nome && <span className="font-medium text-gray-700 bg-orange-50 px-2 py-1 rounded border border-orange-100">🏠 {ticket.properties_real.nome}</span>}
                            {ticket.properties_mobile && <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">🚗 {ticket.properties_mobile.veicolo}</span>}
                            {ticket.bookings?.nome_ospite && <span className="font-medium text-blue-700">👤 {ticket.bookings.nome_ospite}</span>}
                            {ticket.attachments && ticket.attachments.length > 0 && (
                                <span className="flex items-center text-blue-600"><Paperclip className="w-3 h-3 mr-1"/> {ticket.attachments.length} file</span>
                            )}
                        </div>

                        {/* AZIONI RAPIDE */}
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                            {ticket.supplier_contact && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => window.open(`tel:${ticket.supplier_contact}`)}>
                                    <Phone className="w-3 h-3" /> Fornitore
                                </Button>
                            )}
                            
                            {/* BOTTONE DELEGA SMART (PDF) */}
                            {assignees.length === 1 && (
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    disabled={isGenerating}
                                    className="h-7 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50" 
                                    onClick={() => handleContactPartner(ticket, assignees[0].phone)}
                                >
                                    {isGenerating ? <span className="animate-pulse">Generazione PDF...</span> : <><Share2 className="w-3 h-3" /> Contatta {assignees[0].firstName}</>}
                                </Button>
                            )}

                            {assignees.length > 1 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50">
                                            {isGenerating ? '...' : <><Share2 className="w-3 h-3" /> Contatta Team <ChevronDown className="w-3 h-3 ml-1"/></>}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {assignees.map((u: any) => (
                                            <DropdownMenuItem key={u.id} onClick={() => handleContactPartner(ticket, u.phone)}>
                                                <Share2 className="w-3 h-3 mr-2 text-green-600"/> {u.label}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {(ticket.quote_url || ticket.ricevuta_url) && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                                    onClick={() => openFile(ticket.quote_url || ticket.ricevuta_url)}>
                                    <FileText className="w-3 h-3" /> {ticket.quote_url ? 'Prev.' : 'Ric.'}
                                </Button>
                            )}
                        </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 w-full md:w-auto min-w-[140px]">
                        {ticket.stato !== 'risolto' ? (
                            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => setTicketManagerOpen(ticket)}><UserCog className="w-4 h-4 mr-2" /> Gestisci</Button>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <Button size="sm" variant="outline" className="w-full text-gray-600 bg-white hover:bg-gray-50" onClick={() => setTicketManagerOpen(ticket)}><Eye className="w-3 h-3 mr-2" /> Storico</Button>
                                <Button size="sm" variant="ghost" className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { if(confirm("Riaprire?")) reopenTicket.mutate(ticket.id); }}><RotateCcw className="w-3 h-3 mr-1" /> Riapri</Button>
                            </div>
                        )}
                        </div>
                    </div>
                    </CardContent>
                </Card>
                )})}
            </div>
        </TabsContent>
      </Tabs>

      {ticketManagerOpen && (
        <TicketManager 
            ticket={ticketManagerOpen} 
            isOpen={!!ticketManagerOpen} 
            onClose={() => setTicketManagerOpen(null)}
            onUpdate={() => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); }}
            isReadOnly={ticketManagerOpen.stato === 'risolto'} 
        />
      )}
    </div>
  );
}