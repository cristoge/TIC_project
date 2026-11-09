# Plan de migración a AWS + Strands

Rediseño completo del proyecto: se abandona Supabase, LangGraph y Ollama, y el sistema pasa a ejecutarse íntegramente en AWS con un agente de **Strands** (RAG agéntico) desplegado en **Bedrock AgentCore**. El objetivo es un proyecto de portfolio reproducible con un solo comando de despliegue, que se mantiene en marcha unas 2 horas para grabar la demo y después se destruye.

> **Estado:** plan cerrado, **sin implementar**. Rama de trabajo: `migration`. Fecha: 2026-11-09.
> La base de datos empieza **vacía** (no se migran datos de Supabase) y la app Expo se **rehace desde cero**.

## Índice

- [Resumen de cambios](#resumen-de-cambios)
- [Problemas del código actual que motivan el cambio](#problemas-del-código-actual-que-motivan-el-cambio)
- [Arquitectura objetivo](#arquitectura-objetivo)
- [Autenticación](#autenticación)
- [Red](#red)
- [Base de datos](#base-de-datos)
- [Ingesta de PDFs](#ingesta-de-pdfs)
- [Búsqueda híbrida](#búsqueda-híbrida)
- [Modelos](#modelos)
- [Agente](#agente)
- [Funciones de estudio](#funciones-de-estudio)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Infraestructura como código](#infraestructura-como-código)
- [Desarrollo local](#desarrollo-local)
- [Evaluación](#evaluación)
- [Observabilidad](#observabilidad)
- [Costes](#costes)
- [Ciclo de la demo](#ciclo-de-la-demo)
- [Plan de implementación](#plan-de-implementación)
- [Pendiente](#pendiente)
- [Alternativas descartadas](#alternativas-descartadas)

---

## Resumen de cambios

| Área | Antes | Después |
|---|---|---|
| Autenticación | Supabase Auth, `user_id` en la URL sin validar | **Cognito** (User Pool + app client público); el `user_id` sale siempre del token |
| Base de datos | Supabase Postgres + pgvector | **RDS PostgreSQL** `db.t4g.micro` + pgvector, en subredes privadas |
| Almacenamiento de PDFs | Supabase Storage con URL pública | **S3 privado** + URLs prefirmadas (presigned POST) |
| LLM | Gemma vía Ollama local / Claude Haiku | **Amazon Nova 2 Lite** en Bedrock (serverless) |
| Embeddings | `nomic-embed-text` vía Ollama, 512 d | **Amazon Titan Text Embeddings V2**, 512 d |
| Búsqueda | Solo semántica, por documento, umbral 0.0 | **Híbrida** (léxica + semántica, RRF) + **reranker** Cohere Rerank 3.5, por proyecto |
| Orquestación | LangGraph (bucle ReAct hecho a mano) | **Strands Agents** (bucle de agente nativo) |
| Ámbito del chat | Un documento | **Un proyecto** con muchos documentos, varias conversaciones, citas |
| Ejecución del chat | FastAPI local con streaming | **AgentCore Runtime** (streaming nativo, JWT de Cognito) |
| API REST | FastAPI local | FastAPI en **Lambda + API Gateway** (sin streaming) |
| Ingesta | `BackgroundTasks` de FastAPI | **S3 → SQS (+DLQ) → Lambda**, idempotente |
| Resúmenes / flashcards | Tools ocultas en el chat, texto plano, no se guardan | **Funciones de primera clase**: botones + chat, salida estructurada, persistidas |
| Test de opción múltiple | No existía | **Nuevo** |
| Modo "chat simple" sin RAG | Existía | **Eliminado** |
| Infraestructura | Manual | **Infraestructura como código** (CDK, ver [decisión pendiente](#infraestructura-como-código)) |
| Región | — | `eu-central-1` (Fráncfort) |

---

## Problemas del código actual que motivan el cambio

| Problema | Dónde | Consecuencia |
|---|---|---|
| El `CHECK` de `processing_status` solo admite `pending/procesado/error`, pero el código escribe `processing/completed/failed` | `01_schema.sql`, `ingesta.py` | Con el esquema versionado, la ingesta falla (o la BD real ya no coincide con las migraciones) |
| `guardar_mensajes` inserta `tipo_solicitud = ""` | `messages.py` | Viola el `CHECK`; el historial no se guarda |
| Endpoints como `/projects/{user_id}` aceptan el `user_id` de la URL | `routers/*.py` | Cualquiera puede leer los datos de otro usuario |
| PDFs con `get_public_url` | `routers/documents.py` | Los documentos son públicos |
| Columna `usuarios.password_hash` | `01_schema.sql` | Las contraseñas no deben estar en la BD de la app |
| Resumen y flashcards existen como tools, pero la app no los expone y nada escribe en `agent_outputs` | `agents/tools2.py`, `mobile/` | Para el usuario, las funciones de estudio no existen |
| Flashcards como texto `PREGUNTA: … RESPUESTA: …` | `agents/tools2.py` | La app no puede mostrar un mazo |
| Chat, búsqueda e historial atados a `document_id` | todas las capas | No se puede conversar con un proyecto |
| Retriever con `similarity_threshold=0.0` | `agents/tools2.py` | El umbral no filtra nada |
| Tool `explicacion` obligatoria tras `retriever` | `agents/orquestador2.py` | Flujo fijo disfrazado de agente y una llamada al LLM de más |
| Ingesta en `BackgroundTasks` | `routers/documents.py` | Si el proceso muere, el documento queda en `processing` para siempre |
| Fragmentos de 500 caracteres (~100 tokens) | `ingesta.py` | Demasiado pequeños para tener sentido por sí solos |
| Tabla `embeddings` separada 1:1 de `document_chunks` | `01_schema.sql` | Un JOIN innecesario en cada búsqueda |
| `requirements.txt` incluye torch/CUDA y le faltan `langchain-anthropic`, `langchain-community`, `pypdf` | raíz | Varios GB sobrantes y dependencias que el código importa pero no declara |

---

## Arquitectura objetivo

```
                         ┌──────────────┐
                         │   Cognito    │  User Pool + app client público
                         └──────┬───────┘
                                │ token JWT
       ┌────────────────────────┼──────────────────────────────┐
       │                        │                              │
       ▼                        ▼                              │
┌─────────────┐       ┌────────────────────┐                   │
│  App Expo   │──────▶│ AgentCore Runtime  │  chat (streaming) │
│             │       │ agente Strands     │                   │
│             │       └─────────┬──────────┘                   │
│             │                 │                              │
│             │──────▶ API Gateway REST ──▶ Lambda API         │
│             │       (autorizador Cognito)  (FastAPI)         │
│             │                 │                              │
│             │── presigned POST ──▶ S3 ──evento──▶ SQS ──▶ Lambda de ingesta
└─────────────┘                                  └──▶ DLQ      │
                                                               │
            Lambda API, agente y Lambdas de trabajo usan los mismos servicios
                                │
                ┌───────────────┴────────────────┐
                ▼                                ▼
        RDS PostgreSQL + pgvector        Bedrock: Nova 2 Lite,
        (subredes privadas)              Titan Embeddings V2, Cohere Rerank 3.5
```

| Componente | Servicio | Responsabilidad |
|---|---|---|
| Identidad | Cognito | Registro, verificación de email, login, renovación de tokens |
| Chat | AgentCore Runtime | Agente Strands, streaming, validación del JWT de Cognito, aislamiento por sesión |
| API REST | API Gateway REST + Lambda (FastAPI) | Proyectos, documentos, URLs prefirmadas, resúmenes, flashcards, tests, intentos |
| Ingesta | S3 → SQS → Lambda | PDF → páginas → fragmentos → embeddings → BD |
| Generación asíncrona | SQS → Lambda | Resúmenes, flashcards y tests pedidos desde los botones |
| Datos | RDS PostgreSQL + pgvector | Datos relacionales, vectores y texto indexado |
| Modelos | Bedrock (serverless) | LLM, embeddings y reranker |

**Por qué el chat no va en Lambda:** AgentCore Runtime hace streaming de forma nativa, mientras que Lambda en Python solo lo consigue con Lambda Web Adapter. Al sacar el chat, la API REST ya no necesita streaming. **Por qué la API REST no va en AgentCore:** el Runtime expone un único punto de invocación de agente, no rutas REST.

---

## Autenticación

| Pieza | Decisión |
|---|---|
| User Pool | Login por email, registro abierto, verificación con código, política de contraseñas |
| App client | Público, sin secreto (app móvil) |
| API REST | Autorizador de Cognito en API Gateway: la Lambda solo recibe peticiones con token válido |
| Chat | Autorizador JWT de AgentCore Runtime (URL de configuración OIDC del User Pool + `allowedClients`) |
| Fila en `users` | Se crea en la primera petición (`INSERT … ON CONFLICT DO NOTHING`), **no** con un trigger de Cognito: funciona igual en local y en AWS |
| `get_current_user` | En AWS lee los datos del token que ya validó el autorizador; en local valida el JWT con las claves públicas (JWKS) de Cognito |
| Login en la app | Directo contra Cognito (`SignUp`, `ConfirmSignUp`, `InitiateAuth`, `ForgotPassword`); la contraseña nunca pasa por el backend |
| Tokens | Access token de 1 h, revocación de refresh tokens activada, guardados en `expo-secure-store` |

**Por qué el login no pasa por el backend:** la seguridad está en validar el token en cada petición, no en quién hace el login. El backend nunca ve contraseñas y Cognito aporta protección contra fuerza bruta y MFA.

**A tener en cuenta:**
- No dejar que el usuario modifique atributos que se usen para dar permisos (por ejemplo `custom:role`).
- `USER_PASSWORD_AUTH` envía la contraseña a Cognito por TLS. Para una app real, lo recomendado (RFC 8252) es la *managed login* de Cognito con PKCE (`expo-auth-session`).
- Se eliminan `/auth/register` y `/auth/login`; queda `/me` (leer y cambiar el nombre).

---

## Red

| Elemento | Decisión |
|---|---|
| VPC | Subredes **aisladas**, **sin NAT Gateway** (35 $/mes) |
| Endpoint de S3 | De tipo gateway (gratis) |
| Endpoints de interfaz | `bedrock-runtime`, `bedrock-agent-runtime` (reranker), ECR (`ecr.api`, `ecr.dkr`) para que AgentCore descargue la imagen del agente, y probablemente CloudWatch Logs |
| Acceso a RDS | Autenticación IAM (el token se firma en local; no hace falta Secrets Manager ni su endpoint) |
| Grupos de seguridad | Lambdas y AgentCore Runtime → RDS por el 5432 |
| AgentCore en VPC | Soportado (construct de CDK `aws_bedrockagentcore` con `RuntimeNetworkConfiguration.using_vpc`). Los Runtime creados desde mayo de 2026 **ya no traen** el acceso a S3 gestionado por AWS: la VPC tiene que darlo |
| SQS | Sin endpoint: es el servicio de Lambda el que lee la cola, no la función |
| IAM de Bedrock | Nova 2 Lite se usa a través del perfil `eu.`, que puede atender la petición en otra región europea: el permiso debe incluir el ARN del perfil **y** `arn:aws:bedrock:*::foundation-model/amazon.nova-2-lite-v1:0` |

---

## Base de datos

### Diagrama

```
users ──1:N── projects ──1:N── documents ──1:N── document_chunks (texto + embedding + tsvector)
                 │                 │
                 │                 ├──1:N── summaries
                 │                 ├──1:N── flashcard_decks ──1:N── flashcards
                 │                 └──1:N── quizzes ──1:N── quiz_questions
                 │                              └──1:N── quiz_attempts ──1:N── quiz_answers
                 │
                 └──1:N── conversations ──1:N── chat_messages ──N:M── document_chunks
                                                     │              (message_sources = citas)
                                                     └── summary_id / flashcard_deck_id / quiz_id
```

### Decisiones

- **Nombres en inglés**, sin caracteres no ASCII, `timestamptz` en todas las fechas.
- **Claves foráneas `NOT NULL`** con borrado en cascada.
- **El embedding vive en `document_chunks`**: desaparece la tabla `embeddings`.
- **`page_number` en cada fragmento**: permite citar la página.
- **Resúmenes, flashcards y tests son tablas propias** (desaparece `agent_outputs`).
- **Generación asíncrona**: `summaries`, `flashcard_decks` y `quizzes` tienen `status`.
- **Sin índice HNSW**: cada búsqueda se limita a un proyecto (miles de fragmentos), y la búsqueda exacta es rápida y precisa. Solo compensaría con decenas de miles, y entonces habría que activar `hnsw.iterative_scan`.
- **El idioma léxico está fijado a `spanish`**. Si se suben PDFs en otros idiomas, guardar el idioma por documento y generar el `tsvector` en la ingesta.

### SQL

```sql
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
  p_rrf_k           int default 60
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
```

> **Pendiente de detalle:** la tabla `conversations.summary` (resumen guardado de conversaciones largas) queda como mejora futura, no se implementa.

---

## Ingesta de PDFs

```
App ──1. POST /projects/{id}/documents──▶ API: crea la fila (status 'pending') + presigned POST
App ──2. sube el PDF directo──▶ S3  users/{uid}/projects/{pid}/{doc_id}.pdf
S3 ──evento ObjectCreated──▶ SQS ──(3 fallos)──▶ DLQ
SQS ──▶ Lambda de ingesta ──▶ Bedrock (Titan) ──▶ RDS (status 'ready' / 'failed')
App ──3. consulta GET /documents/{id} hasta ver 'ready'
```

| Paso | Decisión |
|---|---|
| Subida | **Presigned POST** (no PUT): permite fijar el tamaño máximo y exigir `application/pdf` |
| Cola | SQS con DLQ tras 3 intentos; limita la concurrencia para no saturar Bedrock |
| Idempotencia | Borrar los fragmentos del documento e insertar los nuevos en **una transacción**; repetir el mensaje da el mismo resultado |
| Extracción | PyMuPDF, página a página |
| Texto por página | Se guarda también en S3 (`documents/{id}/pages.json`); lo usan el resumen, las flashcards y el test |
| PDF escaneado | Sin texto extraíble → `failed` con mensaje claro. OCR con Textract como mejora futura |
| Troceado | Se concatenan las páginas guardando dónde empieza cada una; troceado recursivo (párrafos → frases), **~1000–1200 caracteres con ~15 % de solapamiento**; cada fragmento lleva la página donde empieza |
| Embeddings | Titan V2, 512 dimensiones, ~8 llamadas en paralelo, reintentos con espera creciente ante límites de velocidad |
| Error | `status = 'failed'` + `error_message` legible, y se relanza la excepción para que SQS reintente |
| Borrado | Borrar la fila (los fragmentos caen en cascada) **y** el objeto de S3 |
| Dependencias | PyMuPDF + `langchain-text-splitters` (o troceador propio). LangChain desaparece |

---

## Búsqueda híbrida

```
pregunta ──▶ embedding (Titan) ──┐
          └─▶ tsquery (OR) ──────┼──▶ hybrid_search (RRF, 40 candidatos) ──▶ Cohere Rerank 3.5 ──▶ top 8
```

| Pieza | Decisión |
|---|---|
| Léxica | Full-text search de Postgres en español (`tsvector` + GIN), con **OR** entre términos |
| Semántica | pgvector, distancia coseno, búsqueda exacta |
| Fusión | **RRF**, k = 60, con *full outer join* para no perder fragmentos que solo encuentra una de las dos |
| Candidatos | 40 → reranker → **8** para el LLM |
| Reranker | Cohere Rerank 3.5 (`eu-central-1`). Si falla, se usa el orden de RRF y el chat no se rompe |
| "No está en tus documentos" | Se decide en el backend con `semantic_similarity` del mejor resultado (RRF no da puntuaciones absolutas) |
| Consulta | El agente la reescribe completa y autónoma ("¿y lo del tema anterior?" → "mitosis en el tema 2") |

**Por qué no BM25 real:** en RDS no hay extensiones de BM25 (`pg_search`, `pg_textsearch`). `ts_rank` no tiene IDF, pero con RRF solo importa el orden de cada lista, así que la diferencia apenas se nota. En la documentación se llama "búsqueda híbrida léxica + semántica con RRF", no BM25.

---

## Modelos

Todos son **serverless** en Bedrock (pago por token, sin endpoints que desplegar).

| Uso | Modelo | Identificador | Precio `eu-central-1` (por 1M tokens) |
|---|---|---|---|
| LLM (agente y generación) | Amazon Nova 2 Lite | `eu.amazon.nova-2-lite-v1:0` (perfil de inferencia) | 0,43 $ entrada / 3,60 $ salida |
| Embeddings | Amazon Titan Text Embeddings V2 | `amazon.titan-embed-text-v2:0` | — |
| Reranker | Cohere Rerank 3.5 | `cohere.rerank-v3-5:0` | — |
| Alternativa al LLM | gpt-oss-120b | `openai.gpt-oss-120b-1:0` | 0,20 $ / 0,79 $ |

### Por qué Nova 2 Lite

- Se quería controlar `temperature`, `top_p` y `top_k`. **Los Claude de la generación 4.7 en adelante (incluido Haiku 5.5) rechazan esos parámetros** con un error 400.
- Nova 2 Lite es actual, de Amazon, con 1M de tokens de contexto, 65K de salida y uso de tools nativo.
- Admite `temperature` (0–1, por defecto 0,7) y `topP` (por defecto 0,9). `topK` va como campo adicional del modelo (pendiente de confirmar).
- Tiene razonamiento opcional (`low`/`medium`/`high`). **Con `high` no se pueden enviar parámetros de muestreo.**

### Parámetros de partida (se calibran con la evaluación)

| Uso | `temperature` | Razonamiento |
|---|---|---|
| Chat (agente) | 0,2 | Desactivado; probar `medium` (AWS lo recomienda para flujos con varias tools) |
| Resumen | 0,3 | Desactivado |
| Test | 0,5 | Desactivado |
| Flashcards | 0,7 | Desactivado |

`topP` y `topK` se quedan en sus valores por defecto: así se puede atribuir cada cambio a la temperatura.

---

## Agente

**RAG agéntico** con Strands, desplegado en AgentCore Runtime.

| Aspecto | RAG clásico (versión actual) | Diseño nuevo |
|---|---|---|
| Recuperación | Siempre una vez, con la pregunta literal | El modelo decide si busca, qué y en qué documentos |
| Búsquedas por turno | Una | Varias si hace falta (comparaciones) |
| Consulta | Literal | Reescrita y autónoma |
| Acciones | Solo responder | Crea resúmenes, flashcards y tests |

No incluye autoevaluación del contexto (*corrective RAG*) ni varios agentes: quedan como evolución posible.

### Tools

| Tool | Qué hace |
|---|---|
| `search_documents(query, document_ids=None)` | Búsqueda híbrida + reranker. Devuelve fragmentos numerados `[1]…[8]` con documento y página, y guarda las fuentes para `message_sources` |
| `list_documents()` | Documentos del proyecto (nombre, id, estado), para traducir "el tema 3" a un `document_id` |
| `create_summary(document_id)` | Llama al servicio, guarda el resultado y devuelve solo una confirmación con el id |
| `create_flashcards(document_id, count=10, topic=None)` | Igual, con salida estructurada |
| `create_quiz(document_id, count=10, topic=None)` | Igual, con salida estructurada |

Las tools de creación **devuelven solo una confirmación**: si devolvieran el contenido, el modelo lo repetiría (doble coste y espera). La app muestra la tarjeta a partir de un evento del streaming.

### Ejecución de cada turno

1. Cargar de `chat_messages` los últimos mensajes de la conversación, **hasta ~4.000 tokens**.
2. Crear el `Agent` con `BedrockModel` (Nova 2 Lite).
3. `stream_async(..., invocation_state={"user_id", "project_id", "conversation_id"})`.
4. Al terminar, guardar la pregunta, la respuesta, sus fuentes y el artefacto creado si lo hay.

| Decisión | Motivo |
|---|---|
| Sin gestor de sesiones de Strands ni AgentCore Memory | `chat_messages` es la única fuente de verdad; dos historiales acaban desincronizados |
| Solo se guarda texto + fuentes, no las llamadas a tools | En cada turno se vuelve a buscar; más barato y siempre al día |
| Límite de ~5 llamadas a tools por turno | Evita bucles; se implementa con un hook de Strands (pendiente de confirmar cuál) |

### Seguridad

- **Las tools nunca reciben `user_id` ni `project_id` del modelo**: los leen de `ToolContext.invocation_state`, que rellena el servidor a partir del token.
- **Todo `document_id` que pase el modelo se valida** contra el proyecto. Un PDF puede contener texto malicioso (*prompt injection*); así el alcance queda limitado a los documentos de ese proyecto.
- System prompt: responder **solo** con información recuperada, citar con `[n]`, y decir claramente cuando algo no está en los documentos.

### Eventos del streaming (NDJSON)

```
{"type":"token","data":"La mitosis..."}
{"type":"sources","data":[{"n":1,"document":"Tema3.pdf","page":12}]}
{"type":"artifact","kind":"summary|flashcards|quiz","id":"<id>"}
{"type":"end","message_id":"..."}
```

---

## Funciones de estudio

Cada función tiene **dos entradas y un solo servicio**: un botón en la app (endpoint REST, asíncrono) y una tool del agente (síncrona, porque AgentCore admite sesiones largas).

```
POST /documents/{id}/summaries → fila con status 'pending' → SQS → Lambda de generación → 'ready'
La app consulta el estado hasta que está listo
```

**Por qué asíncrono desde los botones:** generar puede tardar 20–40 s, y API Gateway corta las peticiones a los 29 s.

### Resumen

- **Texto de entrada**: el texto completo por páginas (`pages.json`), **no** los fragmentos de búsqueda, que se solapan.
- **Una sola pasada** (se elimina el paso de borrador + corrección).
- **Salida estructurada**, guardada en `summaries.content` (`jsonb`):

```python
class SummarySection(BaseModel):
    heading: str
    points: list[str]        # 2-5 short bullet points
    pages: list[int]

class KeyTerm(BaseModel):
    term: str
    definition: str

class Summary(BaseModel):
    overview: str            # 2-3 sentences
    sections: list[SummarySection]
    key_terms: list[KeyTerm]
```

### Flashcards

- **Texto de entrada**: con tema, los fragmentos de `hybrid_search` para ese tema dentro del documento; sin tema, páginas repartidas por todo el documento.
- **Sin repeticiones**: se pasan las preguntas de mazos anteriores con la instrucción "no repitas estas".
- **Validación**: número de tarjetas, sin preguntas duplicadas, longitudes máximas.

```python
class Flashcard(BaseModel):
    question: str            # max ~15 words
    answer: str              # max ~40 words
    page: int

class FlashcardSet(BaseModel):
    cards: list[Flashcard]
```

### Test de opción múltiple

- Mismo texto de entrada que las flashcards.
- **Las opciones se barajan en el backend**: los LLM tienden a colocar la respuesta correcta en las primeras posiciones.
- **Corrección en el servidor**: la app envía las respuestas y recibe la nota con las explicaciones; la respuesta correcta no viaja al móvil antes de contestar.
- **Validación**: exactamente 4 opciones distintas y `correct_index` válido.

```python
class QuizQuestion(BaseModel):
    question: str
    options: list[str]       # exactly 4
    correct_index: int
    explanation: str
    page: int

class Quiz(BaseModel):
    questions: list[QuizQuestion]
```

**Descartado:** repaso espaciado de flashcards (SM-2). Es otro producto.

---

## Estructura del repositorio

```
backend/
├── domain/                # entidades y reglas: Project, Document, FlashcardDeck, Quiz...
├── services/              # casos de uso: search, generate_summary, generate_flashcards,
│                          # generate_quiz, grade_quiz, ingest_document
├── adapters/              # RDS (psycopg), Bedrock (LLM, embeddings, rerank), S3, SQS
├── entrypoints/
│   ├── api/               # FastAPI → Lambda + API Gateway
│   ├── agent/             # Strands → AgentCore Runtime
│   ├── ingest/            # handler de SQS → Lambda (PDFs)
│   └── generation/        # handler de SQS → Lambda (resúmenes, flashcards, tests)
├── migrations/            # esquema SQL
└── tests/
    ├── unit/              # servicios con fakes de los adaptadores
    └── integration/       # contra pgvector en Docker
infra/                     # infraestructura como código: AuthStack y AppStack
eval/                      # conjunto de evaluación y scripts
mobile/                    # app Expo nueva (proyecto aparte, después del backend)
docs/
```

- **Arquitectura hexagonal**: los puntos de entrada solo traducen peticiones; toda la lógica está en `services/`, y el acceso a AWS y a la BD en `adapters/`.
- **boto3 se usa en `adapters/`** (presigned POST, Bedrock, SQS). La infraestructura **nunca** se crea con boto3.
- **Se elimina**: `src/` actual, `src/supabase/`, LangGraph, LangChain, Ollama, torch/CUDA de las dependencias.

---

## Infraestructura como código

> **Decisión pendiente: CDK o Terraform.** La recomendación técnica es CDK; el autor se inclina por Terraform porque es más demandado en el mercado laboral.

| | CDK | Terraform |
|---|---|---|
| Lenguaje | Python (el mismo que el backend) | HCL |
| Estado | Lo gestiona CloudFormation dentro de AWS | Fichero de estado propio (p. ej. en S3) |
| Abstracción | Alta (`ec2.Vpc` crea subredes, rutas y endpoints) | Explícita, recurso a recurso |
| AgentCore | Construct oficial `aws_bedrockagentcore` | Sin comprobar |
| Nubes | Solo AWS | Cualquiera |
| Mercado laboral | Habitual en equipos que solo usan AWS | Más pedido en general |

Con cualquiera de las dos, la estructura es la misma:

| Stack | Contenido | Cuándo está desplegado |
|---|---|---|
| `AuthStack` | Cognito | Siempre (sin coste sin usuarios activos); hace falta para desarrollar en local |
| `AppStack` | VPC, endpoints, RDS, S3, SQS + DLQ, Lambdas, API Gateway, AgentCore Runtime | Solo durante la demo |

**Para que la destrucción sea completa:** todos los recursos con política de borrado (`RemovalPolicy.DESTROY` en CDK), S3 con borrado automático de objetos, RDS sin snapshot final, retención limitada en los grupos de logs.

---

## Desarrollo local

| Pieza | En local |
|---|---|
| Base de datos | `docker compose` con Postgres + pgvector, mismo esquema y mismo driver (`psycopg`) que en AWS |
| API | FastAPI con `uvicorn` |
| Agente | Strands como proceso Python normal (el envoltorio de AgentCore también se ejecuta en local) |
| Bedrock | Llamadas reales con las credenciales del desarrollador (céntimos) |
| Autenticación | `AuthStack` desplegado; el backend valida el JWT con las claves públicas de Cognito |
| App | Expo Go |

**Por qué RDS + `psycopg` y no Aurora Data API:** en local no existe nada que hable el protocolo de Data API. Con RDS, lo que funciona en local funciona igual en AWS.

---

## Evaluación

| Qué se mide | Cómo |
|---|---|
| **Búsqueda** | 20–30 preguntas sobre los PDFs, cada una con su fragmento correcto. Acierto en el top 8 con tres configuraciones: solo semántica, híbrida, híbrida + reranker |
| **Fidelidad de las respuestas** | Un LLM evaluador comprueba que la respuesta se apoya en los fragmentos recuperados |
| **Uso de tools** | Que el agente busque antes de responder y no invente cuando la información no está |
| **Parámetros** | Comparar temperatura, razonamiento y tamaño de fragmento con las mismas preguntas |

El resultado (tabla comparativa) es uno de los entregables principales del portfolio. Falta decidir el modelo evaluador; lo lógico es uno distinto del que responde.

---

## Observabilidad

- **AgentCore Observability**: trazas del agente en CloudWatch (tools llamadas, tokens, latencias) a partir de la telemetría OpenTelemetry de Strands.
- **Lambdas**: CloudWatch Logs con retención corta.
- **Capturas para la documentación**: el recorrido de una pregunta (búsqueda → reranker → respuesta) con tiempos y tokens.

---

## Costes

Precios comprobados con la API de precios de AWS (`eu-west-1`, salvo que se indique). Los de `eu-central-1` son parecidos.

| Recurso | Precio | Durante 2 h de demo |
|---|---|---|
| RDS `db.t4g.micro` | 0,017 $/h + gp3 0,127 $/GB-mes | ~0,05 $ |
| Endpoint de interfaz de VPC | 0,011 $/h cada uno | ~0,15 $ (5–6 endpoints) |
| NAT Gateway (**no se usa**) | 0,048 $/h ≈ 35 $/mes | — |
| Nova 2 Lite (`eu-central-1`) | 0,43 $ / 3,60 $ por 1M tokens | ~0,30 $ para ~200 preguntas |
| Lambda, API Gateway, SQS, S3, Cognito | Por uso | Céntimos |
| **Total estimado** | | **< 2 $** |

**Medidas de seguridad:** alerta de presupuesto en AWS Budgets antes del primer despliegue, y destruir el `AppStack` al acabar (no parar RDS: una instancia parada se vuelve a encender sola a los 7 días).

---

## Ciclo de la demo

1. **Un día antes:** comprobar en la consola de Bedrock el acceso a los modelos en `eu-central-1`.
2. **Desplegar** el `AppStack` (RDS tarda ~10 min en crearse).
3. **Usar la app**: subir PDFs, chatear, generar resúmenes, flashcards y tests, ejecutar la evaluación.
4. **Capturar** (después no quedará nada desplegado):
   - [ ] Vídeo de la demo
   - [ ] Capturas de pantalla
   - [ ] Tabla de la evaluación
   - [ ] Trazas de AgentCore Observability
   - [ ] Diagrama de arquitectura
   - [ ] Coste real en Cost Explorer (tarda ~24 h en aparecer)
5. **Destruir** el `AppStack` y comprobar que no queda nada (RDS, snapshots, S3, logs).

---

## Plan de implementación

| # | Tarea | Depende de |
|---|---|---|
| 1 | Entorno local (`docker compose` + pgvector) y esquema | — |
| 2 | Ingesta: PDF → páginas → fragmentos → embeddings | 1 |
| 3 | Búsqueda híbrida + reranker + conjunto de evaluación de la búsqueda | 2 |
| 4 | Servicios de resumen, flashcards y test (incluida la corrección) | 2, 3 |
| 5 | Contrato de la API y API REST (FastAPI) | 4 |
| 6 | Agente Strands (tools, historial, streaming, límites, system prompt) | 3, 4 |
| 7 | Infraestructura como código (`AuthStack` + `AppStack`) | 5, 6 |
| 8 | Despliegue de prueba y evaluación completa | 7 |
| 9 | App Expo nueva | 5, 6 |
| 10 | Documentación final del portfolio | 8, 9 |

---

## Pendiente

### Decisiones

- [ ] **CDK o Terraform**.
- [ ] Modelo evaluador para la fidelidad de las respuestas.
- [ ] Login en la app: pantallas propias con `fetch` a Cognito o *managed login* con PKCE.

### Se definen al implementar

- [ ] Contrato de la API (endpoints, mensaje del agente, eventos): primera parte de la tarea 5.
- [ ] Límites concretos: peticiones por usuario (API Gateway y AgentCore), tamaño y número de PDFs, preguntas por test, llamadas a tools por turno.
- [ ] System prompt del agente.

### Comprobaciones técnicas

- [ ] Cómo se envía `topK` a Nova 2 Lite.
- [ ] Hook de Strands para limitar las llamadas a tools por turno.
- [ ] Endpoints exactos que necesita AgentCore Runtime dentro de la VPC (ECR, Logs…).
- [ ] Soporte de AgentCore en Terraform (si se elige Terraform).

---

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Mantener Supabase | Requisito: todo en AWS |
| Aurora Serverless v2 + Data API | Sin equivalente en local; ~15 s de arranque tras la pausa |
| NAT Gateway | 35 $/mes; los endpoints de VPC cubren lo necesario |
| Bedrock Knowledge Bases | Te quita el control del troceado, las páginas y las citas, que es justo lo que enseña el proyecto |
| OpenSearch (gestionado o Serverless) | BM25 real, pero ~28 $/mes o ~180 $/mes y una segunda BD que sincronizar |
| BM25 implementado a mano | Con RRF la diferencia con `ts_rank` apenas se nota |
| Índice HNSW | Innecesario con unos miles de fragmentos por proyecto |
| Claude Haiku 5.5 / Claude 4.7+ | No admiten `temperature`/`top_p`/`top_k` |
| Claude Sonnet 4.6 / Haiku 4.5 | Admiten muestreo, pero son de la generación anterior |
| Chat en Lambda con Lambda Web Adapter | El streaming en Python es la pieza más dudosa; AgentCore lo resuelve de forma nativa |
| AgentCore Memory / Gateway / Identity de salida | Duplican el historial o no hay APIs externas que integrar |
| Trigger de Cognito para crear el usuario | No se puede probar en local |
| La app envía el historial en cada petición | Manipulable y más pesado; la BD hace falta igualmente |
| Modo "chat simple" sin RAG | Un envoltorio de un chat genérico; no aporta nada al portfolio |
| Repaso espaciado (SM-2) | Es otro producto |
| Crear infraestructura con scripts de boto3 | Sin estado, sin borrado, no reproducible |
