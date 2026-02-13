import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';

// Stili del PDF
const styles = StyleSheet.create({
  page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 30 },
  header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  section: { margin: 10, padding: 10, flexGrow: 1 },
  row: { flexDirection: 'row', marginBottom: 10 },
  label: { width: 100, fontSize: 10, color: '#6B7280', fontWeight: 'bold' },
  value: { flex: 1, fontSize: 10, color: '#111827' },
  descriptionBox: { marginTop: 20, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 4 },
  descriptionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  descriptionText: { fontSize: 10, lineHeight: 1.5 },
  imageSection: { marginTop: 20 },
  imageTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 10 },
  imageContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  image: { width: 150, height: 150, objectFit: 'cover', borderRadius: 4, marginBottom: 10 },
  footer: { position: 'absolute', bottom: 30, left: 30, right: 30, fontSize: 8, textAlign: 'center', color: '#9CA3AF' }
});

interface TicketPDFProps {
  ticket: any;
  publicUrls: string[]; // URL delle immagini già risolti
}

export const TicketDocument = ({ ticket, publicUrls }: TicketPDFProps) => {
  const propertyName = ticket.properties_mobile 
    ? `${ticket.properties_mobile.veicolo} (${ticket.properties_mobile.targa})` 
    : (ticket.properties_real?.nome || 'Generale');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Scheda Intervento #{ticket.id.slice(0, 6)}</Text>
          <Text style={styles.subtitle}>Generato il {format(new Date(), 'dd/MM/yyyy')}</Text>
        </View>

        {/* INFO GRIGLIA */}
        <View>
          <View style={styles.row}>
            <Text style={styles.label}>Oggetto:</Text>
            <Text style={styles.value}>{ticket.titolo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Riferimento:</Text>
            <Text style={styles.value}>{propertyName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Priorità:</Text>
            <Text style={styles.value}>{ticket.priorita?.toUpperCase()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Stato Attuale:</Text>
            <Text style={styles.value}>{ticket.stato?.toUpperCase()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Data Creazione:</Text>
            <Text style={styles.value}>{format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}</Text>
          </View>
          {ticket.data_scadenza && (
             <View style={styles.row}>
                <Text style={styles.label}>Scadenza:</Text>
                <Text style={styles.value}>{format(new Date(ticket.data_scadenza), 'dd/MM/yyyy')}</Text>
             </View>
          )}
        </View>

        {/* DESCRIZIONE */}
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionTitle}>Dettagli Tecnici</Text>
          <Text style={styles.descriptionText}>{ticket.descrizione || "Nessuna descrizione fornita."}</Text>
        </View>

        {/* GALLERIA IMMAGINI */}
        {publicUrls && publicUrls.length > 0 && (
          <View style={styles.imageSection}>
            <Text style={styles.imageTitle}>Allegati Fotografici</Text>
            <View style={styles.imageContainer}>
              {publicUrls.map((url, index) => (
                <Image key={index} src={url} style={styles.image} />
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer}>Documento generato automaticamente da PropManage Planner</Text>
      </Page>
    </Document>
  );
};