import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Globe, Plus, RefreshCw, Trash2, ExternalLink, AlertCircle,
  CheckCircle2, XCircle, Clock, Loader2, Calendar as CalendarIcon, ClipboardCheck
} from 'lucide-react';
import PortalCalendarDialog from '@/components/PortalCalendarDialog';
import SyncReviewDialog from '@/components/SyncReviewDialog';
import UnifiedCalendar from '@/components/UnifiedCalendar';
import { useSyncReview } from '@/hooks/useSyncReview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { usePortalConnections, type CreateConnectionPayload } from '@/hooks/usePortalConnections';

const PORTAL_OPTIONS = [
  { value: 'airbnb', label: 'Airbnb', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'booking', label: 'Booking.com', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'vrbo', label: 'VRBO', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'other', label: 'Altro', color: 'bg-slate-100 text-slate-700 border-slate-200' },
];

function portalColor(name: string): string {
  return PORTAL_OPTIONS.find(p => p.value === name)?.color || 'bg-slate-100 text-slate-700 border-slate-200';
}

function portalLabel(name: string): string {
  return PORTAL_OPTIONS.find(p => p.value === name)?.label || name;
}

function statusIcon(status: string) {
  if (status === 'active') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
  return <Clock className="w-4 h-4 text-slate-400" />;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Mai sincronizzato';
  const d = new Date(iso);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PortalConnections() {
  const { toast } = useToast();
  const {
    connections, isLoading,
    createConnection, updateConnection, deleteConnection,
    syncConnection, syncAll
  } = usePortalConnections();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);

  const { pendingCount } = useSyncReview();
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const [calendarTarget, setCalendarTarget] = useState<{
    propertyId: string;
    propertyName: string;
    portalName: string;
    portalSource: string;
  } | null>(null);

  const [formPropertyId, setFormPropertyId] = useState('');
  const [formPortalName, setFormPortalName] = useState('');
  const [formIcalUrl, setFormIcalUrl] = useState('');

  const { data: properties } = useQuery({
    queryKey: ['properties-for-portals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties_real')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const resetForm = () => {
    setFormPropertyId('');
    setFormPortalName('');
    setFormIcalUrl('');
  };

  const handleAdd = () => {
    if (!formPropertyId || !formPortalName || !formIcalUrl) {
      toast({ title: 'Compila tutti i campi', variant: 'destructive' });
      return;
    }
    const payload: CreateConnectionPayload = {
      property_id: formPropertyId,
      portal_name: formPortalName,
      connection_type: 'ical',
      ical_url: formIcalUrl,
    };
    createConnection.mutate(payload, {
      onSuccess: () => {
        toast({ title: 'Connessione creata' });
        setIsAddOpen(false);
        resetForm();
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Errore';
        if (msg.includes('duplicate') || msg.includes('unique')) {
          toast({ title: 'Connessione duplicata', description: 'Questa proprieta ha gia una connessione a questo portale.', variant: 'destructive' });
        } else {
          toast({ title: 'Errore', description: msg, variant: 'destructive' });
        }
      },
    });
  };

  const handleEdit = () => {
    if (!editTarget || !formIcalUrl) return;
    updateConnection.mutate(
      { id: editTarget, ical_url: formIcalUrl, status: 'active' },
      {
        onSuccess: () => {
          toast({ title: 'Connessione aggiornata' });
          setIsEditOpen(false);
          setEditTarget(null);
          resetForm();
        },
        onError: (err) => toast({ title: 'Errore', description: err instanceof Error ? err.message : 'Errore', variant: 'destructive' }),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteConnection.mutate(deleteTarget, {
      onSuccess: () => {
        toast({ title: 'Connessione rimossa' });
        setDeleteTarget(null);
      },
      onError: (err) => toast({ title: 'Errore', description: err instanceof Error ? err.message : 'Errore', variant: 'destructive' }),
    });
  };

  const handleSync = (connectionId: string) => {
    syncConnection.mutate(connectionId, {
      onSuccess: (data) => {
        const totalStaged = data?.total_staged || 0;
        if (totalStaged > 0) {
          toast({ title: `Sync completata: ${totalStaged} da revisionare` });
          setIsReviewOpen(true);
        } else {
          toast({ title: 'Sync completata: nessuna novita' });
        }
      },
      onError: (err) => toast({ title: 'Sync fallita', description: err instanceof Error ? err.message : 'Errore', variant: 'destructive' }),
    });
  };

  const handleSyncAll = () => {
    syncAll.mutate(undefined, {
      onSuccess: (data) => {
        const totalStaged = data?.total_staged || 0;
        if (totalStaged > 0) {
          toast({ title: `Sync globale: ${totalStaged} da revisionare` });
          setIsReviewOpen(true);
        } else {
          toast({ title: 'Sync globale completata: nessuna novita' });
        }
      },
      onError: (err) => toast({ title: 'Sync fallita', description: err instanceof Error ? err.message : 'Errore', variant: 'destructive' }),
    });
  };

  const openEdit = (conn: (typeof connections)[0]) => {
    setEditTarget(conn.id);
    setFormIcalUrl(conn.ical_url || '');
    setIsEditOpen(true);
  };

  const activeCount = connections.filter(c => c.status === 'active').length;
  const errorCount = connections.filter(c => c.status === 'error').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portali di Prenotazione</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestisci le connessioni iCal con Airbnb, Booking.com e altri portali.
          </p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReviewOpen(true)}
              className="relative"
            >
              <ClipboardCheck className="w-4 h-4 mr-1.5" />
              Revisione
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px] min-w-[18px] h-[18px]">
                {pendingCount}
              </Badge>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncAll.isPending || connections.length === 0}
          >
            {syncAll.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            Sincronizza tutto
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setIsAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-1.5" />
            Nuova connessione
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 text-blue-600"><Globe className="w-5 h-5" /></div>
              <div>
                <p className="text-2xl font-bold">{connections.length}</p>
                <p className="text-xs text-muted-foreground">Connessioni totali</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 text-green-600"><CheckCircle2 className="w-5 h-5" /></div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Attive</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 text-red-600"><AlertCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-2xl font-bold">{errorCount}</p>
                <p className="text-xs text-muted-foreground">In errore</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <UnifiedCalendar embedded />

      {connections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Nessun portale connesso</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Connetti i tuoi calendari iCal da Airbnb, Booking.com o altri portali per importare le prenotazioni automaticamente.
            </p>
            <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" />
              Aggiungi connessione
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <Card key={conn.id} className={conn.status === 'error' ? 'border-red-200' : ''}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {statusIcon(conn.status)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{conn.properties_real?.nome || 'Proprieta'}</span>
                        <Badge variant="outline" className={`text-[10px] ${portalColor(conn.portal_name)}`}>
                          {portalLabel(conn.portal_name)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">iCal</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                        <span>Ultima sync: {formatDate(conn.last_sync)}</span>
                        {conn.last_sync_result?.events_imported !== undefined && (
                          <span className="text-green-600">+{conn.last_sync_result.events_imported} importate</span>
                        )}
                        {conn.last_sync_result?.errors && conn.last_sync_result.errors.length > 0 && (
                          <span className="text-red-500">{conn.last_sync_result.errors[0]}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCalendarTarget({
                        propertyId: conn.property_id,
                        propertyName: conn.properties_real?.nome || 'Proprieta',
                        portalName: conn.portal_name,
                        portalSource: `${conn.portal_name}_ical`,
                      })}
                      title="Calendario prenotazioni"
                    >
                      <CalendarIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSync(conn.id)}
                      disabled={syncConnection.isPending}
                      title="Sincronizza"
                    >
                      {syncConnection.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(conn)} title="Modifica">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(conn.id)} title="Rimuovi">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova connessione portale</DialogTitle>
            <DialogDescription>Inserisci l'URL del calendario iCal del portale di prenotazione.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Proprieta</Label>
              <Select value={formPropertyId} onValueChange={setFormPropertyId}>
                <SelectTrigger><SelectValue placeholder="Seleziona proprieta" /></SelectTrigger>
                <SelectContent>
                  {(properties || []).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Portale</Label>
              <Select value={formPortalName} onValueChange={setFormPortalName}>
                <SelectTrigger><SelectValue placeholder="Seleziona portale" /></SelectTrigger>
                <SelectContent>
                  {PORTAL_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>URL calendario iCal</Label>
              <Input
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={formIcalUrl}
                onChange={(e) => setFormIcalUrl(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Trovi questo URL nelle impostazioni del calendario del portale.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Annulla</Button>
            <Button onClick={handleAdd} disabled={createConnection.isPending}>
              {createConnection.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Connetti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica connessione</DialogTitle>
            <DialogDescription>Aggiorna l'URL iCal per questa connessione.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>URL calendario iCal</Label>
              <Input
                placeholder="https://..."
                value={formIcalUrl}
                onChange={(e) => setFormIcalUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditTarget(null); }}>Annulla</Button>
            <Button onClick={handleEdit} disabled={updateConnection.isPending}>
              {updateConnection.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere questa connessione?</AlertDialogTitle>
            <AlertDialogDescription>
              Le prenotazioni gia importate non verranno eliminate, ma la sincronizzazione si interrompera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Rimuovi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {calendarTarget && (
        <PortalCalendarDialog
          open={!!calendarTarget}
          onOpenChange={(open) => !open && setCalendarTarget(null)}
          propertyId={calendarTarget.propertyId}
          propertyName={calendarTarget.propertyName}
          portalName={calendarTarget.portalName}
          portalSource={calendarTarget.portalSource}
        />
      )}

      <SyncReviewDialog
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
      />
    </div>
  );
}
