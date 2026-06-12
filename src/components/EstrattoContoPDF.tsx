import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9 },
  title: { fontSize: 14, marginBottom: 4, fontWeight: 'bold' },
  sub: { fontSize: 9, color: '#555', marginBottom: 10 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#ddd', paddingVertical: 3 },
  th: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 4 },
  c_date: { width: '14%' }, c_desc: { width: '32%' }, c_prop: { width: '21%' },
  c_conto: { width: '15%' }, c_in: { width: '9%', textAlign: 'right' },
  c_out: { width: '9%', textAlign: 'right' },
  totals: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
});

export interface EstrattoRow { data: string; descrizione: string; proprieta: string; conto: string; entrata: number; uscita: number; saldo: number; }

export function EstrattoContoDoc({ titolo, periodo, rows, totEntrate, totUscite, saldoFinale }: {
  titolo: string; periodo: string; rows: EstrattoRow[]; totEntrate: number; totUscite: number; saldoFinale: number;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.title}>{titolo}</Text>
        <Text style={styles.sub}>{periodo}</Text>
        <View style={styles.th}>
          <Text style={styles.c_date}>Data</Text><Text style={styles.c_desc}>Descrizione</Text>
          <Text style={styles.c_prop}>Proprietà</Text><Text style={styles.c_conto}>Conto</Text>
          <Text style={styles.c_in}>Entrata</Text><Text style={styles.c_out}>Uscita</Text>
        </View>
        {rows.map((r, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.c_date}>{r.data}</Text><Text style={styles.c_desc}>{r.descrizione}</Text>
            <Text style={styles.c_prop}>{r.proprieta}</Text><Text style={styles.c_conto}>{r.conto}</Text>
            <Text style={styles.c_in}>{r.entrata ? r.entrata.toFixed(2) : ''}</Text>
            <Text style={styles.c_out}>{r.uscita ? r.uscita.toFixed(2) : ''}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Text>Entrate: € {totEntrate.toFixed(2)}</Text>
          <Text>Uscite: € {totUscite.toFixed(2)}</Text>
          <Text>Saldo finale: € {saldoFinale.toFixed(2)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadEstrattoConto(props: Parameters<typeof EstrattoContoDoc>[0], filename: string) {
  const blob = await pdf(<EstrattoContoDoc {...props} />).toBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
