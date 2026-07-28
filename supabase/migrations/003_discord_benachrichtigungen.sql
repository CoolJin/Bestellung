-- =====================================================================
-- SNS Bestellsystem - Schritt 3: Discord-Benachrichtigungen in der DB
-- =====================================================================
-- Bisher hat jeder offene Browser-Tab den Make.com-Webhook selbst gefeuert.
-- Folge: bei drei eingeloggten Leuten kamen drei DMs, und wenn niemand die
-- Seite offen hatte, kam gar keine.
--
-- Ab jetzt verschickt die Datenbank selbst - genau einmal pro Ereignis,
-- unabhängig davon, wer gerade online ist. Das Format des Payloads bleibt
-- unverändert ({discordId, message, event}), die Make.com-Szenarien müssen
-- also nicht angepasst werden.
--
-- Voraussetzung: Extension pg_net aktivieren
-- (Dashboard > Database > Extensions > pg_net einschalten).
-- =====================================================================

create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- 1. Konfiguration (Webhook-URL). Kein Zugriff für App-Nutzer.
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
    key   text primary key,
    value text not null
);

alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

-- >>> HIER deine Make.com-Webhook-URL eintragen <<<
insert into public.app_config (key, value)
values ('discord_webhook_url', 'https://hook.eu2.make.com/9o6d7birjy66suvq6w8rzbwz72dbw9yb')
on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------------
-- 2. Versandfunktion
-- ---------------------------------------------------------------------
create or replace function public.send_discord_dm(
    target_username text,
    message         text,
    event           text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    target_discord_id text;
    enabled           boolean;
    webhook_url       text;
begin
    select discord_id, notifications_enabled
      into target_discord_id, enabled
      from public.settings
     where username = target_username;

    if target_discord_id is null or target_discord_id = '' or enabled is not true then
        return;
    end if;

    select value into webhook_url from public.app_config where key = 'discord_webhook_url';
    if webhook_url is null then
        return;
    end if;

    perform net.http_post(
        url     := webhook_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object(
            'discordId', target_discord_id,
            'message',   message,
            'event',     event
        )
    );
end $$;

-- ---------------------------------------------------------------------
-- 3. Trigger auf orders
-- ---------------------------------------------------------------------
create or replace function public.notify_order_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    produkt   text;
    quelle    text;
    admin_rec record;
    msg       text;
begin
    -- Neue Produktanfrage -> alle Admins
    if tg_op = 'INSERT' and new.status = 'request_open' then
        produkt := coalesce(new.items->0->>'name', 'Unbekanntes Produkt');
        quelle  := case when new.items->0->>'source' = 'extra' then 'Extras' else 'Lagerbestand' end;

        for admin_rec in select username from public.profiles where role = 'admin' loop
            perform public.send_discord_dm(
                admin_rec.username,
                format('Neue Produktanfrage von **%s**: **%s** (aus %s)!', new.user_id, produkt, quelle),
                'new_request'
            );
        end loop;
        return null;
    end if;

    -- Zurückgezogene Anfrage -> alle Admins
    if tg_op = 'DELETE' and old.status = 'request_open' then
        produkt := coalesce(old.items->0->>'name', 'Unbekanntes Produkt');

        for admin_rec in select username from public.profiles where role = 'admin' loop
            perform public.send_discord_dm(
                admin_rec.username,
                format('**%s** hat seine Produktanfrage für **%s** zurückgezogen.', old.user_id, produkt),
                'request_withdrawn'
            );
        end loop;
        return null;
    end if;

    -- Statuswechsel -> Besteller
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
        produkt := coalesce(new.items->0->>'name', 'Unbekanntes Produkt');

        msg := case new.status
            when 'request_accepted' then format('Dein Produkt **%s** ist für dich bereit!', produkt)
            when 'request_denied'   then format('Deine Produktanfrage für **%s** wurde abgelehnt.', produkt)
            when 'ordered'          then format('Deine Bestellung **%s** wurde bestellt.', new.id)
            when 'completed'        then format('Deine Bestellung **%s** wurde als bezahlt markiert.', new.id)
            else null
        end;

        if msg is not null then
            perform public.send_discord_dm(new.user_id, msg, 'status_update');
        end if;
    end if;

    return null;
end $$;

drop trigger if exists orders_notify_insert on public.orders;
create trigger orders_notify_insert
    after insert on public.orders
    for each row execute function public.notify_order_event();

drop trigger if exists orders_notify_update on public.orders;
create trigger orders_notify_update
    after update on public.orders
    for each row execute function public.notify_order_event();

drop trigger if exists orders_notify_delete on public.orders;
create trigger orders_notify_delete
    after delete on public.orders
    for each row execute function public.notify_order_event();

-- Test (als Postgres im SQL Editor):
--   select public.send_discord_dm('deinbenutzername', 'Testnachricht', 'test');
-- Ergebnis der HTTP-Anfrage prüfen:
--   select status_code, content from net._http_response order by created desc limit 5;
