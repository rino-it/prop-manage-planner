import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import type { ReportRow } from '@/utils/reportProprieta';

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9 },
  title: { fontSize: 14, marginBottom: 4, fontWeight: 'bold' },
  sub: { fontSize: 9, color: '#555', marginBottom: 10 },
  th: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 4, fontWeight: 'bold' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#ddd', paddingVertical: 3 },
  totalRow: { flexDirection: 'row', paddingVertical: 4, marginTop: 2, borderTopWidth: 1, borderColor: '#334155', fontWeight: 'bold' },
  c_prop: { width: '46%' },
  c_in: { width: '18%', textAlign: 'right' },
  c_out: { width: '18%', textAlign: 'right' },
  c_net: { width: '18%', textAlign: 'right' },
  neg: { color: '#dc2626' },
});

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReportProprietaDoc({ periodo, rows, totEntrate, totUscite, totNetto }: {
  periodo: string; rows: ReportRow[]; totEntrate: number; totUscite: number; totNetto: number;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Report proprietà — Entrate e uscite</Text>
        <Text style={styles.sub}>{periodo}</Text>
        <View style={styles.th}>
          <Text style={styles.c_prop}>Proprietà</Text>
          <Text style={styles.c_in}>Entrate</Text>
          <Text style={styles.c_out}>Uscite</Text>
          <Text style={styles.c_net}>Netto</Text>
        </View>
        {rows.map((r, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.c_prop}>{r.proprieta}</Text>
            <Text style={styles.c_in}>{r.entrate ? fmt(r.entrate) : ''}</Text>
            <Text style={styles.c_out}>{r.uscite ? fmt(r.uscite) : ''}</Text>
            <Text style={r.netto < 0 ? [styles.c_net, styles.neg] : styles.c_net}>{fmt(r.netto)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.c_prop}>TOTALE</Text>
          <Text style={styles.c_in}>{fmt(totEntrate)}</Text>
          <Text style={styles.c_out}>{fmt(totUscite)}</Text>
          <Text style={totNetto < 0 ? [styles.c_net, styles.neg] : styles.c_net}>{fmt(totNetto)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadReportProprieta(props: Parameters<typeof ReportProprietaDoc>[0], filename: string) {
  const blob = await pdf(<ReportProprietaDoc {...props} />).toBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
