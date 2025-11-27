import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Recupera le variabili d'ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Controllo di sicurezza
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERRORE CRITICO: Mancano le variabili d'ambiente VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY.");
}

// Inizializza il client
export const supabase = createClient<Database>(
  SUPABASE_URL || '', 
  SUPABASE_KEY || ''
);