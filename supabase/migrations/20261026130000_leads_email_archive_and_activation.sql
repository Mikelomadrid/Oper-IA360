-- Archivo de correos y adjuntos de LEADS WEB.
-- Los mensajes históricos se conservan aquí y nunca se insertan en public.leads.

create table if not exists public.lead_email_ingestion_checkpoints (
  mailbox text not null,
  folder text not null,
  activated_at timestamptz not null default now(),
  last_uid bigint,
  mode text not null default 'new_only',
  updated_at timestamptz not null default now(),
  constraint lead_email_ingestion_checkpoints_pkey primary key (mailbox, folder),
  constraint lead_email_ingestion_checkpoints_mode_chk check (mode in ('new_only', 'archive_only', 'active'))
);

create table if not exists public.lead_email_archive (
  id uuid primary key default gen_random_uuid(),
  mailbox text not null,
  folder text not null,
  imap_uid bigint,
  message_id text,
  subject text,
  from_address text,
  received_at timestamptz,
  source text,
  status text not null default 'historico_no_importar',
  parsed_data jsonb not null default '{}'::jsonb,
  raw_email_bucket text,
  raw_email_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_email_archive_source_chk check (source is null or source in ('Web', 'Maestro Fontanero')),
  constraint lead_email_archive_status_chk check (status in ('historico_no_importar', 'pendiente', 'procesado', 'revision', 'spam')),
  constraint lead_email_archive_uid_uniq unique (mailbox, folder, imap_uid),
  constraint lead_email_archive_message_id_uniq unique (mailbox, folder, message_id)
);

create table if not exists public.lead_email_archive_attachments (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.lead_email_archive(id) on delete cascade,
  bucket text not null,
  path text not null,
  filename text not null,
  mime text,
  size_bytes bigint,
  sha256 text,
  attachment_type text not null default 'doc',
  created_at timestamptz not null default now(),
  constraint lead_email_archive_attachments_type_chk check (attachment_type in ('foto', 'doc')),
  constraint lead_email_archive_attachments_path_uniq unique (bucket, path)
);

insert into storage.buckets (id, name, public)
values ('lead-email-archive', 'lead-email-archive', false)
on conflict (id) do nothing;

alter table public.lead_email_ingestion_checkpoints enable row level security;
alter table public.lead_email_archive enable row level security;
alter table public.lead_email_archive_attachments enable row level security;

drop policy if exists lead_email_archive_admin_read on public.lead_email_archive;
create policy lead_email_archive_admin_read
  on public.lead_email_archive for select
  using (public.is_admin_or_encargado());

drop policy if exists lead_email_archive_attachments_admin_read on public.lead_email_archive_attachments;
create policy lead_email_archive_attachments_admin_read
  on public.lead_email_archive_attachments for select
  using (public.is_admin_or_encargado());

drop policy if exists lead_email_checkpoint_admin_read on public.lead_email_ingestion_checkpoints;
create policy lead_email_checkpoint_admin_read
  on public.lead_email_ingestion_checkpoints for select
  using (public.is_admin_or_encargado());

comment on table public.lead_email_archive is
  'Archivo de correos de LEADS WEB. Los históricos se conservan sin crear filas en public.leads.';

comment on column public.lead_email_archive.status is
  'historico_no_importar bloquea expresamente la creación de un lead ERP.';

comment on table public.lead_email_ingestion_checkpoints is
  'Punto de activación y último UID procesado para trabajar solo con correo nuevo.';
