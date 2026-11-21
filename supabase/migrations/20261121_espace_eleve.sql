-- Espace élève (21/11/2026) : comptes élèves, cours en ligne par niveau.
-- Le socle existait déjà : eleves.auth_id, mon_eleve_id(), mon_niveau(),
-- table documents lue par l'élève de ce niveau.

alter table public.documents add column if not exists matiere text not null default 'Mathématiques';
alter table public.documents add column if not exists ordre int not null default 0;
alter table public.documents add column if not exists nb_pages int;
alter table public.documents add column if not exists publie boolean not null default true;
alter table public.eleves add column if not exists identifiant text;
create unique index if not exists eleves_identifiant_unique on public.eleves (identifiant) where identifiant is not null;

drop policy if exists "admin gere documents" on public.documents;
create policy "admin gere documents" on public.documents for all using (public.est_admin()) with check (public.est_admin());
drop policy if exists "eleve lit docs de son niveau" on public.documents;
create policy "eleve lit docs de son niveau" on public.documents for select
  using (publie and niveau = public.mon_niveau());

-- Fichiers des cours : privés, lisibles seulement par l'élève du bon niveau.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cours', 'cours', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists "admin gere fichiers cours" on storage.objects;
create policy "admin gere fichiers cours" on storage.objects for all to authenticated
  using (bucket_id = 'cours' and public.est_admin()) with check (bucket_id = 'cours' and public.est_admin());
drop policy if exists "eleve lit fichiers cours de son niveau" on storage.objects;
create policy "eleve lit fichiers cours de son niveau" on storage.objects for select to authenticated
  using (bucket_id = 'cours' and exists (
    select 1 from public.documents d where d.url = storage.objects.name and d.publie and d.niveau = public.mon_niveau()));

-- Création (ou remise à zéro du mot de passe) d'un compte élève, par l'administrateur.
-- Identifiant « f.elmkhanter » → adresse technique f.elmkhanter@eleve.boostetude.fr.
create or replace function public.creer_compte_eleve(p_eleve uuid, p_identifiant text, p_mdp text)
returns text language plpgsql security definer
set search_path = public, extensions, auth, pg_temp as $$
declare v_uid uuid; v_email text; v_auth uuid; v_niveau text;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if length(coalesce(p_mdp, '')) < 6 then raise exception 'Mot de passe trop court (6 caractères minimum)'; end if;
  p_identifiant := lower(trim(p_identifiant));
  if p_identifiant !~ '^[a-z0-9][a-z0-9._-]{1,40}$' then raise exception 'Identifiant invalide'; end if;
  v_email := p_identifiant || '@eleve.boostetude.fr';
  select auth_id, niveau into v_auth, v_niveau from public.eleves where id = p_eleve;
  if not found then raise exception 'Élève introuvable'; end if;
  if exists (select 1 from public.eleves where identifiant = p_identifiant and id <> p_eleve)
     or exists (select 1 from auth.users where email = v_email and id is distinct from v_auth) then
    raise exception 'Identifiant déjà pris';
  end if;
  if v_auth is not null and exists (select 1 from auth.users where id = v_auth) then
    update auth.users set encrypted_password = crypt(p_mdp, gen_salt('bf')), email = v_email,
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = v_auth;
    update auth.identities set identity_data = jsonb_build_object('sub', v_auth::text, 'email', v_email, 'email_verified', true),
      updated_at = now() where user_id = v_auth and provider = 'email';
    update public.eleves set identifiant = p_identifiant where id = p_eleve;
    return p_identifiant;
  end if;
  v_uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    crypt(p_mdp, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('eleve_id', p_eleve), now(), now(),
    '', '', '', '', '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now());
  update public.eleves set auth_id = v_uid, identifiant = p_identifiant where id = p_eleve;
  return p_identifiant;
end $$;
revoke all on function public.creer_compte_eleve(uuid, text, text) from public, anon;
grant execute on function public.creer_compte_eleve(uuid, text, text) to authenticated;
