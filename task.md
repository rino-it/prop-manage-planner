# Tenant Portal Lungo Termine

## Done
- [x] Migration SQL applicata (differenziata_info, contatti_utili, visible_tenant, tenant_booking_id)
- [x] GuestGuide.tsx — aggiunto differenziata + contatti utili (campi + UI + save)
- [x] Expenses.tsx — toggle "Mostra all'inquilino" + select inquilino

## In progress
- [ ] TenantPortal.tsx — riscrivere per lungo termine (3 tab: La Casa / Bollette / Segnalazioni + upload CI)

## Notes
- Switch component at src/components/ui/switch.tsx (already exists)
- TenantPortal: rileva tipo_affitto dal booking, se 'lungo' mostra nuovo layout
- Nuovo layout: 
  - Accesso: email/tel/CF + upload carta identità (booking_documents con ai_doc_type='carta_identita')
  - Tab "La Casa": house_rules + differenziata_info + contatti_utili da properties_real
  - Tab "Bollette & Spese": payments where visible_tenant=true AND tenant_booking_id=booking.id
  - Tab "Segnalazioni": tickets (già esiste)
- Se tipo_affitto = 'breve' → comportamento attuale invariato
