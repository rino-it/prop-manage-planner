import { addMonths, format } from 'date-fns';

export interface BuildPaymentRowsParams {
  booking_id: string;
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
    booking_id, amount, date_start, months, category, description,
    is_recurring, already_paid, payment_method, conto_id,
  } = params;

  if (is_recurring) {
    return Array.from({ length: months }, (_, i) => ({
      booking_id,
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
    booking_id,
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
