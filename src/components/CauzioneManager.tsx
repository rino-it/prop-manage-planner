import React, { useState } from 'react';
import { useManagePreauth } from '@/hooks/useStripePayments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Lock, Unlock, Scissors } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CauzioneManagerProps {
  payment: {
    id: string;
    importo: number;
    stato: 'da_pagare' | 'pagato' | 'pre_autorizzato' | 'rilasciato' | 'scaduto' | 'annullato';
    is_preauth: boolean;
  };
  bookingId: string;
}

type PreauthState = 'preauth' | 'released' | 'captured';

const getPreauthState = (stato: string): PreauthState => {
  if (stato === 'pagato') return 'captured';
  if (stato === 'rilasciato') return 'released';
  return 'preauth';
};

const getPreauthDisplay = (
  state: PreauthState,
  amount: number
): { label: string; color: string } => {
  switch (state) {
    case 'preauth':
      return { label: `Pre-autorizzata EUR${amount.toFixed(2)}`, color: 'bg-blue-100 text-blue-800' };
    case 'released':
      return { label: 'Rilasciata', color: 'bg-green-100 text-green-800' };
    case 'captured':
      return { label: `Trattenuta EUR${amount.toFixed(2)}`, color: 'bg-red-100 text-red-800' };
    default:
      return { label: 'Sconosciuto', color: 'bg-gray-100 text-gray-800' };
  }
};

export default function CauzioneManager({
  payment,
  bookingId
}: CauzioneManagerProps) {
  const { mutate: managePreauth, isPending } = useManagePreauth();
  const [showPartialDialog, setShowPartialDialog] = useState(false);
  const [partialAmount, setPartialAmount] = useState<string>(payment.importo.toFixed(2));

  if (!payment.is_preauth) {
    return null;
  }

  const state = getPreauthState(payment.stato);
  const display = getPreauthDisplay(state, payment.importo);

  const handleRelease = () => {
    managePreauth({
      payment_id: payment.id,
      booking_id: bookingId,
      action: 'release'
    });
  };

  const handleCaptureAll = () => {
    managePreauth({
      payment_id: payment.id,
      booking_id: bookingId,
      action: 'capture_full'
    });
  };

  const handleCapturePartial = () => {
    const amount = parseFloat(partialAmount);
    if (isNaN(amount) || amount <= 0 || amount > payment.importo) {
      return;
    }
    managePreauth({
      payment_id: payment.id,
      booking_id: bookingId,
      action: 'capture_partial',
      capture_amount: amount
    });
    setShowPartialDialog(false);
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Gestione Cauzione
          </CardTitle>
          <Badge className={display.color}>
            {display.label}
          </Badge>
        </div>
      </CardHeader>

      {state === 'preauth' && (
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-700">
            La cauzione è pre-autorizzata. È possibile rilasciarla oppure trattenerla (totalmente o parzialmente).
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleRelease}
              disabled={isPending}
              variant="outline"
              className="flex-1"
            >
              <Unlock className="h-4 w-4 mr-2" />
              Rilascia
            </Button>

            <Button
              onClick={handleCaptureAll}
              disabled={isPending}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              <Lock className="h-4 w-4 mr-2" />
              Trattieni Tutto
            </Button>

            <Button
              onClick={() => setShowPartialDialog(true)}
              disabled={isPending}
              variant="outline"
              className="flex-1"
            >
              <Scissors className="h-4 w-4 mr-2" />
              Trattieni Parziale
            </Button>
          </div>
        </CardContent>
      )}

      {state === 'released' && (
        <CardContent>
          <p className="text-sm text-green-700">
            La cauzione è stata rilasciata all'ospite.
          </p>
        </CardContent>
      )}

      {state === 'captured' && (
        <CardContent>
          <p className="text-sm text-red-700">
            La cauzione è stata trattenuta per importo totale o parziale.
          </p>
        </CardContent>
      )}

      {/* PARTIAL CAPTURE DIALOG */}
      <Dialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trattieni Cauzione Parziale</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded text-sm">
              <p className="font-semibold mb-1">Cauzione totale:</p>
              <p className="text-lg font-bold text-blue-900">
                EUR {payment.importo.toFixed(2)}
              </p>
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
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Massimo: EUR {payment.importo.toFixed(2)}
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded text-sm">
              <p className="text-gray-700">
                Rilasciato: EUR {(payment.importo - parseFloat(partialAmount || '0')).toFixed(2)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPartialDialog(false)}
              disabled={isPending}
            >
              Annulla
            </Button>
            <Button
              onClick={handleCapturePartial}
              disabled={isPending || !partialAmount || parseFloat(partialAmount) <= 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? 'Elaborazione...' : 'Trattieni'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
