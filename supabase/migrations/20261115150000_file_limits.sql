-- viper fleet: what may be uploaded (SEC-17). Idempotent.
--
-- Both private buckets take only documents and photos (PDF, JPEG, PNG, WebP, HEIC, Office files,
-- and tachograph files as plain bytes), up to 15 MB each. HTML, SVG and scripts are refused by
-- Storage itself, whatever the browser says the file is. The app also re-encodes photos before
-- upload (which drops their GPS position) and opens non-images as downloads.

begin;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'storage' and table_name = 'buckets'
                and column_name = 'allowed_mime_types') then
    update storage.buckets
       set file_size_limit = 15 * 1024 * 1024,
           allowed_mime_types = array[
             'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
             'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'application/vnd.ms-excel',
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
             'text/csv',
             -- Tachograph downloads (.ddd, .tgd) have no type of their own; Storage serves them
             -- as a download, never as a page.
             'application/octet-stream']
     where id in ('fleet-files', 'documents');
  end if;
end $$;

commit;
