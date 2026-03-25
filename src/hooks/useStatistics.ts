import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfMonth, endOfMonth, subMonths, differenceInDays, parseISO, format } from 'date-fns';

export type PeriodFilter = 'mese' | 'trimestre' | 'anno';

interface StatisticsFilters {
  period: PeriodFilter;
  propertyId: string | null;
}

function getDateRange(period: PeriodFilter): { from: string; to: string } {
  const now = new Date();
  const to = format(endOfMonth(now), 'yyyy-MM-dd');
  let from: string;

  switch (period) {
    case 'mese':
      from = format(startOfMonth(now), 'yyyy-MM-dd');
      break;
    case 'trimestre':
      from = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd');
      break;
    case 'anno':
      from = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd');
      break;
  }

  return { from, to };
}

function getPreviousDateRange(period: PeriodFilter): { from: string; to: string } {
  const now = new Date();
  let from: string;
  let to: string;

  switch (period) {
    case 'mese':
      to = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      from = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      break;
    case 'trimestre':
      to = format(endOfMonth(subMonths(now, 3)), 'yyyy-MM-dd');
      from = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd');
      break;
    case 'anno':
      to = format(endOfMonth(subMonths(now, 12)), 'yyyy-MM-dd');
      from = format(startOfMonth(subMonths(now, 23)), 'yyyy-MM-dd');
      break;
  }

  return { from, to };
}

export function useStatistics(filters: StatisticsFilters) {
  const { user } = useAuth();
  const userId = user?.id;

  const properties = useQuery({
    queryKey: ['statistics-properties', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties_real')
        .select('id, nome, canone_mensile')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const bookings = useQuery({
    queryKey: ['statistics-bookings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, property_id, data_inizio, data_fine, nome_ospite, importo_totale, total_amount, created_at, source, numero_ospiti');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const tenantPayments = useQuery({
    queryKey: ['statistics-tenant-payments', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_payments')
        .select('id, booking_id, tipo, importo, data_scadenza, stato, created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const propertyExpenses = useQuery({
    queryKey: ['statistics-property-expenses', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_expenses')
        .select('id, property_id, category, amount, date, description, status');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const payments = useQuery({
    queryKey: ['statistics-payments', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, property_real_id, importo, scadenza, stato, categoria, descrizione');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const isLoading = properties.isLoading || bookings.isLoading || tenantPayments.isLoading || propertyExpenses.isLoading || payments.isLoading;

  const computed = computeStatistics(
    filters,
    properties.data ?? [],
    bookings.data ?? [],
    tenantPayments.data ?? [],
    propertyExpenses.data ?? [],
    payments.data ?? []
  );

  return {
    isLoading,
    properties: properties.data ?? [],
    ...computed,
  };
}

interface PropertyRow {
  id: string;
  nome: string;
  canone_mensile: number | null;
}

interface BookingRow {
  id: string;
  property_id: string | null;
  data_inizio: string;
  data_fine: string;
  nome_ospite: string;
  importo_totale: number | null;
  total_amount: number | null;
  created_at: string | null;
  source: string | null;
  numero_ospiti: number | null;
}

interface TenantPaymentRow {
  id: string;
  booking_id: string | null;
  tipo: string | null;
  importo: number;
  data_scadenza: string;
  stato: string | null;
  created_at: string | null;
}

interface PropertyExpenseRow {
  id: string;
  property_id: string | null;
  category: string | null;
  amount: number;
  date: string;
  description: string | null;
  status: string | null;
}

interface PaymentRow {
  id: string;
  property_real_id: string | null;
  importo: number;
  scadenza: string;
  stato: string | null;
  categoria: string | null;
  descrizione: string;
}

function computeStatistics(
  filters: StatisticsFilters,
  properties: PropertyRow[],
  bookings: BookingRow[],
  tenantPayments: TenantPaymentRow[],
  propertyExpenses: PropertyExpenseRow[],
  paymentsData: PaymentRow[]
) {
  const { period, propertyId } = filters;
  const { from, to } = getDateRange(period);
  const prev = getPreviousDateRange(period);

  const filteredBookings = bookings.filter(b => {
    if (propertyId && b.property_id !== propertyId) return false;
    return b.data_fine >= from && b.data_inizio <= to;
  });

  const prevBookings = bookings.filter(b => {
    if (propertyId && b.property_id !== propertyId) return false;
    return b.data_fine >= prev.from && b.data_inizio <= prev.to;
  });

  const filteredProperties = propertyId
    ? properties.filter(p => p.id === propertyId)
    : properties;

  const totalProperties = filteredProperties.length;
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const totalDays = differenceInDays(toDate, fromDate) + 1;
  const totalPropertyDays = totalProperties * totalDays;

  let occupiedDays = 0;
  for (const b of filteredBookings) {
    const bStart = parseISO(b.data_inizio) < fromDate ? fromDate : parseISO(b.data_inizio);
    const bEnd = parseISO(b.data_fine) > toDate ? toDate : parseISO(b.data_fine);
    occupiedDays += Math.max(0, differenceInDays(bEnd, bStart) + 1);
  }

  const occupancyRate = totalPropertyDays > 0
    ? Math.round((occupiedDays / totalPropertyDays) * 100)
    : 0;

  let prevOccupiedDays = 0;
  const prevFrom = parseISO(prev.from);
  const prevTo = parseISO(prev.to);
  const prevTotalDays = differenceInDays(prevTo, prevFrom) + 1;
  const prevTotalPropertyDays = totalProperties * prevTotalDays;
  for (const b of prevBookings) {
    const bStart = parseISO(b.data_inizio) < prevFrom ? prevFrom : parseISO(b.data_inizio);
    const bEnd = parseISO(b.data_fine) > prevTo ? prevTo : parseISO(b.data_fine);
    prevOccupiedDays += Math.max(0, differenceInDays(bEnd, bStart) + 1);
  }
  const prevOccupancyRate = prevTotalPropertyDays > 0
    ? Math.round((prevOccupiedDays / prevTotalPropertyDays) * 100)
    : 0;

  let totalRevenue = 0;
  let totalNights = 0;
  for (const b of filteredBookings) {
    const amount = b.importo_totale ?? b.total_amount ?? 0;
    totalRevenue += Number(amount);
    const nights = differenceInDays(parseISO(b.data_fine), parseISO(b.data_inizio));
    totalNights += Math.max(nights, 1);
  }

  const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
  const revpar = totalPropertyDays > 0 ? totalRevenue / totalPropertyDays : 0;

  let prevTotalRevenue = 0;
  let prevTotalNights = 0;
  for (const b of prevBookings) {
    const amount = b.importo_totale ?? b.total_amount ?? 0;
    prevTotalRevenue += Number(amount);
    const nights = differenceInDays(parseISO(b.data_fine), parseISO(b.data_inizio));
    prevTotalNights += Math.max(nights, 1);
  }
  const prevAdr = prevTotalNights > 0 ? prevTotalRevenue / prevTotalNights : 0;
  const prevRevpar = prevTotalPropertyDays > 0 ? prevTotalRevenue / prevTotalPropertyDays : 0;

  const filteredExpenses = propertyExpenses.filter(e => {
    if (propertyId && e.property_id !== propertyId) return false;
    return e.date >= from && e.date <= to;
  });
  const filteredPayments = paymentsData.filter(p => {
    if (propertyId && p.property_real_id !== propertyId) return false;
    return p.scadenza >= from && p.scadenza <= to;
  });

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    + filteredPayments.filter(p => p.stato === 'pagato').reduce((sum, p) => sum + Number(p.importo), 0);

  const paidIncome = tenantPayments.filter(tp => {
    if (tp.stato !== 'pagato') return false;
    return tp.data_scadenza >= from && tp.data_scadenza <= to;
  }).reduce((sum, tp) => sum + Number(tp.importo), 0);

  const totalIncome = totalRevenue + paidIncome;

  const monthlyData = buildMonthlyData(
    period, from, to,
    filteredBookings, tenantPayments, filteredExpenses, filteredPayments, propertyId
  );

  const propertyPerformance = filteredProperties.map(prop => {
    const propBookings = bookings.filter(b => b.property_id === prop.id && b.data_fine >= from && b.data_inizio <= to);
    let propRevenue = 0;
    let propNights = 0;
    for (const b of propBookings) {
      propRevenue += Number(b.importo_totale ?? b.total_amount ?? 0);
      propNights += Math.max(differenceInDays(parseISO(b.data_fine), parseISO(b.data_inizio)), 1);
    }
    const propCanone = (prop.canone_mensile ?? 0) * (period === 'mese' ? 1 : period === 'trimestre' ? 3 : 12);
    const propExpenses = propertyExpenses
      .filter(e => e.property_id === prop.id && e.date >= from && e.date <= to)
      .reduce((s, e) => s + Number(e.amount), 0);

    return {
      id: prop.id,
      nome: prop.nome,
      revenue: propRevenue + propCanone,
      expenses: propExpenses,
      netto: propRevenue + propCanone - propExpenses,
      nights: propNights,
      occupiedDays: (() => {
        let days = 0;
        for (const b of propBookings) {
          const bStart = parseISO(b.data_inizio) < fromDate ? fromDate : parseISO(b.data_inizio);
          const bEnd = parseISO(b.data_fine) > toDate ? toDate : parseISO(b.data_fine);
          days += Math.max(0, differenceInDays(bEnd, bStart) + 1);
        }
        return days;
      })(),
      totalDays,
    };
  }).sort((a, b) => b.netto - a.netto);

  const bookingLeadTimes = filteredBookings
    .filter(b => b.created_at)
    .map(b => differenceInDays(parseISO(b.data_inizio), parseISO(b.created_at!)));
  const avgLeadTime = bookingLeadTimes.length > 0
    ? Math.round(bookingLeadTimes.reduce((s, d) => s + d, 0) / bookingLeadTimes.length)
    : 0;

  return {
    occupancyRate,
    occupancyTrend: occupancyRate - prevOccupancyRate,
    adr,
    adrTrend: prevAdr > 0 ? Math.round(((adr - prevAdr) / prevAdr) * 100) : 0,
    revpar,
    revparTrend: prevRevpar > 0 ? Math.round(((revpar - prevRevpar) / prevRevpar) * 100) : 0,
    totalRevenue: totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
    totalBookings: filteredBookings.length,
    prevBookingsCount: prevBookings.length,
    avgLeadTime,
    monthlyData,
    propertyPerformance,
  };
}

function buildMonthlyData(
  period: PeriodFilter,
  from: string,
  to: string,
  bookings: BookingRow[],
  tenantPayments: TenantPaymentRow[],
  expenses: PropertyExpenseRow[],
  payments: PaymentRow[],
  propertyId: string | null
) {
  const months: { key: string; label: string }[] = [];
  let current = parseISO(from);
  const end = parseISO(to);

  while (current <= end) {
    months.push({
      key: format(current, 'yyyy-MM'),
      label: format(current, 'MMM yy'),
    });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return months.map(m => {
    const monthStart = m.key + '-01';
    const monthEndDate = endOfMonth(parseISO(monthStart));
    const monthEnd = format(monthEndDate, 'yyyy-MM-dd');

    const monthBookings = bookings.filter(b =>
      b.data_fine >= monthStart && b.data_inizio <= monthEnd
    );

    let revenue = 0;
    for (const b of monthBookings) {
      revenue += Number(b.importo_totale ?? b.total_amount ?? 0);
    }

    const monthTenantIncome = tenantPayments.filter(tp => {
      if (tp.stato !== 'pagato') return false;
      return tp.data_scadenza >= monthStart && tp.data_scadenza <= monthEnd;
    }).reduce((s, tp) => s + Number(tp.importo), 0);

    const monthExpenses = expenses
      .filter(e => e.date >= monthStart && e.date <= monthEnd)
      .reduce((s, e) => s + Number(e.amount), 0);

    const monthPayments = payments
      .filter(p => p.stato === 'pagato' && p.scadenza >= monthStart && p.scadenza <= monthEnd)
      .reduce((s, p) => s + Number(p.importo), 0);

    return {
      label: m.label,
      incassi: Math.round(revenue + monthTenantIncome),
      spese: Math.round(monthExpenses + monthPayments),
      prenotazioni: monthBookings.length,
    };
  });
}
