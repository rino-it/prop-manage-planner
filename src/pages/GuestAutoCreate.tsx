import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function GuestAutoCreate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const name = searchParams.get('name');
  const checkin = searchParams.get('checkin');
  const checkout = searchParams.get('checkout');
  const propertyId = searchParams.get('property');

  useEffect(() => {
    if (!name || !checkin || !checkout || !propertyId) {
      setError('Parametri mancanti nel link. Servono: name, checkin, checkout, property.');
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(checkin) || !dateRegex.test(checkout)) {
      setError('Formato date non valido. Usare YYYY-MM-DD.');
      return;
    }

    const createOrFindBooking = async () => {
      try {
        // 1. Verify property exists
        const { data: property, error: propError } = await supabase
          .from('properties_real')
          .select('id')
          .eq('id', propertyId)
          .maybeSingle();

        if (propError || !property) {
          setError('Proprietà non trovata. Verifica il link.');
          return;
        }

        // 2. Check for existing booking (dedup)
        const { data: existing } = await supabase
          .from('bookings')
          .select('id')
          .eq('nome_ospite', name)
          .eq('data_inizio', checkin)
          .eq('data_fine', checkout)
          .eq('property_id', propertyId)
          .maybeSingle();

        if (existing) {
          navigate(`/guest/${existing.id}`, { replace: true });
          return;
        }

        // 3. Create new booking
        const { data: newBooking, error: insertError } = await supabase
          .from('bookings')
          .insert({
            nome_ospite: name,
            data_inizio: checkin,
            data_fine: checkout,
            property_id: propertyId,
            tipo_affitto: 'breve',
            checkin_status: 'pending',
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Errore creazione booking:', insertError);
          setError('Errore nella creazione della prenotazione. Riprova.');
          return;
        }

        navigate(`/guest/${newBooking.id}`, { replace: true });
      } catch (e) {
        console.error('Errore imprevisto:', e);
        setError('Errore imprevisto. Riprova più tardi.');
      }
    };

    createOrFindBooking();
  }, [name, checkin, checkout, propertyId, navigate]);

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-4 text-center bg-slate-50">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">Link non valido</h1>
        <p className="text-slate-500 max-w-md mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin text-slate-400 mb-4" />
      <p className="text-slate-500">Preparazione del portale...</p>
    </div>
  );
}
