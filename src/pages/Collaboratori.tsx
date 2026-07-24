import React, { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Plus, Pencil, Phone, ChevronDown, KeyRound, AlertTriangle, History,
} from 'lucide-react';
import { useCollaboratori, type Collaboratore, type Condizione, type Compenso } from '@/hooks/useCollaboratori';
import { usePropertiesReal } from '@/hooks/useProperties';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const fmt = (n: number) =>
  '€' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'dd/MM/yyyy'); } catch { return iso; }
}

const TIPO_LABEL: Record<string, string> = {
  checkin: 'Check-in',
  pulizia: 'Pulizia',
  mensile: 'Mensile',
};

// ─── Dialog nuovo/modifica collaboratore ──────────────────────────────────────
function CollaboratoreDialog({
  open, editing, onClose, onSave,
}: {
  open: boolean;
  editing: Collaboratore | null;
  onClose: () => void;
  onSave: (values: { nome: string; telefono: string | null; note: string | null; attivo?: boolean }) => void;
}) {
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [note, setNote] = useState('');
  const [attivo, setAttivo] = useState(true);

  useEffect(() => {
    if (open) {
      setNome(editing?.nome ?? '');
      setTelefono(editing?.telefono ?? '');
      setNote(editing?.note ?? '');
      setAttivo(editing?.attivo ?? true);
    }
  }, [open, editing]);

  const handleSave = () => {
    if (!nome.trim()) return;
    onSave({
      nome: nome.trim(),
      telefono: telefono.trim() || null,
      note: note.trim() || null,
      ...(editing ? { attivo } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifica collaboratore' : 'Nuovo collaboratore'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Aggiorna i dati del collaboratore.' : 'Keyholder o addetto alle pulizie.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div className="grid gap-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Es. Maria Rossi" />
          </div>
          <div className="grid gap-1.5">
            <Label>Telefono</Label>
            <Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Es. 333 1234567" />
          </div>
          <div className="grid gap-1.5">
            <Label>Note</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} />
          </div>
          {editing && (
            <div className="flex items-center justify-between">
              <Label>Attivo</Label>
              <Switch checked={attivo} onCheckedChange={setAttivo} />
            </div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={!nome.trim()}>Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog nuova condizione ──────────────────────────────────────────────────
function CondizioneDialog({
  open, onClose, onSave, properties,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (values: { property_id: string | null; tipo: string; importo: number }) => void;
  properties: Array<{ id: string; nome: string }>;
}) {
  const [tipo, setTipo] = useState('checkin');
  const [propertyId, setPropertyId] = useState('');
  const [importo, setImporto] = useState('');

  useEffect(() => {
    if (open) { setTipo('checkin'); setPropertyId(''); setImporto(''); }
  }, [open]);

  const importoNum = parseFloat(importo.replace(',', '.'));
  const valid = importoNum > 0 && (tipo === 'mensile' || !!propertyId);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuova condizione</DialogTitle>
          <DialogDescription>
            Compenso automatico per prenotazione, o importo fisso mensile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="checkin">Check-in (per prenotazione)</SelectItem>
                <SelectItem value="pulizia">Pulizia (per prenotazione)</SelectItem>
                <SelectItem value="mensile">Mensile (generale)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo !== 'mensile' && (
            <div className="grid gap-1.5">
              <Label>Proprietà</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger><SelectValue placeholder="Seleziona proprietà…" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Importo (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={importo}
              onChange={e => setImporto(e.target.value)}
              placeholder="Es. 25"
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button
            onClick={() => onSave({
              property_id: tipo === 'mensile' ? null : propertyId,
              tipo,
              importo: importoNum,
            })}
            disabled={!valid}
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card collaboratore ───────────────────────────────────────────────────────
function CollaboratoreCard({
  collaboratore, condizioni, compensi, onEdit, onAddCondizione, onToggleCondizione,
}: {
  collaboratore: Collaboratore;
  condizioni: Condizione[];
  compensi: Compenso[];
  onEdit: () => void;
  onAddCondizione: () => void;
  onToggleCondizione: (id: string, attivo: boolean) => void;
}) {
  const [storicoOpen, setStoricoOpen] = useState(false);

  const maturato = compensi.reduce((s, c) => s + Number(c.importo), 0);
  const pagato = compensi.filter(c => c.stato === 'pagato').reduce((s, c) => s + Number(c.importo), 0);
  const daPagare = maturato - pagato;

  return (
    <Card className={!collaboratore.attivo ? 'opacity-60' : undefined}>
      <CardContent className="p-0">
        {/* Testata */}
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b bg-slate-50">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-foreground truncate">{collaboratore.nome}</span>
              {!collaboratore.attivo && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                  Non attivo
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[12px] text-muted-foreground">
              {collaboratore.telefono && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />{collaboratore.telefono}
                </span>
              )}
              {collaboratore.note && <span className="truncate">{collaboratore.note}</span>}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={onEdit}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-3 divide-x border-b">
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Maturato</p>
            <p className="font-display text-lg font-bold tabular-nums">{fmt(maturato)}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pagato</p>
            <p className="font-display text-lg font-bold tabular-nums text-green-600">{fmt(pagato)}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Da pagare</p>
            <p className={`font-display text-lg font-bold tabular-nums ${daPagare > 0 ? 'text-amber-600' : ''}`}>
              {fmt(daPagare)}
            </p>
          </div>
        </div>

        {/* Condizioni */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Condizioni</span>
            <Button size="sm" variant="outline" className="h-7" onClick={onAddCondizione}>
              <Plus className="w-3.5 h-3.5 mr-1" />Condizione
            </Button>
          </div>
          {condizioni.length === 0 ? (
            <p className="text-sm text-slate-400">Nessuna condizione. Aggiungine una per generare i compensi.</p>
          ) : (
            <div className="space-y-1.5">
              {condizioni.map(cond => (
                <div key={cond.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {cond.tipo === 'mensile'
                      ? 'Generale (mensile)'
                      : (cond.properties_real?.nome || 'Proprietà')}
                    <span className="text-muted-foreground"> · {TIPO_LABEL[cond.tipo] || cond.tipo}</span>
                  </span>
                  <span className="font-medium tabular-nums shrink-0">{fmt(Number(cond.importo))}</span>
                  <Switch
                    checked={cond.attivo}
                    onCheckedChange={v => onToggleCondizione(cond.id, v)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storico voci */}
        <Collapsible open={storicoOpen} onOpenChange={setStoricoOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <span className="inline-flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Storico voci ({compensi.length})
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${storicoOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {compensi.length === 0 ? (
              <p className="px-4 pb-3 text-sm text-slate-400">Nessuna voce generata.</p>
            ) : (
              <div className="px-4 pb-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b">
                      <th className="py-1.5 pr-2 font-semibold">Data</th>
                      <th className="py-1.5 pr-2 font-semibold">Descrizione</th>
                      <th className="py-1.5 pr-2 font-semibold text-right">Importo</th>
                      <th className="py-1.5 font-semibold text-right">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compensi.map(c => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-2 whitespace-nowrap tabular-nums">
                          {fmtDate(c.stato === 'pagato' ? (c.data_pagamento || c.scadenza) : c.scadenza)}
                        </td>
                        <td className="py-1.5 pr-2 max-w-[220px] truncate" title={c.descrizione}>
                          {c.descrizione}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-medium tabular-nums whitespace-nowrap">
                          {fmt(Number(c.importo))}
                        </td>
                        <td className="py-1.5 text-right">
                          {c.stato === 'pagato' ? (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 border border-green-100 text-green-700">
                              Pagato
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700">
                              Da pagare
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ─── Pagina ───────────────────────────────────────────────────────────────────
export default function Collaboratori() {
  const {
    collaboratori, condizioni, compensi, isLoading, ready,
    addCollaboratore, updateCollaboratore, addCondizione, toggleCondizione, ensureMensili,
  } = useCollaboratori();
  const { data: properties = [] } = usePropertiesReal();

  const [collabDialog, setCollabDialog] = useState<{ open: boolean; editing: Collaboratore | null }>({
    open: false, editing: null,
  });
  const [condDialog, setCondDialog] = useState<{ open: boolean; collaboratoreId: string }>({
    open: false, collaboratoreId: '',
  });

  // Genera i compensi mensili mancanti una sola volta al mount, quando la
  // migrazione è presente.
  const ensured = useRef(false);
  useEffect(() => {
    if (ready && !ensured.current) {
      ensured.current = true;
      ensureMensili.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (isLoading && !ready) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <PageHeader title="Collaboratori" />
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <PageHeader title="Collaboratori" />
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Modulo non ancora attivo</p>
              <p className="mt-1">
                Esegui la migrazione{' '}
                <code className="font-mono text-[12px] bg-amber-100 px-1 py-0.5 rounded">
                  supabase/migrations/20260724_collaboratori.sql
                </code>{' '}
                nel SQL Editor di Supabase, poi ricarica la pagina.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <PageHeader title="Collaboratori" count={collaboratori.length}>
        <Button onClick={() => setCollabDialog({ open: true, editing: null })}>
          <Plus className="w-4 h-4 mr-1.5" />Nuovo collaboratore
        </Button>
      </PageHeader>

      {collaboratori.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <KeyRound className="w-8 h-8 mx-auto text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              Nessun collaboratore. Aggiungi keyholder e addetti alle pulizie: i compensi
              verranno generati automaticamente dalle prenotazioni.
            </p>
            <Button className="mt-4" onClick={() => setCollabDialog({ open: true, editing: null })}>
              <Plus className="w-4 h-4 mr-1.5" />Nuovo collaboratore
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {collaboratori.map(col => (
            <CollaboratoreCard
              key={col.id}
              collaboratore={col}
              condizioni={condizioni.filter(c => c.collaboratore_id === col.id)}
              compensi={compensi.filter(c => c.collaboratore_id === col.id)}
              onEdit={() => setCollabDialog({ open: true, editing: col })}
              onAddCondizione={() => setCondDialog({ open: true, collaboratoreId: col.id })}
              onToggleCondizione={(id, attivo) => toggleCondizione.mutate({ id, attivo })}
            />
          ))}
        </div>
      )}

      <CollaboratoreDialog
        open={collabDialog.open}
        editing={collabDialog.editing}
        onClose={() => setCollabDialog({ open: false, editing: null })}
        onSave={values => {
          if (collabDialog.editing) {
            updateCollaboratore.mutate({ id: collabDialog.editing.id, ...values });
          } else {
            addCollaboratore.mutate(values);
          }
          setCollabDialog({ open: false, editing: null });
        }}
      />
      <CondizioneDialog
        open={condDialog.open}
        onClose={() => setCondDialog({ open: false, collaboratoreId: '' })}
        onSave={values => {
          addCondizione.mutate({ collaboratore_id: condDialog.collaboratoreId, ...values });
          setCondDialog({ open: false, collaboratoreId: '' });
        }}
        properties={(properties as any[]).map(p => ({ id: p.id, nome: p.nome }))}
      />
    </div>
  );
}
