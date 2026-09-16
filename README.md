# TIC Project — RAG conversacional sobre documentos PDF

Sistema de generación aumentada por recuperación (RAG) que permite a un estudiante subir sus propios PDFs (apuntes, libros, artículos) y hacer preguntas sobre su contenido en lenguaje natural desde una app móvil. Las respuestas se generan a partir de fragmentos recuperados semánticamente del documento, no del conocimiento general del modelo.

Trabajo de fin de especialización — Inteligencia Artificial y Big Data, Institut TIC Barcelona. El paper completo está en [`docs/paper_overleaf.pdf`](docs/paper_overleaf.pdf).

## Índice

- [Arquitectura](#arquitectura)
- [Stack](#stack)
- [Funcionalidades](#funcionalidades)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Puesta en marcha](#puesta-en-marcha)
- [API](#api)
- [Esquema de base de datos](#esquema-de-base-de-datos)
- [Evolución del agente](#evolución-del-agente)
- [Limitaciones conocidas](#limitaciones-conocidas)

## Arquitectura

El sistema está dividido en tres capas comunicadas mediante REST y Server-Sent Events (SSE) para el streaming en tiempo real:

```
┌─────────────────────────────────────────────┐
│  App móvil (React Native / Expo)             │
│  Biblioteca de documentos · Chat con SSE     │
└───────────────┬───────────────────────────────┘
                │ REST (subida PDF, consultas) · SSE (tokens)
┌───────────────▼───────────────────────────────┐
│  Backend (FastAPI, ASGI async)                │
│  Ingesta PDF (chunking + embeddings)          │
│  Agente LangGraph (orquestador + tools)       │
└───────┬─────────────────────────┬─────────────┘
        │ embeddings              │ LLM
┌───────▼───────────┐   ┌─────────▼─────────────┐
│ Ollama (local)     │   │ LLM: Anthropic API /  │
│ nomic-embed-text   │   │ Ollama (Gemma)        │
└────────────────────┘   └────────────────────────┘
┌─────────────────────────────────────────────┐
│  Supabase                                     │
│  PostgreSQL (relacional) · pgvector (512d)   │
│  Storage (PDFs originales)                    │
└─────────────────────────────────────────────┘
```

- **App móvil**: dos pantallas principales, biblioteca de documentos y chat. El chat recibe la respuesta token a token vía SSE y ofrece accesos directos para generar resumen o flashcards con un toque.
- **Backend**: expone endpoints de ingesta (subida, chunking, embeddings) y de conversación (ejecución del agente LangGraph con streaming SSE). Corre de forma asíncrona sobre ASGI para manejar sesiones concurrentes.
- **Base de datos**: Supabase combina PostgreSQL relacional, `pgvector` para búsqueda semántica (similitud coseno) y Storage para los PDFs originales, todo en un único servicio.

## Stack

| Capa | Tecnología |
|---|---|
| Móvil | React Native + Expo Router, Zustand, TypeScript |
| Backend | FastAPI (async), LangGraph, LangChain |
| Orquestación de agente | LangGraph — patrón ReAct con `bind_tools` |
| Embeddings | `nomic-embed-text-v2-moe` (512 dimensiones) vía Ollama local |
| LLM | Configurable: `ChatAnthropic` (Claude Haiku) o `ChatOllama` (Gemma, local) |
| Base de datos | Supabase (PostgreSQL + `pgvector` + Storage) |
| Auth | Supabase Auth |

## Funcionalidades

- Subida de PDFs y gestión de proyectos/documentos por usuario.
- Chat conversacional sobre el contenido de un documento, con historial persistente entre sesiones.
- Recuperación semántica (retriever) con umbral de similitud y top-k configurables.
- Generación de resúmenes estructurados (con paso de borrador + corrección).
- Generación de flashcards de estudio.
- Explicación de conceptos usando el contexto recuperado y el historial de la conversación.
- Streaming de respuesta token a token (SSE) hacia la app móvil.
- Modo "simple chat" sin RAG, para conversación libre sin documento asociado.

## Estructura del repositorio

```
src/
├── main.py                  # App FastAPI, registro de routers
├── config.py                 # Clientes Supabase, modelo de embeddings y LLM
├── ingesta.py                 # Extracción, chunking y embeddings de PDFs
├── retr.py                    # Búsqueda semántica (RPC match_embeddings)
├── messages.py                 # Persistencia y lectura del historial de chat
├── routers/
│   ├── auth.py                 # Registro, login, perfil
│   ├── projects.py             # CRUD de proyectos
│   ├── documents.py            # Subida, listado, borrado de documentos
│   ├── chat.py                 # Chat RAG sobre un documento (streaming SSE)
│   └── simple_chat.py          # Chat libre sin recuperación
├── agents/
│   ├── orquestador2.py         # Agente actual: grafo con tool calling (ReAct)
│   ├── tools2.py                # Tools: retriever, resumen, flashcards, explicacion
│   ├── state.py                  # Estado del agente (lista de mensajes)
│   ├── simple_graph.py           # Grafo del modo simple chat
│   └── simple_state.py
└── supabase/migrations/
    ├── 01_schema.sql            # Tablas: usuarios, projects, documents,
    │                             #   document_chunks, embeddings, agent_outputs,
    │                             #   chat_messages
    ├── 02_functions.sql          # match_embeddings() — búsqueda por similitud coseno
    └── 03_triggers.sql           # Trigger para crear fila en usuarios al registrarse

mobile/
├── src/app/                    # Rutas (Expo Router): auth (login/registro),
│                                 # app (home, proyectos, documento, ajustes)
├── src/components/              # Chat.tsx, PaywallModal.tsx
├── src/services/                 # Clientes REST/SSE hacia el backend
└── src/store/                    # Estado global (auth, tema) con Zustand

docs/
└── paper_overleaf.pdf           # Paper que documenta el diseño del sistema
```

## Puesta en marcha

### Requisitos previos

- Python 3.11+
- Node.js 18+ y npm
- Una instancia de [Supabase](https://supabase.com) (proyecto con extensión `pgvector` habilitada)
- [Ollama](https://ollama.com) corriendo localmente (o accesible por red) con el modelo `nomic-embed-text-v2-moe` descargado, para generar embeddings
- Opcional: una API key de Anthropic si se usa Claude como LLM en lugar de un modelo local vía Ollama

### 1. Base de datos (Supabase)

Ejecuta las migraciones en orden sobre el SQL editor de tu proyecto Supabase:

```
src/supabase/migrations/01_schema.sql
src/supabase/migrations/02_functions.sql
src/supabase/migrations/03_triggers.sql
```

Crea además un bucket de Storage llamado `documents` (usado por `routers/documents.py` para guardar los PDFs originales).

### 2. Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Crea un archivo `.env` en la raíz del proyecto (o en `src/`, junto a `config.py`) con:

```env
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_KEY=<anon-key>
SUPABASE_SERVICE_KEY=<service-role-key>
OLLAMA_URL=http://localhost:11434
# ANTHROPIC_API_KEY=<solo si usas ChatAnthropic en config.py>
```

En `src/config.py` se define qué LLM usa el agente (`chat_model`). Por defecto usa un modelo Gemma local vía Ollama; para usar Claude Haiku, descomenta la línea de `ChatAnthropic` y comenta la de `ChatOllama`.

Levanta el servidor:

```bash
cd src
uvicorn main:app --reload
```

La API queda disponible en `http://127.0.0.1:8000`.

### 3. App móvil

```bash
cd mobile
npm install
npx expo start
```

La URL del backend se define en `mobile/src/services/config.ts` (`10.0.2.2:8000` para emulador Android, `127.0.0.1:8000` para iOS/web). Ajusta esta constante si el backend corre en otra máquina o puerto.

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Registro de usuario |
| POST | `/auth/login` | Login, devuelve `access_token` |
| GET/PATCH | `/auth/me` | Perfil del usuario autenticado |
| GET/POST | `/projects/{user_id}` \| `/projects/` | Listar / crear proyectos |
| PATCH/DELETE | `/projects/{project_id}` | Renombrar / borrar proyecto |
| GET | `/documents/{project_id}` | Documentos de un proyecto |
| POST | `/documents/{project_id}` | Subir PDF (dispara ingesta en background) |
| GET | `/documents/{document_id}/status` | Estado de procesamiento del PDF |
| PATCH/DELETE | `/documents/{document_id}` | Renombrar / borrar documento |
| POST | `/chat/` | Chat RAG sobre un documento (streaming NDJSON/SSE) |
| GET | `/chat/{document_id}/history` \| `/messages` | Historial de conversación |
| POST | `/simple-chat/` | Chat libre sin recuperación (streaming) |

## Esquema de base de datos

- **usuarios** — vinculada 1:1 a `auth.users` de Supabase (creada automáticamente vía trigger al registrarse).
- **projects** — proyectos/carpetas de documentos por usuario.
- **documents** — metadatos del PDF, ruta en Storage y `processing_status` (`pending` / `procesado` / `error`).
- **document_chunks** — fragmentos de texto (500 caracteres, solapamiento de 100) con su posición en el documento.
- **embeddings** — vector `vector(512)` por chunk, generado con `nomic-embed-text-v2-moe`.
- **agent_outputs** — salidas estructuradas de las tools del agente (resumen, flashcards, etc.).
- **chat_messages** — historial de la conversación, con `rol` (`user`/`assistant`) y referencia opcional a un `agent_output`.

La función SQL `match_embeddings(query_embedding, document_id_param, similarity_threshold, match_count)` hace la búsqueda semántica en un único paso: compara el vector de la consulta contra los embeddings del documento activo usando distancia coseno (`<=>`), filtra por umbral mínimo de similitud y devuelve los `k` fragmentos más relevantes.

## Evolución del agente

El diseño del agente evolucionó durante el proyecto (documentado en el paper, sección 4.4):

1. **Grafo explícito con router** (`orquestador.py`, siete nodos: `cargar_historial`, `router`, `retriever`, `resumen`, `corrector`, `flashcards`, `explicacion`). El router clasificaba la intención antes de actuar, lo que fallaba con preguntas ambiguas y obligaba a pasar siempre por el retriever aunque no fuera necesario.
2. **Agente con tool calling** (`agents/orquestador2.py`, versión actual). Dos nodos — `orquestador` y `tools` — implementando el patrón ReAct: el LLM decide qué herramienta invocar (`retriever`, `resumen`, `flashcards`, `explicacion`) mediante `bind_tools`, en un ciclo hasta que no quedan más llamadas a herramientas. El estado pasó de campos fijos a una lista de mensajes (`AgentState`), alineado con el paradigma conversacional de LangChain.

El historial de conversación se persiste en `chat_messages` en lugar de mantenerse en memoria, permitiendo retomar conversaciones entre sesiones y evitando pérdida de contexto al reiniciar el servidor.

## Limitaciones conocidas

- Solo se extrae el texto del PDF: imágenes, diagramas y tablas complejas se ignoran.
- El chunking es por número de caracteres, sin respetar la estructura del documento, lo que puede cortar conceptos a la mitad.
- El modelo solo ve los `k=5` fragmentos recuperados, no el documento completo: si la respuesta relevante no supera el umbral de similitud o no está entre los top-k, el sistema no la verá.
- Modelos locales vía Ollama (Gemma) introducen latencia notable en respuestas largas (resúmenes completos).

Mejoras futuras propuestas en el paper: re-ranking de fragmentos recuperados, chunking consciente de la estructura del documento, soporte para contenido visual, representaciones en grafo de conocimiento, y un proceso de evaluación formal con métricas objetivas.
