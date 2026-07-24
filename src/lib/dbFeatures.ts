import { supabase } from '@/integrations/supabase/client';

// La colonna tenant_payments.property_id (incassi liberi) arriva con una
// migrazione manuale: finché non viene eseguita, le query devono degradare
// con grazia invece di rompere le pagine. Probe una-tantum, in cache.
let cached: Promise<boolean> | null = null;

async function probe(): Promise<boolean> {
  const { error } = await supabase.from('tenant_payments').select('property_id').limit(1);
  return !error;
}

export function hasIncassiLiberi(): Promise<boolean> {
  if (!cached) cached = probe();
  return cached;
}

// Le tabelle collaboratori arrivano con la migrazione manuale
// 20260724_collaboratori.sql: stesso pattern di degradazione con grazia.
let cachedCollaboratori: Promise<boolean> | null = null;

async function probeCollaboratori(): Promise<boolean> {
  const { error } = await supabase.from('collaboratori').select('id').limit(1);
  return !error;
}

export function hasCollaboratori(): Promise<boolean> {
  if (!cachedCollaboratori) cachedCollaboratori = probeCollaboratori();
  return cachedCollaboratori;
}
