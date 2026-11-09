create extension if not exists vector;

create type document_status   as enum ('pending', 'processing', 'ready', 'failed');
create type generation_status as enum ('pending', 'ready', 'failed');
create type message_role      as enum ('user', 'assistant');

-- Shared trigger: keeps updated_at current
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Users ------------------------------------------------------------------

create table users (
  id          uuid primary key,                       -- Cognito "sub"
  email       text not null unique,
  name        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Projects and documents -------------------------------------------------

create table projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on projects (user_id);

create table documents (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null,
  s3_key        text not null unique,
  size_bytes    bigint,
  page_count    int,
  status        document_status not null default 'pending',
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on documents (project_id);

create table document_chunks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  chunk_index     int  not null,
  page_number     int  not null,                      -- page where the chunk starts
  content         text not null,
  token_count     int,
  embedding       vector(512) not null,
  embedding_model text not null,
  content_tsv     tsvector generated always as (to_tsvector('spanish', content)) stored,
  unique (document_id, chunk_index)                   -- also serves as the document_id index
);
create index on document_chunks using gin (content_tsv);

-- Summaries --------------------------------------------------------------

create table summaries (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  status        generation_status not null default 'pending',
  content       jsonb,                                -- structured summary; null until ready
  model         text not null,
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on summaries (document_id, created_at desc);

-- Flashcards -------------------------------------------------------------

create table flashcard_decks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  topic           text,                               -- optional focus ("mitosis")
  requested_count int  not null,
  status          generation_status not null default 'pending',
  model           text not null,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on flashcard_decks (document_id, created_at desc);

create table flashcards (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid not null references flashcard_decks(id) on delete cascade,
  position    int  not null,
  question    text not null,
  answer      text not null,
  page_number int  not null,
  unique (deck_id, position)
);

-- Quizzes ----------------------------------------------------------------

create table quizzes (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  topic           text,
  requested_count int  not null,
  status          generation_status not null default 'pending',
  model           text not null,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on quizzes (document_id, created_at desc);

create table quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references quizzes(id) on delete cascade,
  position      int  not null,
  question      text not null,
  options       text[] not null check (cardinality(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation   text not null,
  page_number   int  not null,
  unique (quiz_id, position)
);

create table quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references quizzes(id) on delete cascade,
  score      int  not null,
  total      int  not null,
  created_at timestamptz not null default now()
);
create index on quiz_attempts (quiz_id, created_at desc);

create table quiz_answers (
  attempt_id     uuid not null references quiz_attempts(id) on delete cascade,
  question_id    uuid not null references quiz_questions(id) on delete cascade,
  selected_index smallint not null check (selected_index between 0 and 3),
  is_correct     boolean  not null,
  primary key (attempt_id, question_id)
);

-- Chat -------------------------------------------------------------------

create table conversations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on conversations (project_id, updated_at desc);

create table chat_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations(id) on delete cascade,
  role              message_role not null,
  content           text not null,
  summary_id        uuid references summaries(id) on delete set null,        -- artifact created in this turn
  flashcard_deck_id uuid references flashcard_decks(id) on delete set null,
  quiz_id           uuid references quizzes(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index on chat_messages (conversation_id, created_at);

create table message_sources (
  message_id uuid not null references chat_messages(id) on delete cascade,
  chunk_id   uuid not null references document_chunks(id) on delete cascade,
  rank       int  not null,                           -- the [n] shown in the answer
  primary key (message_id, chunk_id)
);

-- A new message moves its conversation to the top of the list
create function touch_conversation() returns trigger language plpgsql as $$
begin
  update conversations set updated_at = now() where id = new.conversation_id;
  return new;
end $$;

create trigger chat_messages_touch_conversation
  after insert on chat_messages for each row execute function touch_conversation();

create trigger users_updated_at           before update on users           for each row execute function set_updated_at();
create trigger projects_updated_at        before update on projects        for each row execute function set_updated_at();
create trigger documents_updated_at       before update on documents       for each row execute function set_updated_at();
create trigger summaries_updated_at       before update on summaries       for each row execute function set_updated_at();
create trigger flashcard_decks_updated_at before update on flashcard_decks for each row execute function set_updated_at();
create trigger quizzes_updated_at         before update on quizzes         for each row execute function set_updated_at();
create trigger conversations_updated_at   before update on conversations   for each row execute function set_updated_at();

-- Hybrid search: lexical (FTS) + semantic (pgvector) fused with RRF ----------

create function hybrid_search(
  p_project_id      uuid,
  p_query_text      text,
  p_query_embedding vector(512),
  p_candidates      int default 40,
  p_rrf_k           int default 60,
  p_document_ids    uuid[] default null              -- optional filter: only these documents
)
returns table (chunk_id uuid, document_id uuid, document_name text, page_number int,
               content text, rrf_score float, semantic_similarity float)
language sql stable as $$
  with semantic as (
    select c.id,
           1 - (c.embedding <=> p_query_embedding) as similarity,
           row_number() over (order by c.embedding <=> p_query_embedding) as rank
    from document_chunks c
    join documents d on d.id = c.document_id
    where d.project_id = p_project_id and d.status = 'ready'
      and (p_document_ids is null or d.id = any(p_document_ids))
    order by c.embedding <=> p_query_embedding
    limit p_candidates
  ),
  query as (
    -- OR between terms; cast directly so already-stemmed lexemes are not stemmed twice
    select replace(plainto_tsquery('spanish', p_query_text)::text, '&', '|')::tsquery as q
  ),
  lexical as (
    select c.id,
           row_number() over (order by ts_rank_cd(c.content_tsv, query.q) desc) as rank
    from document_chunks c
    join documents d on d.id = c.document_id
    cross join query
    where d.project_id = p_project_id and d.status = 'ready'
      and (p_document_ids is null or d.id = any(p_document_ids))
      and c.content_tsv @@ query.q
    order by ts_rank_cd(c.content_tsv, query.q) desc
    limit p_candidates
  ),
  fused as (
    select coalesce(s.id, l.id) as id,
           coalesce(1.0 / (p_rrf_k + s.rank), 0)
         + coalesce(1.0 / (p_rrf_k + l.rank), 0) as score,
           s.similarity
    from semantic s
    full outer join lexical l on l.id = s.id
  )
  select c.id, d.id, d.name, c.page_number, c.content, f.score, f.similarity
  from fused f
  join document_chunks c on c.id = f.id
  join documents d on d.id = c.document_id
  order by f.score desc;
$$;
