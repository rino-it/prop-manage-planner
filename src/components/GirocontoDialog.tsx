import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { useGiroconti } from '@/hooks/useGiroconti';

export function GirocontoDialog({ open, onOpenChange, conti }: {
  open: boolean; onOpenChange: (o: boolean) => void; conti: any[];
}) {
  const { createGiroconto } = useGiroconti();
  const [form, setForm] = useState({ conto_from: '', conto_to: '', importo: '', data: format(new Date(), 'yyyy-MM-dd'), descrizione: '' });
  const save = async () => {
    await createGiroconto.mutateAsync({ conto_from: form.conto_from, conto_to: form.conto_to, importo: parseFloat(form.importo), data: form.data, descrizione: form.descrizione });
    onOpenChange(false);
    setForm({ conto_from: '', conto_to: '', importo: '', data: format(new Date(), 'yyyy-MM-dd'), descrizione: '' });
  };
  const valid = form.conto_from && form.conto_to && form.conto_from !== form.conto_to && parseFloat(form.importo) > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Giroconto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5"><Label>Da conto</Label>
            <Select value={form.conto_from} onValueChange={v => setForm(f => ({ ...f, conto_from: v }))}>
              <SelectTrigger><SelectValue placeholder="Conto di partenza" /></SelectTrigger>
              <SelectContent>{conti.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid gap-1.5"><Label>A conto</Label>
            <Select value={form.conto_to} onValueChange={v => setForm(f => ({ ...f, conto_to: v }))}>
              <SelectTrigger><SelectValue placeholder="Conto di destinazione" /></SelectTrigger>
              <SelectContent>{conti.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Importo (€)</Label>
              <Input type="number" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Nota</Label>
            <Input value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={save} disabled={!valid}>Registra giroconto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
