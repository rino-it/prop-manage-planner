# Script per commit e push della feature Sync Review
# Eseguire dal terminale VSCode nella root del progetto

# 1. Stage dei file specifici della feature sync review
git add src/components/SyncReviewDialog.tsx
git add src/hooks/useSyncReview.ts
git add supabase/functions/confirm-sync-item/index.ts
git add supabase/functions/sync-portals/index.ts
git add supabase/migrations/20260402_create_sync_staging.sql
git add src/components/PortalConnections.tsx
git add src/integrations/supabase/types.ts

# 2. Verifica cosa stai per committare
git status

# 3. Commit
git commit -m "feat: sync review dialog - staging prenotazioni portali prima della conferma

- Nuova tabella sync_staging per revisione manuale dei sync
- Edge function sync-portals riscritta: scrive su staging invece di bookings
- Nuova edge function confirm-sync-item per conferma/rifiuto/bulk
- Hook useSyncReview con React Query
- Componente SyncReviewDialog con navigazione item-per-item
- Integrazione in PortalConnections con badge pending e apertura auto
- Tipi TypeScript rigenerati con sync_staging"

# 4. Push
git push origin main
