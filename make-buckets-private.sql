-- =====================================================================
-- SECURITY — make the photo buckets PRIVATE (2026-07-17)
-- =====================================================================
-- Child photos (and the now-removed benchmark/completion photos) were served
-- from PUBLIC storage buckets, so any object URL was world-readable to an
-- unauthenticated client forever. The app now generates short-lived SIGNED
-- URLs for child photos at every fetch point (lib/avatarUrls.ts), which work
-- whether the bucket is public or private — so flipping these to private is
-- safe once the signed-URL build is deployed.
--
-- ORDER OF OPERATIONS:
--   1. Deploy the app build that adds signed URLs (already on main).
--   2. Confirm photos still render in the live app (they'll be signed URLs).
--   3. THEN run this. After it, raw /object/public/... URLs return 400/403;
--      only signed URLs (and same-family authenticated access) work.
--
-- Object-level access is already family-scoped by storage RLS (a caller can
-- only sign/read their own family's folder), so signing itself stays locked
-- down after this.

update storage.buckets
set public = false
where id in ('kid-avatars', 'task-benchmarks', 'completion-photos');

-- Verify (expect public = false for all three):
-- select id, public from storage.buckets
-- where id in ('kid-avatars','task-benchmarks','completion-photos');
