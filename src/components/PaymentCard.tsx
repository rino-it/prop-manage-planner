import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, FileText, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface PaymentCardProps {
  payment: {
    id: string;
    importo: number;
    category: string;
    data_scadenza: string;
    stato: 'da_pagare' | 'pagato' | 'scaduto' | 'annullato';
    is_preauth?: boolean;
    stripe_checkout_url?: string | null;
    receipt_url?: string | null;
  };
  onNotify?: () => void;
  variant: 'guest' | 'tenant';
}

const CATEGORY_LABELS: Record<string, string> = {
  canone_locazione: 'Canone di locazione',
  rimborso_utenze: 'Rimborso utenze',
  deposito_cauzionale: 'Deposito cauzionale',
  tassa_soggiorno: 'Tassa di soggiorno',
  extra: 'Servizio extra',
  caparra: 'Caparra',
  saldo: 'Saldo',
  cauzione: 'Cauzione'
};

const getStatusColor = (stato: string, isPreauth?: boolean): string => {
  if (isPreauth) {
    return 'bg-blue-100 text-blue-800';
  }
  switch (stato) {
    case 'pagato':
      return 'bg-green-100 text-green-800';
    case 'da_pagare':
      return 'bg-yellow-100 text-yellow-800';
    case 'scaduto':
      return 'bg-red-100 text-red-800';
    case 'annullato':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (stato: string, isPreauth?: boolean): string => {
  if (isPreauth) {
    return 'Pre-autorizzata';
  }
  switch (stato) {
    case 'pagato':
      return 'Pagato';
    case 'da_pagare':
      return 'Da pagare';
    case 'scaduto':
      return 'Scaduto';
    case 'annullato':
      return 'Annullato';
    default:
      return stato;
  }
};

export default function PaymentCard({
  payment,
  onNotify,
  variant
}: PaymentCardProps) {
  const categoryLabel = CATEGORY_LABELS[payment.category] || payment.category;
  const statusLabel = getStatusLabel(payment.stato, payment.is_preauth);
  const statusColor = getStatusColor(payment.stato, payment.is_preauth);
  const dueDate = format(new Date(payment.data_scadenza), 'd MMM yyyy', { locale: it });

  const handlePayNow = () => {
    if (payment.stripe_checkout_url) {
      window.open(payment.stripe_checkout_url, '_blank');
    }
  };

  const handleReceipt = () => {
    if (payment.receipt_url) {
      window.open(payment.receipt_url, '_blank');
    }
  };

  const handleNotify = () => {
    if (onNotify) {
      onNotify();
    }
  };

  const isPaid = payment.stato === 'pagato';
  const hasCheckout = payment.stripe_checkout_url && !isPaid && !payment.is_preauth;
  const hasReceipt = isPaid && payment.receipt_url;

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* HEADER */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{categoryLabel}</h3>
              <p className="text-xs text-gray-600">Scadenza: {dueDate}</p>
            </div>
            <Badge className={statusColor}>
              {statusLabel}
            </Badge>
          </div>

          {/* AMOUNT */}
          <div className="text-lg font-bold">
            EUR {payment.importo.toFixed(2)}
          </div>

          {/* ACTIONS */}
          <div className="flex gap-2">
            {hasCheckout && (
              <Button
                onClick={handlePayNow}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Paga Ora
              </Button>
            )}

            {hasReceipt && (
              <Button
                onClick={handleReceipt}
                variant="outline"
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                Ricevuta
              </Button>
            )}

            {!hasCheckout && !hasReceipt && (
              <Button
                onClick={handleNotify}
                variant="outline"
                className="flex-1"
              >
                <Bell className="h-4 w-4 mr-2" />
                Avvisa
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
