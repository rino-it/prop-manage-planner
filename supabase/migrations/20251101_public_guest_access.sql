-- Permetti agli ospiti (anonimi) di leggere le loro prenotazioni
CREATE POLICY "Public read bookings" ON bookings FOR SELECT TO anon USING (true);

-- Permetti agli ospiti di vedere i servizi e i voucher
CREATE POLICY "Public read services" ON services FOR SELECT TO anon USING (true);
CREATE POLICY "Public read vouchers" ON vouchers FOR SELECT TO anon USING (true);

-- Permetti agli ospiti di CREARE ticket (segnalare problemi)
CREATE POLICY "Public create tickets" ON tickets FOR INSERT TO anon WITH CHECK (true);

-- Permetti agli ospiti di richiedere servizi
CREATE POLICY "Public create service requests" ON service_requests FOR INSERT TO anon WITH CHECK (true);