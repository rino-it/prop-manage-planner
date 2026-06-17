import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useConti } from '@/hooks/useConti';

export function ContoDialog({ open, onOpenChange, gestioneId, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; gestioneId: string; editing?: any;
}) {
  const { createConto, updateConto, deleteConto } = useConti();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ nome: '', tipo: 'banca', saldo_iniziale: '', data_apertura: format(new Date(), 'yyyy-MM-dd') });
  useEffect(() => {
    if (editing) setForm({ nome: editing.nome, tipo: editing.tipo, saldo_iniziale: String(editing.saldo_iniziale), data_apertura: editing.data_apertura });
    else setForm({ nome: '', tipo: 'banca', saldo_iniziale: '', data_apertura: format(new Date(), 'yyyy-MM-dd') });
  }, [editing, open]);

  const save = async () => {
    const payload = { gestione_id: gestioneId, nome: form.nome, tipo: form.tipo, saldo_iniziale: parseFloat(form.saldo_iniziale || '0'), data_apertura: form.data_apertura };
    if (editing) await updateConto.mutateAsync({ id: editing.id, ...payload });
    else await createConto.mutateAsync(payload);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!editing) return;
    await deleteConto.mutateAsync(editing.id);
    setConfirmDelete(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{editing ? 'Modifica conto' : 'Nuovo conto'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5"><Label>Nome</Label>
            <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Es. Conto Intesa" /></div>
          <div className="grid gap-1.5"><Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="contanti">💵 Contanti</SelectItem><SelectItem value="banca">🏦 Banca</SelectItem></SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Saldo iniziale (€)</Label>
              <Input type="number" value={form.saldo_iniziale} onChange={e => setForm(f => ({ ...f, saldo_iniziale: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Data apertura</Label>
              <Input type="date" value={form.data_apertura} onChange={e => setForm(f => ({ ...f, data_apertura: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter className={editing ? 'sm:justify-between' : undefined}>
          {editing && (
            <Button
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4" />Elimina
            </Button>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button onClick={save} disabled={!form.nome}>Salva</Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il conto «{editing?.nome}»?</AlertDialogTitle>
            <AlertDialogDescription>
              I movimenti assegnati a questo conto torneranno tra quelli «senza conto»,
              così potrai riassegnarli. I giroconti collegati verranno eliminati.
              L'operazione non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleteConto.isPending}
            >
              {deleteConto.isPending ? 'Eliminazione…' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
