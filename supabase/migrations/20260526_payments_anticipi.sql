-- Aggiunge supporto per gli anticipi (spese pagate per conto di terzi,
-- di cui si attende il rimborso) sulla tabella payments.
--
-- is_advance         : true => il record e' un anticipo; default false per
--                      retro-compatibilita' con tutte le spese esistenti.
-- debtor_name        : campo libero con il nome del debitore.
-- reimbursement_note : nota libera registrata al momento del rimborso.
--
-- Stato e flusso vengono riusati: stato='da_pagare' significa "da rimborsare",
-- stato='pagato' significa "rimborsato"; data_pagamento e payment_method si
-- ri-semanticizzano come data e metodo del rimborso ricevuto.

alter table payments
  add column if not exists is_advance boolean not null default false,
  add column if not exists debtor_name text,
  add column if not exists reimbursement_note text;

create index if not exists payments_is_advance_idx
  on payments(is_advance) where is_advance = true;
