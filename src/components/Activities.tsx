import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, Home, Car, Users, Paperclip, X, Filter,
  Share2, ChevronDown, RotateCcw, CalendarDays, Phone, FileText, AlertCircle,
  Clock, CheckCircle2, Wrench, AlertTriangle, ChevronRight, StickyNote
} from 'lucide-react';
import { format, parseISO, isPast, isThisWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';
import { PageHeader } from '@/components/ui/page-header';
import TicketManager from '@/components/TicketManager';
import { UserMultiSelect } from '@/components/UserMultiSelect';
import { pdf } from '@react-pdf/renderer';
import { TicketDocument } from './TicketPDF';
import ActivityCalendar from './ActivityCalendar';
import UnscheduledList from './UnscheduledList';
import ActivityPreviewDialog from './ActivityPreviewDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';

// ─── helpers ────────────────────────────────────────────────────────────────

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800 break-all">{part}</a>
    ) : part
  );
};

const PRIORITY_ORDER: Record<string, number> = { critica: 0, alta: 1, media: 2, bassa: 3 };

const PRIORITY_META: Record<string, { bar: string; badge: string; label: string }> = {
  critica: { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-800 border-red-200',       label: 'Critica' },
  alta:    { bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Alta' },
  media:   { bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Media' },
  bassa:   { bar: 'bg-green-400',  badge: 'bg-green-100 text-green-800 border-green-200',  label: 'Bassa' },
};

function sortByPriorityThenDate(tickets: any[]) {
  return [...tickets].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priorita] ?? 99;
    const pb = PRIORITY_ORDER[b.priorita] ?? 99;
    if (pa !== pb) return pa - pb;
    // tickets senza data in fondo, poi ordine cronologico
    if (!a.data_scadenza && !b.data_scadenza) return 0;
    if (!a.data_scadenza) return 1;
    if (!b.data_scadenza) return -1;
    return new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime();
  });
}

// ─── TicketRow ───────────────────────────────────────────────────────────────

function TicketRow({
  ticket, teamMembers, generatingPdfId,
  onPreview, onManage, onReopen, onContactPartner, onOpenFile
}: {
  ticket: any;
  teamMembers: any[];
  generatingPdfId: string | null;
  onPreview: () => void;
  onManage: () => void;
  onReopen?: () => void;
  onContactPartner: (ticket: any, phone: string | null) => void;
  onOpenFile: (path: string) => void;
}) {
  const meta = PRIORITY_META[ticket.priorita] ?? PRIORITY_META.media;
  const isGenerating = generatingPdfId === ticket.id;
  const isResolved = ticket.stato === 'risolto';

  const assignees = (ticket.assigned_to || [])
    .map((id: string) => teamMembers.find(m => m.id === id))
    .filter(Boolean);

  const isOverdue = !isResolved && ticket.data_scadenza && isPast(parseISO(ticket.data_scadenza));

  return (
    <div
      className={`flex gap-0 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden ${isResolved ? 'opacity-80' : ''}`}
      onClick={onPreview}
    >
      {/* Priority bar */}
      <div className={`w-1 shrink-0 ${isResolved ? 'bg-green-400' : meta.bar}`} />

      {/* Body */}
      <div className="flex-1 px-4 py-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-gray-900 truncate max-w-[260px]">{ticket.titolo}</span>

          {!isResolved && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${meta.badge}`}>
              {meta.label}
            </Badge>
          )}
          {isResolved && (
            <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 border border-green-200">
              Risolto
            </Badge>
          )}

          {/* Da Schedulare inline badge */}
          {!ticket.data_scadenza && !isResolved && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">
              Da Schedulare
            </Badge>
          )}

          {/* Overdue badge */}
          {isOverdue && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-700 bg-red-50 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> In Ritardo
            </Badge>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {ticket.properties_real?.nome && (
            <span className="flex items-center gap-1">
              <Home className="w-3 h-3 text-gray-400" /> {ticket.properties_real.nome}
            </span>
          )}
          {ticket.properties_mobile && (
            <span className="flex items-center gap-1">
              <Car className="w-3 h-3 text-gray-400" /> {ticket.properties_mobile.veicolo}
            </span>
          )}
          {ticket.data_scadenza && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
              <CalendarDays className="w-3 h-3" />
              {format(parseISO(ticket.data_scadenza), 'dd MMM yyyy', { locale: it })}
            </span>
          )}
          {ticket.bookings?.nome_ospite && (
            <span>👤 {ticket.bookings.nome_ospite}</span>
          )}
          {ticket.attachments?.length > 0 && (
            <span className="text-blue-500">📎 {ticket.attachments.length}</span>
          )}
        </div>

        {/* Admin notes */}
        {ticket.admin_notes && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-900 flex items-start gap-1.5">
            <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-yellow-600" />
            <span className="break-all">{renderTextWithLinks(ticket.admin_notes)}</span>
          </div>
        )}

        {/* Action buttons (bottom row) */}
        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-gray-100" onClick={e => e.stopPropagation()}>
          {ticket.supplier_contact && (
            <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 px-2"
              onClick={() => window.open(`tel:${ticket.supplier_contact}`)}>
              <Phone className="w-3 h-3" /> Fornitore
            </Button>
          )}
          {assignees.length === 1 && (
            <Button size="sm" variant="outline" disabled={isGenerating}
              className="h-6 text-[11px] gap-1 border-green-200 text-green-700 hover:bg-green-50 px-2"
              onClick={() => onContactPartner(ticket, assignees[0].phone)}>
              {isGenerating ? <span className="animate-pulse">PDF...</span>
                : <><Share2 className="w-3 h-3" /> {assignees[0].firstName}</>}
            </Button>
          )}
          {assignees.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"
                  className="h-6 text-[11px] gap-1 border-green-200 text-green-700 hover:bg-green-50 px-2">
                  {isGenerating ? '...' : <><Share2 className="w-3 h-3" /> Team <ChevronDown className="w-3 h-3" /></>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {assignees.map((u: any) => (
                  <DropdownMenuItem key={u.id} onClick={() => onContactPartner(ticket, u.phone)}>
                    <Share2 className="w-3 h-3 mr-2 text-green-600" /> {u.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {(ticket.quote_url || ticket.ricevuta_url) && (
            <Button size="sm" variant="outline"
              className="h-6 text-[11px] gap-1 border-purple-200 text-purple-700 hover:bg-purple-50 px-2"
              onClick={() => onOpenFile(ticket.quote_url || ticket.ricevuta_url)}>
              <FileText className="w-3 h-3" /> {ticket.quote_url ? 'Prev.' : 'Ric.'}
            </Button>
          )}
          {isResolved && onReopen && (
            <Button size="sm" variant="ghost"
              className="h-6 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
              onClick={() => { if (confirm('Riaprire questo ticket?')) onReopen(); }}>
              <RotateCcw className="w-3 h-3 mr-1" /> Riapri
            </Button>
          )}
        </div>
      </div>

      {/* Assignee avatars + Gestisci */}
      <div className="flex flex-col items-center justify-between py-3 pr-3 gap-2 shrink-0" onClick={e => e.stopPropagation()}>
        {assignees.length > 0 && (
          <div className="flex -space-x-2">
            {assignees.slice(0, 3).map((u: any, i: number) => (
              <div key={i}
                className="h-6 w-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700"
                title={u.label}>
                {u.firstName?.charAt(0) || '?'}
              </div>
            ))}
            {assignees.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-600">
                +{assignees.length - 3}
              </div>
            )}
          </div>
        )}
        <Button size="sm" variant="ghost"
          className="h-7 text-[11px] text-blue-600 hover:bg-blue-50 gap-1 px-2"
          onClick={onManage}>
          Gestisci <ChevronRight className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── KPI Strip ───────────────────────────────────────────────────────────────

function KpiStrip({ tickets }: { tickets: any[] }) {
  const aperti     = tickets.filter(t => t.stato === 'aperto').length;
  const inLav      = tickets.filter(t => t.stato === 'in_lavorazione').length;
  const inRitardo  = tickets.filter(t =>
    t.stato !== 'risolto' && t.data_scadenza && isPast(parseISO(t.data_scadenza))
  ).length;
  const risoltiSettimana = tickets.filter(t =>
    t.stato === 'risolto' && t.updated_at && isThisWeek(new Date(t.updated_at), { weekStartsOn: 1 })
  ).length;

  const kpis = [
    { label: 'Aperti',           value: aperti,           icon: Clock,          color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'In Lavorazione',   value: inLav,            icon: Wrench,         color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'In Ritardo',       value: inRitardo,        icon: AlertTriangle,  color: 'text-red-600',    bg: 'bg-red-50'    },
    { label: 'Risolti / sett.',  value: risoltiSettimana, icon: CheckCircle2,   color: 'text-green-600',  bg: 'bg-green-50'  },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className={`${bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
          <Icon className={`w-5 h-5 ${color} shrink-0`} />
          <div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 leading-tight">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Activities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: realProperties } = usePropertiesReal();

  const [isDialogOpen, setIsDialogOpen]         = useState(false);
  const [previewTicket, setPreviewTicket]         = useState<any>(null);
  const [ticketManagerOpen, setTicketManagerOpen] = useState<any>(null);
  const [showCalendar, setShowCalendar]           = useState(false);
  const [filterType, setFilterType]               = useState('all');
  const [filterProp, setFilterProp]               = useState('all');
  const [activeTab, setActiveTab]                 = useState('aperto');
  const [generatingPdfId, setGeneratingPdfId]     = useState<string | null>(null);

  // form
  const [targetType, setTargetType] = useState<'real' | 'mobile'>('real');
  const [formData, setFormData] = useState({
    titolo: '', descrizione: '', priorita: 'media',
    target_id: '', booking_id: 'none',
    assigned_to: [] as string[], data_scadenza: '',
  });
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, email, phone');
      return data?.map(u => ({
        id: u.id,
        label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Utente',
        phone: u.phone,
        firstName: u.first_name,
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

  // ── filters ────────────────────────────────────────────────────────────────

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((t: any) => {
      if (filterType === 'real'   && !t.property_real_id)   return false;
      if (filterType === 'mobile' && !t.property_mobile_id) return false;
      if (filterProp !== 'all'    && t.property_real_id !== filterProp) return false;
      return true;
    });
  }, [tickets, filterType, filterProp]);

  const tabTickets = useMemo(() => {
    const byState = (stato: string) =>
      sortByPriorityThenDate(filteredTickets.filter((t: any) => t.stato === stato));
    return {
      aperto:        byState('aperto'),
      in_lavorazione: byState('in_lavorazione'),
      risolto:       byState('risolto'),
    };
  }, [filteredTickets]);

  // calendar helpers (keep existing)
  const scheduledTickets   = filteredTickets.filter((t: any) => t.stato !== 'risolto' && t.data_scadenza);
  const unscheduledTickets = filteredTickets.filter((t: any) => t.stato !== 'risolto' && !t.data_scadenza);

  // ── mutations ──────────────────────────────────────────────────────────────

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
      if (uploadFiles.length > 0) attachments = await handleFileUpload(uploadFiles);
      const payload: any = {
        titolo: newTicket.titolo,
        descrizione: newTicket.descrizione,
        priorita: newTicket.priorita,
        user_id: user?.id,
        creato_da: 'manager',
        stato: 'aperto',
        booking_id: newTicket.booking_id === 'none' ? null : newTicket.booking_id,
        assigned_to: newTicket.assigned_to,
        attachments,
        data_scadenza: newTicket.data_scadenza || null,
      };
      if (targetType === 'real') {
        payload.property_real_id  = newTicket.target_id;
        payload.property_mobile_id = null;
      } else {
        payload.property_real_id  = null;
        payload.property_mobile_id = newTicket.target_id;
      }
      const { error } = await supabase.from('tickets').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsDialogOpen(false);
      setFormData({ titolo: '', descrizione: '', priorita: 'media', target_id: '', booking_id: 'none', assigned_to: [], data_scadenza: '' });
      setUploadFiles([]);
      setIsUploading(false);
      toast({ title: 'Attività creata', description: formData.data_scadenza ? 'Aggiunta al calendario.' : 'Aggiunta a "Da Schedulare".' });
    },
    onError: (err: any) => {
      setIsUploading(false);
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  });

  const reopenTicket = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tickets').update({ stato: 'aperto', cost: null, resolution_photo_url: null, quote_status: 'none' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: 'Ticket Riaperto' });
    }
  });

  const openFile = async (path: string) => {
    if (!path) return;
    const bucket = path.startsWith('ticket_doc_') ? 'ticket-files' : 'documents';
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleContactPartner = async (ticket: any, phone: string | null) => {
    if (!phone) {
      toast({ title: 'Nessun telefono', description: 'Impossibile inviare WhatsApp.', variant: 'destructive' });
      return;
    }
    setGeneratingPdfId(ticket.id);
    toast({ title: 'Generazione PDF...', description: 'Sto preparando la scheda intervento.' });
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
      toast({ title: 'Inviato!', description: 'WhatsApp aperto con link PDF.' });
    } catch (e: any) {
      toast({ title: 'Errore', description: 'Fallita generazione PDF: ' + e.message, variant: 'destructive' });
    } finally {
      setGeneratingPdfId(null);
    }
  };

  // ── render helpers ─────────────────────────────────────────────────────────

  const renderTicketList = (list: any[], showReopen = false) => {
    if (list.length === 0) {
      return (
        <div className="text-center py-10 text-gray-400 bg-slate-50 border border-dashed rounded-xl text-sm">
          Nessuna attività qui.
        </div>
      );
    }
    return (
      <div className="space-y-2.5">
        {list.map((t: any) => (
          <TicketRow
            key={t.id}
            ticket={t}
            teamMembers={teamMembers}
            generatingPdfId={generatingPdfId}
            onPreview={() => setPreviewTicket(t)}
            onManage={() => setTicketManagerOpen(t)}
            onReopen={showReopen ? () => reopenTicket.mutate(t.id) : undefined}
            onContactPartner={handleContactPartner}
            onOpenFile={openFile}
          />
        ))}
      </div>
    );
  };

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Header */}
      <PageHeader
        title="Attività"
        count={filteredTickets.filter((t: any) => t.stato !== 'risolto').length}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tipo toggle */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border shadow-sm">
            <Button variant={filterType === 'all'    ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('all')}    className="text-xs gap-1 h-7"><Filter className="w-3 h-3" /> Tutti</Button>
            <Button variant={filterType === 'real'   ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('real')}   className="text-xs gap-1 h-7"><Home className="w-3 h-3" /> Immobili</Button>
            <Button variant={filterType === 'mobile' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('mobile')} className="text-xs gap-1 h-7"><Car  className="w-3 h-3" /> Veicoli</Button>
          </div>

          {/* Proprietà dropdown (solo se real) */}
          {filterType !== 'mobile' && realProperties && realProperties.length > 1 && (
            <Select value={filterProp} onValueChange={setFilterProp}>
              <SelectTrigger className="h-9 text-xs w-40 bg-white border shadow-sm">
                <SelectValue placeholder="Proprietà..." />
              </SelectTrigger>
              <SelectContent className="max-h-52 overflow-y-auto">
                <SelectItem value="all">Tutte le proprietà</SelectItem>
                {realProperties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Calendar toggle */}
          <Button
            variant={showCalendar ? 'secondary' : 'outline'}
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={() => setShowCalendar(v => !v)}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Calendario
          </Button>

          {/* New ticket */}
          <Button size="sm" className="gap-1.5 h-9" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4" /> Nuova Attività
          </Button>
        </div>
      </PageHeader>

      {/* Error */}
      {isError && (
        <div className="bg-red-50 text-red-700 p-4 rounded flex gap-2">
          <AlertCircle className="w-5 h-5" /> Errore: {(error as any)?.message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Caricamento attività...</div>
      ) : showCalendar ? (
        /* ── CALENDARIO (secondary) ── */
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-600">Vista Calendario</h2>
            <Button variant="ghost" size="sm" className="text-xs text-gray-500" onClick={() => setShowCalendar(false)}>
              ← Torna alla lista
            </Button>
          </div>
          <ActivityCalendar
            tickets={scheduledTickets}
            onTicketClick={(t) => setPreviewTicket(t)}
            onDayClick={(date) => {
              const iso = date.toISOString().split('T')[0];
              setFormData(f => ({ ...f, data_scadenza: iso }));
              setIsDialogOpen(true);
            }}
          />
          <UnscheduledList
            tickets={unscheduledTickets}
            onTicketClick={(t) => setPreviewTicket(t)}
          />
        </div>
      ) : (
        /* ── LISTA PRINCIPALE ── */
        <div className="space-y-5">
          {/* KPI strip */}
          <KpiStrip tickets={filteredTickets} />

          {/* 3-tab list */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white border shadow-sm">
              <TabsTrigger value="aperto" className="text-xs gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Da Fare
                {tabTickets.aperto.length > 0 && (
                  <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border border-blue-200">
                    {tabTickets.aperto.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="in_lavorazione" className="text-xs gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                In Corso
                {tabTickets.in_lavorazione.length > 0 && (
                  <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border border-orange-200">
                    {tabTickets.in_lavorazione.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="risolto" className="text-xs gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Risolti
                {tabTickets.risolto.length > 0 && (
                  <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border border-green-200">
                    {tabTickets.risolto.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="aperto"         className="mt-4">{renderTicketList(tabTickets.aperto)}</TabsContent>
            <TabsContent value="in_lavorazione" className="mt-4">{renderTicketList(tabTickets.in_lavorazione)}</TabsContent>
            <TabsContent value="risolto"        className="mt-4">{renderTicketList(tabTickets.risolto, true)}</TabsContent>
          </Tabs>
        </div>
      )}

      {/* ── Sheet: Nuova Attività ── */}
      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent side="bottom" className="h-[92svh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Nuova Attività</SheetTitle>
            <SheetDescription>Lascia "Data prevista" vuoto → andrà in "Da Schedulare".</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-2">

            {/* Immobile / Veicolo */}
            <div className="flex items-center justify-center p-1 bg-slate-100 rounded-lg">
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${targetType === 'real' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                onClick={() => { setTargetType('real'); setFormData({ ...formData, target_id: '' }); }}
              >
                <Home className="w-4 h-4" /> Immobile
              </button>
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${targetType === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                onClick={() => { setTargetType('mobile'); setFormData({ ...formData, target_id: '' }); }}
              >
                <Car className="w-4 h-4" /> Veicolo
              </button>
            </div>

            <div className="grid gap-2">
              <Label>{targetType === 'real' ? 'Seleziona Immobile' : 'Seleziona Veicolo'}</Label>
              <Select value={formData.target_id} onValueChange={v => setFormData({ ...formData, target_id: v, booking_id: 'none' })}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {targetType === 'real'
                    ? realProperties?.map(p => <SelectItem key={p.id} value={p.id}>🏠 {p.nome}</SelectItem>)
                    : mobileProperties?.map(m => <SelectItem key={m.id} value={m.id}>🚗 {m.veicolo} ({m.targa})</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /> Assegna al Team</Label>
              <UserMultiSelect
                options={teamMembers}
                selected={formData.assigned_to}
                onChange={(selected) => setFormData({ ...formData, assigned_to: selected })}
                placeholder="Seleziona operatori..."
              />
            </div>

            {targetType === 'real' && (
              <div className="grid gap-2">
                <Label>Inquilino (Opzionale)</Label>
                <Select value={formData.booking_id} onValueChange={v => setFormData({ ...formData, booking_id: v })} disabled={!formData.target_id}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent className="max-h-48 overflow-y-auto">
                    <SelectItem value="none">-- Nessuno --</SelectItem>
                    {activeTenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.nome_ospite}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Titolo</Label>
                <Input value={formData.titolo} onChange={e => setFormData({ ...formData, titolo: e.target.value })} placeholder="Es. Guasto caldaia..." />
              </div>
              <div className="grid gap-2">
                <Label>Priorità</Label>
                <Select value={formData.priorita} onValueChange={v => setFormData({ ...formData, priorita: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-48 overflow-y-auto">
                    <SelectItem value="bassa">Bassa</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Critica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                📅 Data prevista <span className="text-xs text-slate-400 font-normal">(opzionale)</span>
              </Label>
              <Input type="date" value={formData.data_scadenza}
                onChange={e => setFormData({ ...formData, data_scadenza: e.target.value })} />
              {formData.data_scadenza
                ? <p className="text-xs text-blue-600">✓ Apparirà nel calendario</p>
                : <p className="text-xs text-amber-600">→ Andrà in "Da Schedulare"</p>
              }
            </div>

            <div className="grid gap-2">
              <Label>Descrizione</Label>
              <Textarea value={formData.descrizione}
                onChange={e => setFormData({ ...formData, descrizione: e.target.value })}
                placeholder="Dettagli intervento..." />
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Paperclip className="w-4 h-4" /> Allegati</Label>
              <Input type="file" multiple onChange={e => setUploadFiles(Array.from(e.target.files || []))} className="text-xs" />
              {uploadFiles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {uploadFiles.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] flex gap-1 items-center">
                      {f.name}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => setUploadFiles(uploadFiles.filter((_, idx) => idx !== i))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => createTicket.mutate(formData)}
              disabled={isUploading || !formData.target_id || !formData.titolo}>
              {isUploading ? 'Caricamento...' : 'Crea Attività'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <ActivityPreviewDialog
        ticket={previewTicket}
        isOpen={!!previewTicket}
        onClose={() => setPreviewTicket(null)}
        onManage={() => { setTicketManagerOpen(previewTicket); setPreviewTicket(null); }}
      />

      {ticketManagerOpen && (
        <TicketManager
          ticket={ticketManagerOpen}
          isOpen={!!ticketManagerOpen}
          onClose={() => setTicketManagerOpen(null)}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
          isReadOnly={ticketManagerOpen.stato === 'risolto'}
        />
      )}
    </div>
  );
}
