# TIC Project: asistente de estudio sobre tus PDFs

Trabajo de fin de especialización en Inteligencia Artificial y Big Data del Institut TIC Barcelona. El objetivo es combinar un backend completo con un proyecto de agentes sencillo y desplegarlo en AWS.

Es una especie de mini NotebookLM: un estudiante sube sus PDFs (apuntes, libros, artículos) a un proyecto y estudia con ellos desde una app móvil: chatea con un agente que responde citando el documento y la página, y genera resúmenes, flashcards y tests. Las respuestas salen de los fragmentos recuperados de sus documentos, no del conocimiento general del modelo.

El paper está en [`docs/paper_overleaf.pdf`](docs/paper_overleaf.pdf). Describe la primera versión del proyecto, y desde entonces ha habido cambios: por ejemplo, el login pasa de Supabase a Cognito, el agente pasa de LangGraph a Strands y el chat trabaja sobre un proyecto con varios documentos en lugar de uno solo. La comparación completa está en [`docs/aws-migration/README.md`](docs/aws-migration/README.md).

> **Estado (2026-11-12):** el backend y la app móvil (login, proyectos, documentos, chat con citas, estudio y ajustes) están terminados y funcionan juntos en local. De AWS ya está desplegado Cognito; el siguiente paso es desplegar el resto. Detalle en [`docs/ESTADO.md`](docs/ESTADO.md).

## Arquitectura

```
┌────────────────────────────────────┐
│  App móvil (Expo / React Native)   │
└──────┬──────────────────┬──────────┘
       │ REST             │ SSE (chat)
       │ ID token de Cognito en cada petición
┌──────▼──────────┐ ┌─────▼─────────────────────┐
│  API (FastAPI)  │ │  Agente (Strands)         │
│  proyectos,     │ │  RAG agéntico: busca,     │
│  documentos,    │ │  cita [n] y crea resumen, │
│  estudio        │ │  flashcards y tests       │
└──────┬──────────┘ └─────┬─────────────────────┘
       └────────┬─────────┘
┌───────────────▼────────────────────────────────┐
│  Postgres + pgvector (búsqueda híbrida, RRF)   │
└────────────────────────────────────────────────┘
```

El backend sigue una **arquitectura hexagonal**: el dominio y los servicios no dependen de ningún proveedor, y cada servicio externo entra por un adaptador. Todo corre en local salvo Cognito y, si se elige un proveedor en la nube, el LLM:

| Pieza | Implementación |
|---|---|
| LLM | A elegir con `LLM_MODEL`: Ollama, Claude, OpenAI o cualquier API compatible, o DeepSeek (ver abajo) |
| Embeddings | Ollama (`embeddinggemma-2:270m`) |
| Archivos | carpeta local |
| Tareas en segundo plano | hilos en la API |
| Agente | servidor FastAPI en `:8080` |
| Usuarios | Cognito |

> [!NOTE]
> Cognito ya está desplegado en AWS porque es el login definitivo: la app inicia sesión directamente contra él y el backend solo valida el token, así que nunca ve contraseñas y la autenticación no cambiará al llevar el resto a AWS.

**Siguiente paso:** llevar todo el sistema a AWS, añadiendo adaptadores para sus servicios sin tocar el dominio ni los servicios.

### Elegir el LLM

El mismo LLM se usa para el chat y para generar resúmenes, flashcards y tests. Se cambia con una línea de `backend/.env.local`, con el formato `<proveedor>/<modelo>`:

| `LLM_MODEL` | Proveedor | Necesita |
|---|---|---|
| `ollama/qwen3:8b` | Ollama, en local | El modelo descargado con `ollama pull`; tiene que admitir *tool calling* |
| `anthropic/claude-sonnet-5-5` | Claude (Anthropic) | `ANTHROPIC_API_KEY` |
| `openai/gpt-5` | OpenAI | `OPENAI_API_KEY` |
| `openai/<modelo>` | Cualquier API compatible con OpenAI (OpenRouter, LM Studio, vLLM…) | `OPENAI_BASE_URL` con la URL del servidor y, si la pide, `OPENAI_API_KEY` |
| `deepseek/deepseek-flash` | DeepSeek | `DEEPSEEK_API_KEY` |

Tras cambiarlo, reinicia el backend (`mise run dev`). El modelo usado queda guardado con cada resumen, flashcards o test.

## Estructura del repositorio

| Carpeta | Qué contiene |
|---|---|
| [`backend/`](backend/README.md) | API, agente, ingesta de PDFs y servicios de estudio (Python 3.13, `uv`) |
| [`mobile/`](mobile/README.md) | App móvil Expo / React Native (TypeScript) |
| [`infra/`](infra/README.md) | Terraform: Cognito (`infra/auth`) |
| [`docs/`](docs/) | Estado del proyecto, plan de la app, plan de AWS y el paper |
| `odd/` | Seguimiento tarea a tarea del trabajo |
| `mise.toml` | Versiones de Python y uv, y los comandos del día a día |

## Puesta en marcha

Requisitos: [mise](https://mise.jdx.dev/), Docker, [Ollama](https://ollama.com/), Node.js y Expo Go en el móvil. Para el LLM, un modelo de chat de Ollama con *tool calling* o una clave de DeepSeek, OpenAI (o compatible) o Anthropic. mise instala Python y uv.

**1. Herramientas y dependencias** (una vez)

```bash
mise trust && mise install      # Python 3.13 y uv
mise run install                # uv sync (backend) + npm install (mobile)
ollama pull <modelo-de-embeddings>  # el de OLLAMA_EMBED_MODEL (por defecto embeddinggemma-2:270m)
ollama pull <modelo-de-chat>        # solo si LLM_MODEL=ollama/<modelo>
```

El modelo de embeddings tiene que generar vectores de 512 dimensiones (la columna de pgvector es `vector(512)`), y si se cambia hay que volver a subir los documentos.

**2. Configuración** (una vez por máquina; los dos archivos están en `.gitignore`)

```bash
cp backend/.env.local.example backend/.env.local
cp mobile/.env.example mobile/.env.local
```

- `backend/.env.local`: `LLM_MODEL` y la clave de su proveedor (ver [Elegir el LLM](#elegir-el-llm)), `COGNITO_ISSUER` y `COGNITO_CLIENT_ID` (salen de `terraform -chdir=infra/auth output`), `PUBLIC_BASE_URL` con la IP de la máquina y `AGENT_HOST=0.0.0.0` para que el móvil llegue al agente.
- `mobile/.env.local`: las URLs de la API y del agente con la IP de la máquina, y el client id de Cognito.
- `mise run ip` muestra la IP de la máquina y comprueba esas URLs y `AGENT_HOST`.

**3. Arrancar** (Docker abierto)

```bash
mise run dev       # Postgres, Ollama y migraciones; luego la API (:8000) y el agente (:8080)
mise run mobile    # en otra terminal: Expo; escanea el QR con el móvil (misma wifi)
```

| Comando | Qué hace |
|---|---|
| `mise run test` | Tests del backend (levanta Postgres) |
| `mise run mobile:test` | Tests, tipos y lint de la app |
| `mise run token -- tu@email.com` | ID token de Cognito para probar la API con `curl` |
| `mise tasks` | Lista de todos los comandos |

Más detalle del backend (API, agente, variables) en [`backend/README.md`](backend/README.md).

## Documentación

- [`docs/ESTADO.md`](docs/ESTADO.md): qué está hecho y qué sigue.
- [`docs/app/README.md`](docs/app/README.md): plan de la app y contrato con el backend.
- [`docs/aws-migration/README.md`](docs/aws-migration/README.md): diseño del backend y del despliegue en AWS, el siguiente paso del proyecto.
