import { addMonths, format } from 'date-fns';

export interface BuildPaymentRowsParams {
  booking_id: string;
  property_id?: string;   // incasso libero: legato alla sola proprietà, senza booking
  amount: number;
  date_start: Date;
  months: number;
  category: string;
  description: string;
  is_recurring: boolean;
  already_paid?: boolean;
  payment_method?: string;
  conto_id?: string;
}

export function buildPaymentRows(
  params: BuildPaymentRowsParams,
  userId: string,
  groupId: string | null,
): Record<string, unknown>[] {
  const {
    booking_id, property_id, amount, date_start, months, category, description,
    is_recurring, already_paid, payment_method, conto_id,
  } = params;

  // Con un booking la proprietà si ricava dal booking stesso; property_id
  // viaggia sulla riga solo per gli incassi liberi.
  const target: Record<string, unknown> = booking_id
    ? { booking_id }
    : { booking_id: null, property_id: property_id || null };

  if (is_recurring) {
    return Array.from({ length: months }, (_, i) => ({
      ...target,
      importo: amount,
      data_scadenza: format(addMonths(date_start, i), 'yyyy-MM-dd'),
      category,
      notes: `${description} (Rata ${i + 1}/${months})`,
      stato: 'da_pagare',
      is_recurring: true,
      recurrence_group_id: groupId,
      user_id: userId,
    }));
  }

  const base: Record<string, unknown> = {
    ...target,
    importo: amount,
    data_scadenza: format(date_start, 'yyyy-MM-dd'),
    category,
    notes: description,
    is_recurring: false,
    recurrence_group_id: null,
    user_id: userId,
  };

  if (already_paid) {
    return [{
      ...base,
      stato: 'pagato',
      payment_date: date_start.toISOString(),
      payment_type: payment_method ?? 'bonifico',
      conto_id: conto_id || null,
    }];
  }

  return [{ ...base, stato: 'da_pagare' }];
}
