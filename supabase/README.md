# Supabase einrichten

Diese Anleitung macht aus der bisherigen offenen Datenbank eine abgesicherte.
Plane etwa 30 Minuten ein und arbeite die Schritte **der Reihe nach** ab.

## Warum das nötig ist

Bisher lag die komplette Zugriffskontrolle im Browser: die App hat sich mit
`select * from users where username=... and password=...` selbst eingeloggt.
Damit die App funktionierte, musste die Tabelle `users` für jeden lesbar sein –
inklusive der Passwörter, die im Klartext gespeichert waren. Wer die Adresse
der Seite kannte, konnte sie auslesen, ohne sich anzumelden.

Nach dieser Umstellung übernimmt die Datenbank die Kontrolle:

* Passwörter werden von Supabase Auth gehasht und sind für niemanden lesbar –
  auch nicht für dich als Admin.
* Ohne Login kommt man an keinerlei Daten mehr.
* Jeder sieht nur die eigenen Bestellungen, Admins sehen alles.
* Ein Nutzer kann sich nicht per Browser-Konsole zum Admin machen.
* Discord-Benachrichtigungen verschickt die Datenbank – genau einmal.

---

## Schritt 0: Backup

Dashboard → **Database → Backups** → Backup anlegen (oder unter
**Database → Migrations/Schema Visualizer** kurz prüfen, was da ist).
Ohne Backup nicht weitermachen.

## Schritt 1: E-Mail-Bestätigung ausschalten

Dashboard → **Authentication → Sign In / Providers → Email**

* **Confirm email**: **aus**

Die Accounts benutzen intern Adressen wie `max@sns.local`. An diese Domain kann
keine Mail zugestellt werden – bleibt die Bestätigung an, kann sich niemand
einloggen. Angemeldet wird sich weiterhin ganz normal mit dem Benutzernamen;
die E-Mail-Adresse baut die App im Hintergrund zusammen.

## Schritt 2: pg_net aktivieren

Dashboard → **Database → Extensions** → nach `pg_net` suchen → einschalten.

Damit kann die Datenbank die Discord-Webhooks selbst aufrufen.

## Schritt 3: SQL ausführen

Dashboard → **SQL Editor**. Die Dateien aus `migrations/` **einzeln und in
dieser Reihenfolge** einfügen und ausführen:

| Datei | Was passiert |
|---|---|
| `001_auth_profiles_rls.sql` | Tabellen `profiles`, `settings`, `admin_extras`, Bestellnummern-Sequenz, alle RLS-Policies, Admin-Funktionen |
| `001b_hotfix_guards.sql` | Nur nötig, wenn du 001 in der ersten Fassung ausgeführt hast (siehe unten) |
| `002_datenmigration.sql` | Bestehende Accounts nach Supabase Auth, Einstellungen und Extras aus den Pseudo-Bestellungen holen |
| `003_discord_benachrichtigungen.sql` | Benachrichtigungen per Datenbank-Trigger |
| `005_passwoerter_fuer_admins.sql` | Passwörter im Adminbereich per Auge-Symbol einsehbar (siehe unten) |

Läuft eine Datei auf einen Fehler, **nicht mit der nächsten weitermachen** –
Fehlermeldung anschauen (oder mir schicken).

> **Wenn 002 mit „Nur Administratoren dürfen Rolle, Flatrate oder Benutzername
> ändern" abbricht:** Du hast 001 in der ersten Fassung ausgeführt. Führe
> `001b_hotfix_guards.sql` aus und starte 002 danach erneut. Die Skripte sind
> so gebaut, dass mehrfaches Ausführen nichts kaputt macht.
>
> Ursache: Die Schutz-Trigger haben auch direkte SQL-Zugriffe blockiert. Im SQL
> Editor gibt es keine Session, `auth.uid()` ist leer – der Trigger hielt das
> für einen normalen Nutzer. Zugriffe ohne Session kommen nur aus dem Dashboard
> oder von Migrationen und werden jetzt durchgelassen; über die App ist das
> nicht möglich, da greifen zusätzlich die RLS-Policies.

Nach `002` zur Kontrolle:

```sql
select username, role, is_pablo from public.profiles order by username;
```

Es sollten alle bisherigen Benutzer mit korrekter Rolle auftauchen.

## Schritt 4: Webhook-URL prüfen

In `003` steht deine Make.com-URL bereits drin. Falls du sie änderst:

```sql
update public.app_config
   set value = 'https://hook.eu2.make.com/DEINE_URL'
 where key = 'discord_webhook_url';
```

Testen (dein eigener Benutzername, du brauchst eine hinterlegte Discord-ID):

```sql
select public.send_discord_dm('deinbenutzername', 'Testnachricht', 'test');
select status_code, content from net._http_response order by created desc limit 5;
```

`status_code` sollte 200 sein.

## Schritt 5: Repository-Secrets setzen

GitHub → Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Wert |
|---|---|
| `VITE_SUPABASE_URL` | `https://tljtedqzmjvxcvadspgm.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | dein `sb_publishable_...`-Key |

Beide Namen müssen **exakt** so heißen, sonst bricht der Deploy mit einer
klaren Fehlermeldung ab.

Zur Klarstellung: diese Werte landen trotzdem im ausgelieferten JavaScript und
sind öffentlich lesbar. Sie stehen nur deshalb in Secrets, damit du sie ohne
Code-Änderung austauschen kannst. Geschützt wird die Datenbank durch RLS.

Lokal brauchst du dieselben Werte in einer `.env` (Vorlage: `.env.example`).
Die Datei ist in `.gitignore` und wird nicht eingecheckt.

## Schritt 6: Testen

1. Mit einem normalen Benutzer einloggen → Bestellung aufgeben, stornieren,
   bearbeiten.
2. Mit dem Admin einloggen → Status ändern, Nachricht an den Besteller,
   Benutzer anlegen, Passwort ändern.
3. Prüfen, dass ein normaler Benutzer in den Entwicklertools **keine** fremden
   Bestellungen mehr sieht.
4. Discord-Benachrichtigung auslösen und zählen: es darf genau **eine** DM
   ankommen, auch wenn mehrere Leute die Seite offen haben.

## Schritt 7: Klartext-Tabelle stilllegen

Wenn nach ein paar Tagen alles läuft:

```sql
-- migrations/004_alte_tabelle_entfernen.sql
```

Das sperrt die alte `users`-Tabelle und benennt sie um. Der endgültige `drop`
steht auskommentiert darunter – ausführen, wenn du sicher bist.

**Wichtig:** Solange diese Tabelle existiert, existieren auch die Passwörter im
Klartext. Und weil das Repository öffentlich ist und die alten Passwörter dort
in der Git-Historie stehen: **lass alle Beteiligten ihr Passwort ändern**,
sobald die Umstellung läuft. Wer das alte Passwort auch woanders benutzt hat,
sollte es dort ebenfalls tauschen.

---

## Passwörter im Adminbereich (005)

Nach `005_passwoerter_fuer_admins.sql` siehst du im Nutzerpanel wieder ein
Auge-Symbol und kannst das Passwort einsehen und kopieren.

Zwei Dinge dazu:

* **Bestehende Passwörter tauchen nicht auf.** Sie liegen nur als bcrypt-Hash
  vor und lassen sich nicht zurückrechnen – von niemandem. Beim Auge steht
  „noch unbekannt". Sobald du für einen Benutzer einmal ein neues Passwort
  vergibst, ist es sichtbar und bleibt es. Wenn du alle sehen willst: einmal
  die Liste durchgehen und überall ein Passwort setzen.
* **Die Klartext-Kopie liegt in `public.user_secrets`**, nicht in `profiles`.
  Die Tabelle ist per RLS ausschließlich für Admins lesbar; `anon` hat keinerlei
  Rechte. Der Login prüft weiterhin gegen den Hash – die Kopie dient nur der
  Anzeige.

Bedenke trotzdem: Wer Zugriff auf diese Tabelle erlangt, liest echte Passwörter,
und viele Menschen benutzen dasselbe Passwort an mehreren Stellen. Wer das nicht
möchte, führt `005` einfach nicht aus – dann bleibt alles beim Hash-Verfahren
und du vergibst bei Bedarf ein neues Passwort.

## Was noch offen ist

* **Die Make.com-Webhook-URLs sind öffentlich** (sie stehen im ausgelieferten
  JavaScript bzw. jetzt in der Datenbank). Wer sie kennt, kann euch beliebige
  Discord-Nachrichten schicken lassen. Ein gemeinsames Geheimnis im Payload,
  das Make prüft, würde das abstellen – dafür müsstest du das Make-Szenario
  anpassen.
* **Die Produktsuche** läuft weiter über öffentliche CORS-Proxys. Wenn die
  ausfallen, fällt die Suche aus.

## Wenn etwas schiefgeht

Anmelden geht nicht mehr:

1. Ist „Confirm email" wirklich aus? (Schritt 1)
2. Existiert der Account? `select email from auth.users;`
3. Hat der Account ein Profil? `select * from public.profiles;`
4. Notfalls Passwort neu setzen:
   ```sql
   update auth.users
      set encrypted_password = crypt('neuespasswort', gen_salt('bf'))
    where email = 'benutzername@sns.local';
   ```

Solange `004` noch nicht gelaufen ist, liegt die alte `users`-Tabelle
unverändert daneben – die Ausgangslage ist also jederzeit wiederherstellbar.
