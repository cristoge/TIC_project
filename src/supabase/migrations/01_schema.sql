create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar unique not null,
  password_hash varchar,
  nombre varchar,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.usuarios(id) on delete cascade,
  nombre varchar not null,
  descripcion text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  nombre_original varchar not null,
  tamaño_bytes integer,
  ruta_almacenamiento varchar,
  processing_status varchar default 'pending' check (processing_status in ('pending', 'procesado', 'error')),
  error_mensaje text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  contenido text not null,
  numero_chunk integer not null,
  tokens_count integer,
  created_at timestamp default now()
);

create extension if not exists vector;

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid references public.document_chunks(id) on delete cascade,
  vector vector(512),
  modelo_embedding varchar not null,
  created_at timestamp default now()
);

create table public.agent_outputs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  tipo_agente varchar check (tipo_agente in ('resumen', 'corrector', 'test', 'flashcards')),
  contenido_json jsonb not null,
  metadata jsonb,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  rol varchar check (rol in ('user', 'assistant')),
  contenido text not null,
  tipo_solicitud varchar check (tipo_solicitud in ('resumen', 'corrector', 'test', 'flashcards', 'pregunta_libre')),
  agent_output_id uuid references public.agent_outputs(id) on delete set null,
  created_at timestamp default now()
);


create index on public.projects(user_id);
create index on public.documents(project_id);
create index on public.documents(project_id, processing_status);
create index on public.document_chunks(document_id);
create index on public.embeddings(chunk_id);
create index on public.agent_outputs(document_id);
create index on public.agent_outputs(document_id, tipo_agente);
create index on public.chat_messages(project_id);
create index on public.chat_messages(project_id, created_at);
