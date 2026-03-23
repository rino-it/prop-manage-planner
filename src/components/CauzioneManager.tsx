import React, { useState } from 'react';
import { useManagePreauth } from '@/hooks/useStripePayments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Lock, Unlock, Scissors, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CauzioneManagerProps {
  payment: {
    id: string;
    importo: number;
    stato: 'da_pagare' | 'pagato' | 'pre_autorizzato' | 'rilasciato' | 'scaduto' | 'annullato';
    is_preauth: boolean;
    preauth_captured_amount?: number | null;
    preauth_reason?: string | null;
    preauth_released?: boolean | null;
  };
  bookingId: string;
}

type PreauthState = 'preauth' | 'released' | 'captured';

const getPreauthState = (stato: string): PreauthState => {
  if (stato === 'pagato') return 'captured';
  if (stato === 'rilasciato') return 'released';
  return 'preauth';
};

type DialogMode = 'release' | 'capture_full' | 'capture_partial' | null;

export default function CauzioneManager({ payment, bookingId }: CauzioneManagerProps) {
  const { mutate: managePreauth, isPending } = useManagePreauth();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [partialAmount, setPartialAmount] = useState<string>(payment.importo.toFixed(2));
  const [reason, setReason] = useState('');

  if (!payment.is_preauth) return null;

  const state = getPreauthState(payment.stato);
  const capturedAmount = payment.preauth_captured_amount ? Number(payment.preauth_captured_amount) : null;
  const releasedAmount = capturedAmount !== null ? payment.importo - capturedAmount : null;

  const handleConfirm = () => {
    if (!dialogMode) return;

    const baseParams = {
      payment_id: payment.id,
      booking_id: bookingId,
      reason: reason.trim() || undefined,
    };

    if (dialogMode === 'release') {
      managePreauth({ ...baseParams, action: 'release' });
    } else if (dialogMode === 'capture_full') {
      managePreauth({ ...baseParams, action: 'capture_full' });
    } else if (dialogMode === 'capture_partial') {
      const amount = parseFloat(partialAmount);
      if (isNaN(amount) || amount <= 0 || amount > payment.importo) return;
      managePreauth({ ...baseParams, action: 'capture_partial', capture_amount: amount });
    }

    setDialogMode(null);
    setReason('');
  };

  const dialogConfig = {
    release: {
      title: 'Rilascia Cauzione',
      description: 'Nessun danno riscontrato. I fondi verranno sbloccati sulla carta del cliente.',
      confirmLabel: 'Rilascia Cauzione',
      confirmClass: 'bg-green-600 hover:bg-green-700',
      reasonRequired: false,
      reasonLabel: 'Note (facoltativo)',
    },
    capture_full: {
      title: 'Trattieni Cauzione Completa',
      description: `L'intero importo di EUR ${payment.importo.toFixed(2)} verra addebitato al cliente.`,
      confirmLabel: 'Conferma Trattenuta',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      reasonRequired: true,
      reasonLabel: 'Motivo della trattenuta (obbligatorio)',
    },
    capture_partial: {
      title: 'Trattieni Cauzione Parziale',
      description: 'Specifica importo e motivo della trattenuta parziale.',
      confirmLabel: 'Conferma Trattenuta',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      reasonRequired: true,
      reasonLabel: 'Motivo della trattenuta (obbligatorio)',
    },
  };

  const currentConfig = dialogMode ? dialogConfig[dialogMode] : null;
  const isReasonValid = !currentConfig?.reasonRequired || reason.trim().length > 0;

  return (
    <>
      <Card className={`border-2 ${state === 'preauth' ? 'border-blue-200 bg-blue-50' : state === 'released' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Gestione Cauzione
            </CardTitle>
            {state === 'preauth' && (
              <Badge className="bg-blue-100 text-blue-800">
                Pre-autorizzata EUR {payment.importo.toFixed(2)}
              </Badge>
            )}
            {state === 'released' && (
              <Badge className="bg-green-100 text-green-800">Rilasciata</Badge>
            )}
            {state === 'captured' && (
              <Badge className="bg-red-100 text-red-800">
                Trattenuta EUR {capturedAmount !== null ? capturedAmount.toFixed(2) : payment.importo.toFixed(2)}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {state === 'preauth' && (
            <>
              <p className="text-sm text-gray-700">
                La cauzione e pre-autorizzata sulla carta del cliente. Puoi rilasciarla (nessun danno) o trattenerla in caso di danni alla proprieta.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setDialogMode('release')}
                  disabled={isPending}
                  variant="outline"
                  className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Rilascia
                </Button>
                <Button
                  onClick={() => setDialogMode('capture_full')}
                  disabled={isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Trattieni Tutto
                </Button>
                <Button
                  onClick={() => { setPartialAmount(''); setDialogMode('capture_partial'); }}
                  disabled={isPending}
                  variant="outline"
                  className="flex-1"
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  Parziale
                </Button>
              </div>
            </>
          )}

          {state === 'released' && (
            <div className="space-y-1">
              <p className="text-sm text-green-700">La cauzione e stata rilasciata integralmente all'ospite.</p>
              {payment.preauth_reason && (
                <p className="text-xs text-gray-500">Note: {payment.preauth_reason}</p>
              )}
            </div>
          )}

          {state === 'captured' && (
            <div className="space-y-2">
              {capturedAmount !== null && capturedAmount < payment.importo ? (
                <div className="text-sm space-y-1">
                  <p className="text-red-700">Trattenuti: <strong>EUR {capturedAmount.toFixed(2)}</strong> su EUR {payment.importo.toFixed(2)}</p>
                  <p className="text-green-700">Rilasciati all'ospite: <strong>EUR {releasedAmount?.toFixed(2)}</strong></p>
                </div>
              ) : (
                <p className="text-sm text-red-700">Cauzione trattenuta integralmente: <strong>EUR {payment.importo.toFixed(2)}</strong></p>
              )}
              {payment.preauth_reason && (
                <div className="bg-white/60 rounded p-2 border border-red-100">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Motivo:</p>
                  <p className="text-sm text-gray-800">{payment.preauth_reason}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) { setDialogMode(null); setReason(''); } }}>
        <DialogContent>
          {currentConfig && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {dialogMode !== 'release' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                  {currentConfig.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm text-gray-600">{currentConfig.description}</p>

                {dialogMode === 'capture_partial' && (
                  <>
                    <div className="bg-blue-50 p-3 rounded text-sm">
                      <p className="text-xs text-gray-500">Cauzione totale</p>
                      <p className="text-lg font-bold text-blue-900">EUR {payment.importo.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label htmlFor="capture_amount">Importo da trattenere (EUR)</Label>
                      <Input
                        id="capture_amount"
                        type="number"
                        min="0.01"
                        max={payment.importo}
                        step="0.01"
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(e.target.value)}
                        className="mt-1"
                      />
                      {partialAmount && parseFloat(partialAmount) > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Rilasciato al cliente: EUR {(payment.importo - parseFloat(partialAmount || '0')).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="preauth_reason">{currentConfig.reasonLabel}</Label>
                  <Textarea
                    id="preauth_reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={dialogMode === 'release' ? 'Es: Nessun danno riscontrato al checkout' : 'Es: Danni al pavimento della camera, macchia divano soggiorno'}
                    className="mt-1"
                    rows={3}
                  />
                  {currentConfig.reasonRequired && !reason.trim() && (
                    <p className="text-xs text-red-500 mt-1">Il motivo e obbligatorio per trattenere la cauzione</p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogMode(null); setReason(''); }} disabled={isPending}>
                  Annulla
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={isPending || !isReasonValid || (dialogMode === 'capture_partial' && (!partialAmount || parseFloat(partialAmount) <= 0 || parseFloat(partialAmount) > payment.importo))}
                  className={currentConfig.confirmClass}
                >
                  {isPending ? 'Elaborazione...' : currentConfig.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
