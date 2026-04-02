import React, { useState, useMemo } from 'react';
import {
  Check, X, ChevronLeft, ChevronRight, AlertTriangle,
  Plus, RefreshCw, Trash2, Loader2, CheckCheck
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSyncReview, type SyncStagingItem, type ConfirmModifications } from '@/hooks/useSyncReview';

interface SyncReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PORTAL_COLORS: Record<string, string> = {
  airbnb: 'bg-rose-100 text-rose-700 border-rose-200',
  booking: 'bg-blue-100 text-blue-700 border-blue-200',
  vrbo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

const PORTAL_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  vrbo: 'VRBO',
  other: 'Altro',
};

const CHANGE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: 'Nuova prenotazione', color: 'bg-green-100 text-green-700', icon: <Plus className="w-3 h-3" /> },
  updated: { label: 'Aggiornamento', color: 'bg-amber-100 text-amber-700', icon: <RefreshCw className="w-3 h-3" /> },
  cancelled: { label: 'Cancellazione', color: 'bg-red-100 text-red-700', icon: <Trash2 className="w-3 h-3" /> },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DiffField({ label, oldValue, newValue }: { label: string; oldValue?: string; newValue?: string }) {
  if (!oldValue || oldValue === newValue) return null;
  return (
    <div className="text-xs bg-amber-50 rounded px-2 py-1 border border-amber-100">
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className="line-through text-red-500">{oldValue}</span>
      {' → '}
      <span className="font-medium text-green-700">{newValue}</span>
    </div>
  );
}

export default function SyncReviewDialog({ open, onOpenChange }: SyncReviewDialogProps) {
  const { toast } = useToast();
  const {
    pendingItems,
    isLoading,
    confirmItem,
    rejectItem,
    confirmAllRemaining,
  } = useSyncReview();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<ConfirmModifications>({});

  const item = pendingItems[currentIndex] as SyncStagingItem | undefined;
  const total = pendingItems.length;

  const batchIds = useMemo(() => {
    const ids = new Set(pendingItems.map((i) => i.sync_batch_id));
    return Array.from(ids);
  }, [pendingItems]);

  const resetForm = (source?: SyncStagingItem) => {
    if (source) {
      setFormData({
        nome_ospite: source.nome_ospite || '',
        email_ospite: source.email_ospite || '',
        telefono_ospite: source.telefono_ospite || '',
        data_inizio: source.data_inizio,
        data_fine: source.data_fine,
        tipo_affitto: source.tipo_affitto || 'breve',
        numero_ospiti: source.numero_ospiti || 1,
      });
    } else {
      setFormData({});
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setCurrentIndex(0);
      setEditMode(false);
      setFormData({});
    }
    onOpenChange(newOpen);
  };

  const goNext = () => {
    setEditMode(false);
    setFormData({});
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (total === 0) {
      handleOpenChange(false);
    }
  };

  const handleConfirm = () => {
    if (!item) return;
    const modifications = editMode ? formData : undefined;
    confirmItem.mutate(
      { stagingId: item.id, modifications },
      {
        onSuccess: () => {
          toast({ title: item.change_type === 'cancelled' ? 'Cancellazione confermata' : 'Prenotazione confermata' });
          goNext();
        },
        onError: (err) => toast({ title: 'Errore', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleReject = () => {
    if (!item) return;
    rejectItem.mutate(item.id, {
      onSuccess: () => {
        toast({ title: 'Elemento scartato' });
        goNext();
      },
      onError: (err) => toast({ title: 'Errore', description: err.message, variant: 'destructive' }),
    });
  };

  const handleConfirmAll = () => {
    if (batchIds.length === 0) return;
    for (const batchId of batchIds) {
      confirmAllRemaining.mutate(batchId, {
        onSuccess: (data) => {
          toast({ title: `${data?.succeeded || 0} elementi confermati` });
          handleOpenChange(false);
        },
        onError: (err) => toast({ title: 'Errore', description: err.message, variant: 'destructive' }),
      });
    }
  };

  const startEdit = () => {
    if (item) {
      resetForm(item);
      setEditMode(true);
    }
  };

  const isProcessing = confirmItem.isPending || rejectItem.isPending || confirmAllRemaining.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Revisione Sync</span>
            {total > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {currentIndex + 1} / {total}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Rivedi le prenotazioni importate dai portali prima di confermarle.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && total === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCheck className="w-10 h-10 text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">Nessun elemento in attesa di revisione.</p>
          </div>
        )}

        {!isLoading && item && (
          <>
            <div className="space-y-4">
              {/* Header badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={PORTAL_COLORS[item.portal_name] || PORTAL_COLORS.other}>
                  {PORTAL_LABELS[item.portal_name] || item.portal_name}
                </Badge>
                <Badge variant="outline" className={CHANGE_CONFIG[item.change_type]?.color || ''}>
                  <span className="mr-1">{CHANGE_CONFIG[item.change_type]?.icon}</span>
                  {CHANGE_CONFIG[item.change_type]?.label}
                </Badge>
              </div>

              {/* Diff per aggiornamenti */}
              {item.change_type === 'updated' && item.previous_data && (
                <div className="space-y-1">
                  <DiffField
                    label="Nome"
                    oldValue={item.previous_data.nome_ospite}
                    newValue={item.nome_ospite || undefined}
                  />
                  <DiffField
                    label="Check-in"
                    oldValue={item.previous_data.data_inizio ? formatDate(item.previous_data.data_inizio) : undefined}
                    newValue={formatDate(item.data_inizio)}
                  />
                  <DiffField
                    label="Check-out"
                    oldValue={item.previous_data.data_fine ? formatDate(item.previous_data.data_fine) : undefined}
                    newValue={formatDate(item.data_fine)}
                  />
                </div>
              )}

              {/* Warning cancellazione */}
              {item.change_type === 'cancelled' && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-md p-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-700">
                    Questa prenotazione non e' piu presente nel feed del portale.
                    Confermando, verra eliminata dal sistema.
                  </div>
                </div>
              )}

              {/* Form: view o edit */}
              {!editMode ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Ospite</p>
                    <p className="font-medium">{item.nome_ospite || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-medium">{item.tipo_affitto === 'breve' ? 'Breve' : 'Lungo'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Check-in</p>
                    <p className="font-medium">{formatDate(item.data_inizio)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Check-out</p>
                    <p className="font-medium">{formatDate(item.data_fine)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{item.email_ospite || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefono</p>
                    <p className="font-medium">{item.telefono_ospite || '-'}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome ospite</Label>
                      <Input
                        value={formData.nome_ospite || ''}
                        onChange={(e) => setFormData((f) => ({ ...f, nome_ospite: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo affitto</Label>
                      <Select
                        value={formData.tipo_affitto || 'breve'}
                        onValueChange={(v) => setFormData((f) => ({ ...f, tipo_affitto: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="breve">Breve</SelectItem>
                          <SelectItem value="lungo">Lungo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Check-in</Label>
                      <Input
                        type="date"
                        value={formData.data_inizio || ''}
                        onChange={(e) => setFormData((f) => ({ ...f, data_inizio: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Check-out</Label>
                      <Input
                        type="date"
                        value={formData.data_fine || ''}
                        onChange={(e) => setFormData((f) => ({ ...f, data_fine: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={formData.email_ospite || ''}
                        onChange={(e) => setFormData((f) => ({ ...f, email_ospite: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefono</Label>
                      <Input
                        value={formData.telefono_ospite || ''}
                        onChange={(e) => setFormData((f) => ({ ...f, telefono_ospite: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">N. ospiti</Label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.numero_ospiti || 1}
                        onChange={(e) => setFormData((f) => ({ ...f, numero_ospiti: parseInt(e.target.value, 10) || 1 }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Importo totale</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.importo_totale || ''}
                        onChange={(e) => setFormData((f) => ({ ...f, importo_totale: parseFloat(e.target.value) || undefined }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t mt-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentIndex === 0 || isProcessing}
                  onClick={() => { setCurrentIndex((i) => i - 1); setEditMode(false); setFormData({}); }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentIndex >= total - 1 || isProcessing}
                  onClick={() => { setCurrentIndex((i) => i + 1); setEditMode(false); setFormData({}); }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                {total > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 text-xs"
                    disabled={isProcessing}
                    onClick={handleConfirmAll}
                  >
                    {confirmAllRemaining.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <CheckCheck className="w-3 h-3 mr-1" />
                    )}
                    Conferma tutti ({total})
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!editMode && item.change_type !== 'cancelled' && (
                  <Button variant="outline" size="sm" onClick={startEdit} disabled={isProcessing}>
                    Modifica
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {rejectItem.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                  Scarta
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isProcessing}
                >
                  {confirmItem.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Conferma
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
