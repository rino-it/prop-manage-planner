#!/bin/bash
set -e

echo "=== PropManage Planner - Commit Steps 1-8 ==="
echo ""

# Escludi .env dal tracking (solo whitespace changes, non necessario)
git checkout -- prop-manage-planner-main/.env 2>/dev/null || true

# -------------------------------------------------------
# STEP 1: Homepage / Dashboard / Calendario
# -------------------------------------------------------
echo "[Step 1] Homepage, Dashboard, Calendario..."
git add \
  src/components/Dashboard.tsx \
  src/components/CalendarView.tsx \
  src/hooks/useActivities.ts \
  src/hooks/useNotifications.ts \
  src/components/NotificationBell.tsx \
  src/components/Activities.tsx \
  src/pages/Index.tsx \
  prop-manage-planner-main/src/components/Dashboard.tsx \
  prop-manage-planner-main/src/components/NotificationBell.tsx \
  prop-manage-planner-main/src/components/Activities.tsx \
  prop-manage-planner-main/src/hooks/useActivities.ts \
  prop-manage-planner-main/src/hooks/useNotifications.ts \
  prop-manage-planner-main/src/pages/Index.tsx \
  2>/dev/null || true

git commit -m "$(cat <<'EOF'
feat(step-1): homepage dashboard con calendario e notifiche

Modulo Dashboard completo con vista calendario integrata,
sistema notifiche real-time e feed attivita.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" || echo "  Nessuna modifica per Step 1, skip."

# -------------------------------------------------------
# STEP 2: Messaggi / Comunicazione
# -------------------------------------------------------
echo "[Step 2] Messaggi e Comunicazione..."
git add \
  src/components/Messages.tsx \
  src/components/Communication.tsx \
  src/hooks/useMessages.ts \
  2>/dev/null || true

git commit -m "$(cat <<'EOF'
feat(step-2): modulo messaggi e comunicazione

Sistema messaggistica tra proprietario e inquilini/ospiti
con componenti Messages e Communication.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" || echo "  Nessuna modifica per Step 2, skip."

# -------------------------------------------------------
# STEP 3: Accoglienza / Guest Guide / Document Approval
# -------------------------------------------------------
echo "[Step 3] Accoglienza, Guest Guide, Document Approval..."
git add \
  src/pages/Accoglienza.tsx \
  src/components/GuestGuide.tsx \
  src/components/DocumentApproval.tsx \
  src/pages/GuestPortal.tsx \
  src/pages/TenantPortal.tsx \
  prop-manage-planner-main/src/pages/GuestPortal.tsx \
  prop-manage-planner-main/src/pages/TenantPortal.tsx \
  supabase/migrations/20260324_guest_guide_columns.sql \
  prop-manage-planner-main/supabase/migrations/20251001120000_guest_portal_full.sql \
  prop-manage-planner-main/supabase/migrations/20251101_public_guest_access.sql \
  prop-manage-planner-main/supabase/migrations/20251203_fix_guest_permissions.sql \
  prop-manage-planner-main/supabase/migrations/20251204_force_open.sql \
  prop-manage-planner-main/supabase/migrations/20251205_document_approval.sql \
  prop-manage-planner-main/supabase/migrations/20251206_fix_bucket_public.sql \
  supabase/migrations/20251001120000_guest_portal_full.sql \
  supabase/migrations/20251101_public_guest_access.sql \
  supabase/migrations/20251203_fix_guest_permissions.sql \
  supabase/migrations/20251204_force_open.sql \
  supabase/migrations/20251205_document_approval.sql \
  supabase/migrations/20251206_fix_bucket_public.sql \
  2>/dev/null || true

git commit -m "$(cat <<'EOF'
feat(step-3): accoglienza, guida ospiti e approvazione documenti

Portali guest/tenant, guida interattiva per ospiti,
workflow approvazione documenti con migrations Supabase.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" || echo "  Nessuna modifica per Step 3, skip."

# -------------------------------------------------------
# STEP 4: Statistiche
# -------------------------------------------------------
echo "[Step 4] Statistiche..."
git add \
  src/pages/Statistics.tsx \
  src/hooks/useStatistics.ts \
  src/components/Revenue.tsx \
  src/hooks/useRevenue.ts \
  src/hooks/useIncome.ts \
  src/hooks/usePayments.ts \
  src/pages/Expenses.tsx \
  prop-manage-planner-main/src/components/Revenue.tsx \
  prop-manage-planner-main/src/hooks/useRevenue.ts \
  prop-manage-planner-main/src/hooks/useIncome.ts \
  prop-manage-planner-main/src/hooks/usePayments.ts \
  prop-manage-planner-main/src/pages/Expenses.tsx \
  2>/dev/null || true

git commit -m "$(cat <<'EOF'
feat(step-4): modulo statistiche e revenue

Dashboard statistiche con analisi entrate, spese,
pagamenti e report revenue per proprieta.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" || echo "  Nessuna modifica per Step 4, skip."

# -------------------------------------------------------
# STEP 5: Portali di Prenotazione
# -------------------------------------------------------
echo "[Step 5] Portali di Prenotazione..."
git add \
  src/components/PortalConnections.tsx \
  src/hooks/usePortalConnections.ts \
  src/components/Bookings.tsx \
  supabase/functions/sync-portals/ \
  prop-manage-planner-main/src/components/Bookings.tsx \
  2>/dev/null || true

git commit -m "$(cat <<'EOF'
feat(step-5): connessioni portali prenotazione e sync

Integrazione portali esterni (Booking, Airbnb) con
edge function sync e gestione prenotazioni.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" || echo "  Nessuna modifica per Step 5, skip."

# -------------------------------------------------------
# STEP 6: Marketplace
# -------------------------------------------------------
echo "[Step 6] Marketplace..."
git add \
  src/components/Marketplace.tsx \
  src/pages/Marketplace.tsx \
  src/components/Services.tsx \
  prop-manage-planner-main/src/components/Services.tsx \
  2>/dev/null || true

git commit -m "$(cat <<'EOF'
feat(step-6): marketplace servizi

Catalogo marketplace per servizi immobiliari
e gestione fornitori.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" || echo "  Nessuna modifica per Step 6, skip."

# -------------------------------------------------------
# STEP 7: Prezzi / Pricing
# -------------------------------------------------------
echo "[Step 7] Prezzi e Pricing..."
git add \
  src/pages/Pricing.tsx \
  src/components/Pricing.tsx \
  src/hooks/usePricing.ts \
  2>/dev/null || true

git commit -m "$(cat <<'EOF'
feat(step-7): modulo pricing dinamico

Gestione prezzi per proprieta con logica
di pricing dinamico e stagionale.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" || echo "  Nessuna modifica per Step 7, skip."

# -------------------------------------------------------
# STEP 8: Integrazione globale (routing, config, UI, migrations)
# -------------------------------------------------------
echo "[Step 8] Integrazione globale - routing, config, UI, migrazioni..."
git add \
  src/App.tsx src/App.css src/main.tsx src/index.css \
  src/components/Sidebar.tsx \
  src/components/ProtectedRoute.tsx \
  src/components/Properties.tsx \
  src/components/AddPropertyDialog.tsx \
  src/components/Conditions.tsx \
  src/components/SuggestedPlan.tsx \
  src/components/Team.tsx \
  src/components/TenantManager.tsx \
  src/components/TicketManager.tsx \
  src/components/TicketPDF.tsx \
  src/components/UserMultiSelect.tsx \
  src/hooks/useAuth.tsx \
  src/hooks/useProperties.ts \
  src/hooks/useTenants.ts \
  src/hooks/useSmartPlanner.ts \
  src/hooks/use-mobile.tsx \
  src/hooks/use-toast.ts \
  src/integrations/supabase/client.ts \
  src/integrations/supabase/types.ts \
  src/lib/utils.ts \
  src/types/Property.ts \
  src/vite-env.d.ts \
  src/pages/Auth.tsx \
  src/pages/MobileProperties.tsx \
  src/pages/NotFound.tsx \
  src/pages/Tickets.tsx \
  src/components/ui/ \
  2>/dev/null || true

# Config files root
git add \
  package.json package-lock.json \
  components.json \
  eslint.config.js \
  postcss.config.js \
  tailwind.config.ts \
  tsconfig.json tsconfig.app.json tsconfig.node.json \
  vite.config.ts \
  vercel.json \
  index.html \
  public/robots.txt \
  .github/workflows/ \
  README.md \
  PROJECT_DOCUMENTATION.md \
  SUPABASE_SCHEMA.md \
  supabase_dump.sql \
  supabase/migrations/20250707150127_init.sql \
  supabase/migrations/20250825093900_8facd71b-a858-48f6-a7f8-5f79fb4deab6.sql \
  supabase/migrations/20250825094747_86f2d8f3-e4d9-4190-aaae-1c46cea7f7c4.sql \
  supabase/migrations/20251201_upgrade_properties.sql \
  supabase/migrations/20251202_storage_bucket.sql \
  2>/dev/null || true

# Tutto da prop-manage-planner-main/ (mirror)
git add \
  prop-manage-planner-main/src/App.tsx \
  prop-manage-planner-main/src/App.css \
  prop-manage-planner-main/src/main.tsx \
  prop-manage-planner-main/src/index.css \
  prop-manage-planner-main/src/components/Sidebar.tsx \
  prop-manage-planner-main/src/components/ProtectedRoute.tsx \
  prop-manage-planner-main/src/components/Properties.tsx \
  prop-manage-planner-main/src/components/AddPropertyDialog.tsx \
  prop-manage-planner-main/src/components/Conditions.tsx \
  prop-manage-planner-main/src/components/SuggestedPlan.tsx \
  prop-manage-planner-main/src/components/Team.tsx \
  prop-manage-planner-main/src/components/TenantManager.tsx \
  prop-manage-planner-main/src/components/TicketManager.tsx \
  prop-manage-planner-main/src/components/TicketPDF.tsx \
  prop-manage-planner-main/src/components/UserMultiSelect.tsx \
  prop-manage-planner-main/src/hooks/useAuth.tsx \
  prop-manage-planner-main/src/hooks/useProperties.ts \
  prop-manage-planner-main/src/hooks/useTenants.ts \
  prop-manage-planner-main/src/hooks/useSmartPlanner.ts \
  prop-manage-planner-main/src/hooks/use-mobile.tsx \
  prop-manage-planner-main/src/hooks/use-toast.ts \
  prop-manage-planner-main/src/integrations/supabase/client.ts \
  prop-manage-planner-main/src/integrations/supabase/types.ts \
  prop-manage-planner-main/src/lib/utils.ts \
  prop-manage-planner-main/src/types/Property.ts \
  prop-manage-planner-main/src/vite-env.d.ts \
  prop-manage-planner-main/src/pages/Auth.tsx \
  prop-manage-planner-main/src/pages/MobileProperties.tsx \
  prop-manage-planner-main/src/pages/NotFound.tsx \
  prop-manage-planner-main/src/pages/Tickets.tsx \
  prop-manage-planner-main/src/components/ui/ \
  prop-manage-planner-main/package.json \
  prop-manage-planner-main/package-lock.json \
  prop-manage-planner-main/components.json \
  prop-manage-planner-main/eslint.config.js \
  prop-manage-planner-main/postcss.config.js \
  prop-manage-planner-main/tailwind.config.ts \
  prop-manage-planner-main/tsconfig.json \
  prop-manage-planner-main/tsconfig.app.json \
  prop-manage-planner-main/tsconfig.node.json \
  prop-manage-planner-main/vite.config.ts \
  prop-manage-planner-main/vercel.json \
  prop-manage-planner-main/index.html \
  prop-manage-planner-main/public/robots.txt \
  prop-manage-planner-main/.gitignore \
  prop-manage-planner-main/README.md \
  prop-manage-planner-main/PROJECT_DOCUMENTATION.md \
  prop-manage-planner-main/SUPABASE_SCHEMA.md \
  prop-manage-planner-main/supabase_dump.sql \
  prop-manage-planner-main/supabase/migrations/20250707150127_init.sql \
  prop-manage-planner-main/supabase/migrations/20250825093900_8facd71b-a858-48f6-a7f8-5f79fb4deab6.sql \
  prop-manage-planner-main/supabase/migrations/20250825094747_86f2d8f3-e4d9-4190-aaae-1c46cea7f7c4.sql \
  prop-manage-planner-main/supabase/migrations/20251201_upgrade_properties.sql \
  prop-manage-planner-main/supabase/migrations/20251202_storage_bucket.sql \
  prop-manage-planner-main/supabase/migrations/20251001120000_guest_portal_full.sql \
  2>/dev/null || true

git commit -m "$(cat <<'EOF'
feat(step-8): integrazione globale routing, UI, config e migrazioni

Routing completo per tutti i moduli, aggiornamento sidebar,
componenti UI shadcn, configurazioni build, migrazioni DB
e documentazione progetto aggiornata.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" || echo "  Nessuna modifica per Step 8, skip."

# -------------------------------------------------------
# Verifica finale e push
# -------------------------------------------------------
echo ""
echo "=== Verifica stato ==="
git status

echo ""
echo "=== Commit history ==="
git log --oneline -10

echo ""
read -p "Procedere con push su origin/main? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin main
  echo "Push completato."
else
  echo "Push annullato. I commit sono pronti in locale."
fi
