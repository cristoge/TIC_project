# TIC Project: asistente de estudio sobre tus PDFs

Un estudiante sube sus PDFs (apuntes, libros, artículos) a un proyecto y estudia con ellos desde una app móvil: chatea con un agente que responde citando el documento y la página, y genera resúmenes, flashcards y tests. Las respuestas salen de los fragmentos recuperados de sus documentos, no del conocimiento general del modelo.

Trabajo de fin de especialización: Inteligencia Artificial y Big Data, Institut TIC Barcelona. El paper está en [`docs/paper_overleaf.pdf`](docs/paper_overleaf.pdf).

> **Estado (2026-11-10):** el backend está terminado y funciona en local de principio a fin. La app móvil se está rehaciendo desde cero ([plan](docs/app/README.md)). El despliegue en AWS está aparcado; solo Cognito está desplegado. Detalle y siguientes pasos en [`docs/ESTADO.md`](docs/ESTADO.md).

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

El backend sigue una **arquitectura hexagonal**: el dominio y los servicios no dependen de ningún proveedor, y cada servicio externo entra por un adaptador. Por eso el mismo código corre en local o en AWS cambiando solo la configuración:

| Pieza | Local (`APP_ENV=local`) | AWS |
|---|---|---|
| LLM | DeepSeek | Nova 2 Lite (Bedrock) |
| Embeddings | Ollama (`embeddinggemma-2:270m`) | Titan V2 |
| Archivos | carpeta local | S3 |
| Tareas en segundo plano | hilos en la API | SQS + Lambda |
| Agente | proceso local en `:8080` | Bedrock AgentCore |
| Usuarios | Cognito | Cognito |

## Estructura del repositorio

| Carpeta | Qué contiene |
|---|---|
| [`backend/`](backend/README.md) | API, agente, ingesta de PDFs y servicios de estudio (Python 3.13, `uv`) |
| [`mobile/`](docs/app/README.md) | App Expo nueva (en construcción) |
| [`infra/`](infra/README.md) | Terraform: Cognito (`infra/auth`) |
| [`docs/`](docs/) | Estado del proyecto, plan de la app y plan de la migración a AWS |
| `odd/` | Seguimiento tarea a tarea del trabajo |

## Puesta en marcha

Requisitos: Docker, [`uv`](https://docs.astral.sh/uv/), Ollama y una clave de DeepSeek.

```bash
docker compose up -d --wait db   # Postgres 17 + pgvector en localhost:5433
cd backend && uv sync
uv run pytest                    # tests
```

Para levantar la API y el agente en local, sigue el apartado "Run everything locally" de [`backend/README.md`](backend/README.md).

## Documentación

- [`docs/ESTADO.md`](docs/ESTADO.md): qué está hecho y qué sigue.
- [`docs/app/README.md`](docs/app/README.md): plan de la app y contrato con el backend.
- [`docs/aws-migration/README.md`](docs/aws-migration/README.md): diseño completo del backend y del despliegue en AWS.
