import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContoEstratto {
  id: string;
  conto_id: string;
  user_id: string | null;
  filename: string;
  path: string;
  anno: number;
  mese: number | null;
  created_at: string | null;
}

// La tabella conto_estratti potrebbe non essere ancora nei tipi generati:
// usiamo un client "loose" per evitare errori di tipo, mantenendo ContoEstratto locale.
const db = supabase as any;

export function useContoEstratti() {
  const qc = useQueryClient();

  const list = useQuery<ContoEstratto[]>({
    queryKey: ['conto-estratti'],
    queryFn: async () => {
      const { data, error } = await db
        .from('conto_estratti')
        .select('*')
        .order('anno', { ascending: false })
        .order('mese', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ContoEstratto[];
    },
  });

  const upload = useMutation({
    mutationFn: async ({ conto_id, file, anno, mese }: { conto_id: string; file: File; anno: number; mese: number | null; }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const safe = file.name.replace(/\s+/g, '_');
      const path = `estratti/${conto_id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) throw upErr;
      const { error } = await db.from('conto_estratti').insert({
        conto_id, user_id: user?.id, filename: file.name, path, anno, mese,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conto-estratti'] }),
  });

  const remove = useMutation({
    mutationFn: async (row: ContoEstratto) => {
      if (row.path) {
        try { await supabase.storage.from('documents').remove([row.path]); } catch { /* best-effort */ }
      }
      const { error } = await db.from('conto_estratti').delete().eq('id', row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conto-estratti'] }),
  });

  return { ...list, upload, remove };
}
