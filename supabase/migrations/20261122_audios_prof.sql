-- Voix du professeur (22/11/2026) : un enregistrement par diapo.
alter table public.documents add column if not exists audios jsonb;
update storage.buckets set allowed_mime_types = array['application/pdf','audio/mp4','audio/x-m4a','audio/aac','audio/webm','audio/ogg','audio/mpeg','audio/wav'] where id = 'cours';
drop policy if exists "eleve lit fichiers cours de son niveau" on storage.objects;
create policy "eleve lit fichiers cours de son niveau" on storage.objects for select to authenticated
  using (bucket_id = 'cours' and exists (select 1 from public.documents d where d.publie and d.niveau = public.mon_niveau()
    and (d.url = storage.objects.name or coalesce(d.audios, '[]'::jsonb) ? storage.objects.name)));
