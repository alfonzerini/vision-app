-- ============================================================================
-- Vision — Cleaner verification backend (migration 0011)
-- ============================================================================
-- Builds the plumbing for cleaner verification WITHOUT enforcing it. Cleaners
-- can upload documents (insurance, ID); an admin CAN review them later. Nothing
-- in the app gates quoting/jobs on `is_verified` — this can be switched on
-- later by (a) an admin approving docs + setting cleaner_profiles.is_verified,
-- and (b) adding an is_verified check where jobs/quotes are gated.
-- ============================================================================

set search_path = public, extensions;

-- Private bucket for verification documents (insurance, ID, etc.).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- The cleaner uploads into their own folder ("<cleaner_id>/...").
drop policy if exists "documents: owner uploads" on storage.objects;
create policy "documents: owner uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only the owner (and admins) can read a document.
drop policy if exists "documents: owner or admin read" on storage.objects;
create policy "documents: owner or admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "documents: owner deletes" on storage.objects;
create policy "documents: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Admin review of a document (dormant until admin tooling is enabled).
create or replace function public.review_document(
  p_doc_id uuid,
  p_status document_status
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can review documents';
  end if;
  update documents
    set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_doc_id;
end;
$$;
grant execute on function public.review_document(uuid, document_status) to authenticated;
