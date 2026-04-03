import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, addMonths, subMonths,
} from 'date-fns';

export interface CalendarBooking {
  id: string;
  property_id: string | null;
  nome_ospite: string;
  email_ospite: string | null;
  telefono_ospite: string | null;
  data_inizio: string;
  data_fine: string;
  source: string | null;
  tipo_affitto: string | null;
  checkin_status: string | null;
  importo_totale: number | null;
  numero_ospiti: number | null;
  property_name: string | null;
}

export interface CalendarBlockedDate {
  id: string;
  property_id: string;
  date_start: string;
  date_end: string;
  reason: string | null;
  source: string | null;
  property_name: string | null;
}

export interface BookingNote {
  id: string;
  booking_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const SOURCE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  airbnb_ical: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
  booking_ical: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  vrbo_ical: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  manual: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

export const BLOCKED_COLORS = { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' };

export function getSourceColors(source: string | null) {
  if (!source) return SOURCE_COLORS.manual;
  return SOURCE_COLORS[source] || SOURCE_COLORS.manual;
}

export function sourceLabel(source: string | null): string {
  const labels: Record<string, string> = {
    airbnb_ical: 'Airbnb',
    booking_ical: 'Booking.com',
    vrbo_ical: 'VRBO',
    manual: 'Manuale',
  };
  return labels[source || 'manual'] || source || 'Manuale';
}

export function useUnifiedCalendar(currentMonth: Date) {
  const rangeStart = useMemo(
    () => subMonths(startOfMonth(currentMonth), 1).toISOString().split('T')[0],
    [currentMonth]
  );
  const rangeEnd = useMemo(
    () => addMonths(endOfMonth(currentMonth), 1).toISOString().split('T')[0],
    [currentMonth]
  );

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['unified-calendar-bookings', rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, property_id, nome_ospite, email_ospite, telefono_ospite, data_inizio, data_fine, source, tipo_affitto, checkin_status, importo_totale, numero_ospiti, properties_real(nome)')
        .neq('tipo_affitto', 'lungo')
        .gte('data_fine', rangeStart)
        .lte('data_inizio', rangeEnd)
        .order('data_inizio', { ascending: true });
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        property_name: b.properties_real?.nome || null,
        properties_real: undefined,
      })) as CalendarBooking[];
    },
    staleTime: 30_000,
  });

  const { data: blockedDates = [], isLoading: loadingBlocked } = useQuery({
    queryKey: ['unified-calendar-blocked', rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_blocked_dates')
        .select('id, property_id, date_start, date_end, reason, source, properties_real(nome)')
        .gte('date_end', rangeStart)
        .lte('date_start', rangeEnd)
        .order('date_start', { ascending: true });
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        property_name: b.properties_real?.nome || null,
        properties_real: undefined,
      })) as CalendarBlockedDate[];
    },
    staleTime: 30_000,
  });

  return {
    bookings,
    blockedDates,
    isLoading: loadingBookings || loadingBlocked,
  };
}

export function useBookingNotes(bookingId: string | null) {
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['booking-notes', bookingId],
    queryFn: async () => {
      if (!bookingId) return [];
      const { data, error } = await supabase
        .from('booking_notes')
        .select('id, booking_id, content, created_at, updated_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BookingNote[];
    },
    enabled: !!bookingId,
  });

  const addNote = useMutation({
    mutationFn: async ({ bookingId, content }: { bookingId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');
      const { error } = await supabase
        .from('booking_notes')
        .insert({ booking_id: bookingId, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-notes', bookingId] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('booking_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-notes', bookingId] });
    },
  });

  return { notes, isLoading, addNote, deleteNote };
}
