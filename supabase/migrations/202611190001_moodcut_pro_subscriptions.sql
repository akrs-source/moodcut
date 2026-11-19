-- MOODCUT PRO recurring subscriptions via Telegram Stars
create table if not exists public.moodcut_pending_payments (
  invoice_payload text primary key,
  telegram_id bigint not null references public.moodcut_profiles(telegram_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.moodcut_subscriptions (
  telegram_id bigint primary key references public.moodcut_profiles(telegram_id) on delete cascade,
  plan_code text not null default 'pro' check (plan_code in ('pro')),
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  current_period_end timestamptz not null,
  last_charge_id text not null,
  is_recurring boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.moodcut_payment_events (
  telegram_payment_charge_id text primary key,
  telegram_id bigint not null references public.moodcut_profiles(telegram_id) on delete cascade,
  invoice_payload text not null,
  total_amount integer not null,
  currency text not null default 'XTR',
  raw_payment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.moodcut_pending_payments enable row level security;
alter table public.moodcut_subscriptions enable row level security;
alter table public.moodcut_payment_events enable row level security;
-- No client-side policies: only the Edge Function service_role can read or write these tables.
