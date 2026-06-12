import { format, parseISO } from 'date-fns';
import type { EstrattoRow } from '@/components/EstrattoContoPDF';

export interface MovProprieta {
  data: string;            // ISO, almeno yyyy-MM-dd
  descrizione: string;
  conto_id: string | null;
  entrata: number;
  uscita: number;
}

function fmtDate(iso: string): string {
  try { return format(parseISO(iso), 'dd/MM/yyyy'); } catch { return iso; }
}

export function buildRowsProprieta(
  movs: MovProprieta[],
  propNome: string,
  contoNome: (id: string | null) => string,
): { rows: EstrattoRow[]; totEntrate: number; totUscite: number; saldoFinale: number } {
  const sorted = [...movs].sort((a, b) => a.data.slice(0, 10).localeCompare(b.data.slice(0, 10)));
  let running = 0;
  let totEntrate = 0;
  let totUscite = 0;
  const rows: EstrattoRow[] = sorted.map(m => {
    running += Number(m.entrata) - Number(m.uscita);
    totEntrate += Number(m.entrata);
    totUscite += Number(m.uscita);
    return {
      data: fmtDate(m.data),
      descrizione: m.descrizione,
      proprieta: propNome,
      conto: contoNome(m.conto_id),
      entrata: Number(m.entrata),
      uscita: Number(m.uscita),
      saldo: running,
    };
  });
  return { rows, totEntrate, totUscite, saldoFinale: totEntrate - totUscite };
}
