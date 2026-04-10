import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Lock, Zap, Plus } from 'lucide-react';
import { useAddTenantPayment } from '@/hooks/useStripePayments';
import { format } from 'date-fns';

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  bookingName?: string;
}

const TIPI_PAGAMENTO = [
  { value: 'cauzione', label: '🔒 Cauzione (pre-autorizzazione)', preauth: true },
  { value: 'tassa_soggiorno', label: '🏙️ Tassa di soggiorno', preauth: false },
  { value: 'biancheria', label: '🛏️ Kit biancheria', preauth: false },
  { value: 'pulizie', label: '🧹 Pulizie extra', preauth: false },
  { value: 'caparra', label: '💰 Caparra', preauth: false },
  { value: 'saldo', label: '✅ Saldo soggiorno', preauth: false },
  { value: 'extra', label: '➕ Extra / Altro', preauth: false },
];

export default function AddPaymentDialog({ open, onOpenChange, bookingId, bookingName }: AddPaymentDialogProps) {
  const { mutate: addPayment, isPending } = useAddTenantPayment();

  const [tipo, setTipo] = useState('');
  const [importo, setImporto] = useState('');
  const [dataScadenza, setDataScadenza] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isPreauth, setIsPreauth] = useState(false);
  const [generateStripe, setGenerateStripe] = useState(true);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const selectedTipo = TIPI_PAGAMENTO.find(t => t.value === tipo);

  const handleTipoChange = (val: string) => {
    setTipo(val);
    const found = TIPI_PAGAMENTO.find(t => t.value === val);
    if (found) setIsPreauth(found.preauth);
  };

  const handleSubmit = () => {
    if (!tipo || !importo || !dataScadenza) return;
    const amount = parseFloat(importo);
    if (isNaN(amount) || amount <= 0) return;

    addPayment({
      booking_id: bookingId,
      tipo,
      importo: amount,
      data_scadenza: dataScadenza,
      is_preauth: isPreauth,
      description: description || undefined,
      notes: notes || undefined,
      generate_stripe: generateStripe,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      }
    });
  };

  const resetForm = () => {
    setTipo('');
    setImporto('');
    setDataScadenza(format(new Date(), 'yyyy-MM-dd'));
    setIsPreauth(false);
    setGenerateStripe(true);
    setDescription('');
    setNotes('');
  };

  const isValid = tipo && importo && parseFloat(importo) > 0 && dataScadenza;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="sm:max-w-[480px] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Aggiungi Pagamento
            {bookingName && (
              <Badge variant="outline" className="text-xs font-normal text-blue-600 border-blue-200 ml-1">
                {bookingName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* TIPO */}
          <div className="space-y-1.5">
            <Label>Tipo di pagamento</Label>
            <Select onValueChange={handleTipoChange} value={tipo}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo..." />
              </SelectTrigger>
              <SelectContent>
                {TIPI_PAGAMENTO.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      {t.label}
                      {t.preauth && <Badge className="text-[9px] bg-blue-100 text-blue-700 ml-1">pre-auth</Badge>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* IMPORTO + DATA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Importo (EUR)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={importo}
                onChange={e => setImporto(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Scadenza</Label>
              <Input
                type="date"
                value={dataScadenza}
                onChange={e => setDataScadenza(e.target.value)}
              />
            </div>
          </div>

          {/* DESCRIZIONE */}
          <div className="space-y-1.5">
            <Label>Descrizione <span className="text-gray-400 font-normal">(visibile all'ospite)</span></Label>
            <Input
              placeholder={tipo === 'cauzione' ? 'Es: Cauzione rimborsabile - soggiorno 11-18 apr' : tipo === 'tassa_soggiorno' ? 'Es: Tassa di soggiorno €2.50 x 5 persone x 7 notti' : 'Es: Kit biancheria 2 letti matrimoniali'}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* NOTE INTERNE */}
          <div className="space-y-1.5">
            <Label>Note interne <span className="text-gray-400 font-normal">(solo per te)</span></Label>
            <Textarea
              placeholder="Note interne opzionali..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* PRE-AUTH TOGGLE */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-slate-50">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Pre-autorizzazione</p>
                <p className="text-xs text-gray-500">La carta viene bloccata ma non addebitata (usa per cauzione)</p>
              </div>
            </div>
            <Switch checked={isPreauth} onCheckedChange={setIsPreauth} />
          </div>

          {/* GENERA STRIPE */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-slate-50">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Genera link Stripe</p>
                <p className="text-xs text-gray-500">L'ospite vedrà subito il pulsante "Paga Ora"</p>
              </div>
            </div>
            <Switch checked={generateStripe} onCheckedChange={setGenerateStripe} />
          </div>

          {/* RIEPILOGO */}
          {isValid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold text-blue-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" /> Riepilogo
              </p>
              <p className="text-blue-700">
                <strong>{selectedTipo?.label}</strong> — <strong>€{parseFloat(importo || '0').toFixed(2)}</strong>
              </p>
              <p className="text-blue-600 text-xs">
                Scadenza: {dataScadenza} &nbsp;|&nbsp;
                {isPreauth ? '🔒 Pre-autorizzazione' : '💳 Pagamento diretto'} &nbsp;|&nbsp;
                {generateStripe ? '⚡ Link Stripe automatico' : '📋 Solo registrazione'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} disabled={isPending}>
            Annulla
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                {generateStripe ? 'Creazione link Stripe...' : 'Salvataggio...'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {generateStripe ? 'Aggiungi e genera link' : 'Aggiungi pagamento'}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
