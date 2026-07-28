-- =====================================================================
-- SNS Bestellsystem - Schritt 4: alte Klartext-Tabelle löschen
-- =====================================================================
-- ERST AUSFÜHREN, wenn sich alle Beteiligten mindestens einmal
-- erfolgreich in der neuen Version eingeloggt haben.
--
-- public.users enthält die Passwörter im Klartext. Solange die Tabelle
-- existiert, existiert das Problem - auch mit RLS davor.
-- =====================================================================

-- Sicherheitsnetz: erst mal nur für alle sperren und umbenennen.
-- Wenn nach ein paar Tagen alles läuft, den DROP darunter ausführen.
alter table if exists public.users enable row level security;
revoke all on public.users from anon, authenticated;
alter table if exists public.users rename to users_alt_klartext;

-- --- Nach der Bewährungszeit: ---
-- drop table if exists public.users_alt_klartext;
