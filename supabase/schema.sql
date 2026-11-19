-- MOODCUT access control schema
create table if not exists public.moodcut_profiles (
  telegram_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  role text not null default 'user' check (role in ('user','admin')),
  free_access boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.moodcut_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by bigint not null references public.moodcut_profiles(telegram_id),
  max_uses integer not null default 1 check (max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.moodcut_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.moodcut_invites(id),
  telegram_id bigint not null references public.moodcut_profiles(telegram_id),
  redeemed_at timestamptz not null default now(),
  unique (invite_id, telegram_id)
);

alter table public.moodcut_profiles enable row level security;
alter table public.moodcut_invites enable row level security;
alter table public.moodcut_invite_redemptions enable row level security;

-- No client-side policies: all access is mediated by the Edge Function using service_role.

create or replace function public.moodcut_redeem_invite(p_token_hash text, p_telegram_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.moodcut_invites%rowtype;
begin
  select * into v_invite
  from public.moodcut_invites
  where token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_invite');
  end if;
  if v_invite.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'invite_revoked');
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'invite_expired');
  end if;
  if v_invite.uses_count >= v_invite.max_uses then
    return jsonb_build_object('ok', false, 'error', 'invite_used');
  end if;
  if exists (
    select 1 from public.moodcut_invite_redemptions
    where invite_id = v_invite.id and telegram_id = p_telegram_id
  ) then
    return jsonb_build_object('ok', true, 'already_redeemed', true);
  end if;

  insert into public.moodcut_invite_redemptions(invite_id, telegram_id)
  values (v_invite.id, p_telegram_id);
  update public.moodcut_invites set uses_count = uses_count + 1 where id = v_invite.id;
  update public.moodcut_profiles set free_access = true where telegram_id = p_telegram_id;

  return jsonb_build_object('ok', true, 'already_redeemed', false);
end;
$$;

revoke all on function public.moodcut_redeem_invite(text, bigint) from public, anon, authenticated;
grant execute on function public.moodcut_redeem_invite(text, bigint) to service_role;
