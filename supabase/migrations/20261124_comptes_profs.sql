-- Comptes professeurs créés depuis l'appli (24/11/2026).
-- Identifiant « k.nom » → adresse technique k.nom@prof.boostetude.fr ; une vraie
-- adresse e-mail est aussi acceptée telle quelle.
alter table public.profs add column if not exists identifiant text;
create unique index if not exists profs_identifiant_unique on public.profs (identifiant) where identifiant is not null;

create or replace function public.creer_compte_prof(p_prof uuid, p_prenom text, p_nom text, p_identifiant text,
  p_mdp text, p_telephone text, p_taux numeric)
returns uuid language plpgsql security definer
set search_path = public, extensions, auth, pg_temp as $$
declare v_uid uuid; v_email text; v_prof uuid := p_prof; v_auth uuid;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if length(coalesce(p_mdp, '')) < 6 then raise exception 'Mot de passe trop court (6 caractères minimum)'; end if;
  p_identifiant := lower(trim(p_identifiant));
  v_email := case when p_identifiant like '%@%' then p_identifiant else p_identifiant || '@prof.boostetude.fr' end;
  if v_email !~ '^[a-z0-9][a-z0-9._-]*@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'Identifiant invalide'; end if;
  if v_prof is not null then
    select auth_id into v_auth from public.profs where id = v_prof;
    if not found then raise exception 'Professeur introuvable'; end if;
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id is distinct from v_auth) then
    raise exception 'Identifiant déjà pris';
  end if;
  if v_auth is not null and exists (select 1 from auth.users where id = v_auth) then
    update auth.users set encrypted_password = crypt(p_mdp, gen_salt('bf')), email = v_email,
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = v_auth;
    update auth.identities set identity_data = jsonb_build_object('sub', v_auth::text, 'email', v_email, 'email_verified', true),
      updated_at = now() where user_id = v_auth and provider = 'email';
    update public.profs set identifiant = p_identifiant, email = v_email where id = v_prof;
    return v_prof;
  end if;
  v_uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    crypt(p_mdp, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  if v_prof is null then
    insert into public.profs (auth_id, prenom, nom, email, role, taux_horaire, telephone, identifiant)
    values (v_uid, trim(p_prenom), trim(p_nom), v_email, 'prof', p_taux, nullif(trim(coalesce(p_telephone, '')), ''), p_identifiant)
    returning id into v_prof;
  else
    update public.profs set auth_id = v_uid, email = v_email, identifiant = p_identifiant where id = v_prof;
  end if;
  return v_prof;
end $$;
revoke all on function public.creer_compte_prof(uuid, text, text, text, text, text, numeric) from public, anon;
grant execute on function public.creer_compte_prof(uuid, text, text, text, text, text, numeric) to authenticated;
