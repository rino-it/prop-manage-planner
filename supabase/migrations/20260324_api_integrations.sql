-- Migration: API Integrations - Task 4
-- Aggiunge colonne necessarie per le integrazioni API

-- 1. Codice Fiscale ospite nella tabella bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS codice_fiscale_ospite text;

-- 2. Coordinate geografiche per le proprieta immobiliari (meteo + geocoding)
ALTER TABLE properties_real ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE properties_real ADD COLUMN IF NOT EXISTS longitude numeric;
