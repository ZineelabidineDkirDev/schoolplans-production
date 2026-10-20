-- Allow MP4 uploads in the existing supports bucket when it has an explicit MIME allowlist.
-- A NULL allowed_mime_types value already means no MIME allowlist, so leave it unchanged.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'video/mp4')
where id = 'supports'
  and allowed_mime_types is not null
  and not ('video/mp4' = any(allowed_mime_types));
