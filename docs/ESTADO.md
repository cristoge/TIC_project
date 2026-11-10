# Estado del proyecto y siguientes pasos

Documento de traspaso entre sesiones de trabajo. Última actualización: **2026-11-10**. Rama: `migration` (subida a GitHub hasta `bb23cf2`).

> **En una frase:** el backend nuevo está terminado y funciona en local de principio a fin (DeepSeek + Ollama + Postgres en Docker + Cognito real). AWS está aparcado. **Mañana: limpiar el repositorio y empezar la app Expo nueva.**

## Lo que está hecho

| Pieza | Estado | Dónde |
|---|---|---|
| Plan de diseño completo | Cerrado | `docs/aws-migration/README.md` |
| Seguimiento tarea a tarea (specs, tareas, registro) | Al día | `odd/tasks/aws-migration.md` |
| Backend hexagonal (dominio, servicios, adaptadores, puntos de entrada) | Hecho, 202 tests | `backend/` (ver `backend/README.md`) |
| Esquema Postgres + pgvector + búsqueda híbrida (RRF) | Hecho | `backend/migrations/0001_initial_schema.sql` |
| Ingesta de PDFs (páginas → fragmentos → embeddings) | Hecho | `backend/services/ingestion.py` |
| Búsqueda + reranker (reranker solo en AWS) | Hecho | `backend/services/search.py` |
| Resumen, flashcards y test con corrección en el servidor | Hecho | `backend/services/study.py` |
| API REST (25 rutas, aislamiento por usuario) | Hecho | `backend/entrypoints/api/` |
| Agente Strands (RAG agéntico, citas `[n]`, Markdown limitado) | Hecho | `backend/services/chat.py`, `backend/adapters/bedrock/agent_runner.py` |
| **Modo local** (`APP_ENV=local`) | **Funciona de principio a fin** | `backend/entrypoints/local.py` |
| Cognito (un único usuario) | **Desplegado** en `eu-south-2` | `infra/auth/` (Terraform) |
| Adaptadores AWS (Bedrock, S3, SQS, Lambda, AgentCore) | Escritos y probados, **sin desplegar** | `backend/adapters/`, `backend/entrypoints/` |
| Infraestructura AWS de la app (`infra/app`) | **Aparcada** | — |

### Datos que hacen falta para arrancar

- **Cognito**: User Pool `eu-south-2_zDVGNZqXf`, app client `qdn8v5n4hlmui6ga7kagtpj7b`, perfil `[default]`.
- **Usuario**: `2627_cristopher.marrasquin@iticbcn.cat`. La contraseña la conoce el autor; no se guarda en el repositorio.
- **`backend/.env.local`** (no está en git): ya tiene los valores de Cognito. `DEEPSEEK_API_KEY` se toma de la variable de entorno del sistema.
- **`infra/auth/terraform.tfstate`** (no está en git): **no borrar**; es lo que permite a Terraform gestionar Cognito.

### Arrancar en local

Los pasos completos están en `backend/README.md`, apartado "Run everything locally". En resumen:

```bash
docker compose up -d --wait db
cd backend && set -a && source .env.local && set +a
uv run python -m scripts.migrate
uv run uvicorn entrypoints.api.main:local_app --factory --port 8000   # API
uv run python -m entrypoints.agent.app                                 # agente, :8080
TOKEN=$(uv run python -m scripts.get_token 2627_cristopher.marrasquin@iticbcn.cat)
```

## Decisiones tomadas (no reabrir sin motivo)

- **Local primero, AWS después.** El código de AWS se queda, aislado en adaptadores; solo Cognito está desplegado.
- **Terraform** para la infraestructura (no CDK). Región de Cognito: `eu-south-2`.
- **Modelos**: Nova 2 Lite en AWS, DeepSeek (`deepseek-flash`) en local; embeddings Titan V2 en AWS, Ollama `embeddinggemma-2:270m` en local (512 d). Los embeddings de un entorno no sirven en el otro.
- **Troceador propio** (ni LangChain ni semchunk, probados y descartados).
- **El chat responde en Markdown limitado** (negrita y listas cortas): la app debe mostrar Markdown.
- **Monorepo**: backend, app, infraestructura y documentación en el mismo repositorio.
- **Ningún cambio en AWS sin permiso explícito** del autor (despliegues, recursos, llamadas de pago).

## Mañana, en este orden

1. **Limpiar el repositorio**
   - Borrar `src/` (backend antiguo con Supabase y LangGraph; queda en el historial de git).
   - Sustituir `mobile/` por el proyecto Expo nuevo.
   - Reescribir el `README.md` raíz, que aún describe el proyecto antiguo.
2. **Limpieza de tipado del backend** (aplazada hoy). basedpyright marca 1 error y 119 avisos en `backend/entrypoints/api/app.py`, sin fallos de comportamiento:
   - `-> dict` sin parámetros en el `Protocol` `Storage` (el error);
   - las filas del catálogo como `dict` sin tipar → alias `Row = dict[str, Any]`;
   - dependencias de FastAPI con `Depends(...)` por defecto → `Annotated[..., Depends(...)]`;
   - parámetro `request` sin usar en `user()`, resultado sin usar de `found(...)` en `grade_quiz`, helpers sin anotar.
   - Revisar el resto del backend con `uvx basedpyright --pythonpath .venv/bin/python <archivos>`.
   - Configurar el editor para que use `backend/.venv` (Python 3.13): `[tool.pyright]` con `venvPath = "."`, `venv = ".venv"`, `pythonVersion = "3.13"` en `backend/pyproject.toml`.
3. **Documento "contrato de la app"** antes de programarla: rutas, formatos y eventos del chat, y estas reglas para que pasar a AWS sea solo configuración:
   - URLs en variables (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AGENT_URL`); en el móvil, la IP del Mac, no `127.0.0.1` (emulador Android: `10.0.2.2`);
   - subida de PDFs genérica: enviar **todos** los `fields` de la respuesta y el archivo **el último** (multipart);
   - enviar siempre el **ID token** de Cognito;
   - la URL de AgentCore en AWS es distinta y puede requerir una cabecera de sesión (pendiente de confirmar al retomar AWS).
4. **App Expo nueva** (React Native) contra el backend local.

## Más adelante

- **Conjunto de evaluación** (necesita PDFs reales del autor): 20–30 preguntas, comparando búsqueda semántica, híbrida e híbrida + reranker. Las métricas ya existen (`backend/evaluation/retrieval.py`). En local se ha visto que sin reranker el mejor fragmento no siempre sale primero.
- **Retomar AWS** (`infra/app`, despliegue y evaluación completa). Pendientes ya identificados:
  - el autorizador JWT de AgentCore debe usar `allowed_audience` = id del app client (los ID tokens de Cognito no traen `client_id`);
  - `AUTH_VALIDATED_UPSTREAM=true` solo en el runtime de AgentCore;
  - el reranker de Bedrock no existe en `eu-south-2`: elegir región para `infra/app`;
  - avisos abiertos de los verificadores en `odd/tasks/aws-migration.md` (L9, L10, L13, L14).

## Notas para quien retome la sesión

- El historial detallado de cada decisión, con las peticiones literales del autor, está en `odd/tasks/aws-migration.md` (sección `## Log`).
- La revisión nativa de Gentle AI (`gentle-ai review`) está activada; el autor ha elegido omitirla en cada cambio hasta ahora. Para los comandos `review status` hace falta `--untracked-scope=exclude` con el hash de inventario, porque `.atl/` no está en git.
