# SNS Bestellsystem

Kleines Bestellsystem für den privaten Gebrauch: Produktsuche, Warenkorb,
Bestellabwicklung mit Status-Workflow, Lager-Tracking, Admin-Extras und
optionale Discord-Benachrichtigungen.

**Stack:** React 19 + Vite, React Router (HashRouter), Supabase (Datenbank +
Realtime + Auth), Tailwind für Utilities, eigenes Design-System in
`src/styles/design-system.css`.

## Entwicklung

```bash
npm install
npm run dev      # Dev-Server
npm run lint     # ESLint
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal ansehen
```

## Konfiguration

Supabase-URL und Publishable Key stehen in `.env` (siehe `.env.example`).

Beide Werte landen im gebauten JavaScript und sind damit öffentlich —
das ist bei einer reinen Frontend-App unvermeidbar und beim Publishable Key
auch so vorgesehen. **Der Zugriffsschutz kommt ausschließlich von den
RLS-Policies in der Datenbank**, nicht davon, dass der Key geheim bleibt.
Siehe `supabase/README.md`.

## Deployment

Push auf `main` baut und veröffentlicht automatisch auf GitHub Pages
(`.github/workflows/deploy.yml`). Die App liegt unter dem Unterpfad
`/Bestellung/`, entsprechend gesetzt in `vite.config.js` (`base`).

## Struktur

```
src/
  components/   Modal, NotificationModal, GlassSurface
  context/      AppContext - Session, Warenkorb, Bestellungen, Realtime
  pages/        Login, Home, Cart, Profile, UserExtras, Admin, AdminExtras, Catalog
  services/     supabase (Client), db (Datenzugriff), pricing, search
  styles/       design-system.css, tailwind.css
supabase/       SQL-Migrationen und Einrichtungsanleitung
```
