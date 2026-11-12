# Estado del proyecto y siguientes pasos

Documento de traspaso entre sesiones de trabajo. Última actualización: **2026-11-11 (noche)**. Rama: `migration` (backend y app), subida a GitHub.

> **En una frase:** **el proyecto cumple su objetivo en local.** El backend funciona de principio a fin y la app Expo (login, proyectos, documentos, chat con citas, estudio y ajustes) está completa, rediseñada y probada en el simulador contra ese backend. **El trabajo está en pausa por decisión del autor** (2026-11-11); lo que queda está en «Si se retoma».

## Lo que está hecho

| Pieza | Estado | Dónde |
|---|---|---|
| Plan de diseño del backend | Cerrado | `docs/aws-migration/README.md` |
| Backend hexagonal (dominio, servicios, adaptadores, puntos de entrada) | Hecho, 224 tests | `backend/` (ver `backend/README.md`) |
| Esquema Postgres + pgvector + búsqueda híbrida (RRF) | Hecho | `backend/migrations/0001_initial_schema.sql` |
| Ingesta de PDFs, búsqueda, resumen/flashcards/test, API REST, agente Strands | Hecho | `backend/services/`, `backend/entrypoints/` |
| **Modo local** | **Funciona de principio a fin** | `backend/entrypoints/local.py` |
| Cognito (un único usuario) | **Desplegado** en `eu-south-2` | `infra/auth/` (Terraform) |
| Adaptadores AWS (Bedrock, S3, SQS, Lambda) | **Eliminados** el 2026-11-12; se rehará desde cero | tag `aws-adapters` |
| Plan y contrato de la app móvil | Cerrado | `docs/app/README.md` |
| **App: base** (tema, átomos, cliente API tipado) | Hecho (T1, T2) | `mobile/src/shared/` |
| **App: login con Cognito** | **Probado en dispositivo**; la renovación del token tras un 401 ya se ha visto funcionar en real | `mobile/src/features/auth/` |
| **App: proyectos** (lista, crear, renombrar, eliminar) | **Probado en el simulador** | `mobile/src/features/projects/` |
| **App: documentos** (subir PDF ≤ 30 MB, estados, renombrar, eliminar) | **Probado en el simulador** con un PDF de 27 MB y 514 páginas | `mobile/src/features/documents/` |
| **App: chat** (lista de chats, renombrarlos y eliminarlos, respuestas en streaming, citas `[n]`, tarjetas de resumen, flashcards y test; el agente sabe el nombre del estudiante) | **Probado en el simulador** (T6) | `mobile/src/features/chat/`, `mobile/src/features/study/` |
| **App: estudio** (flashcards y tests del proyecto, crearlos, renombrarlos, eliminarlos, modo estudio, hacer un test y ver la nota) | **Probado en el simulador** (T7 y T7b) | `mobile/src/features/study/` |
| **App: ajustes** (nombre, tema sistema/claro/oscuro, color de acento entre 5, cerrar sesión) | **Probado en el simulador** (T8) | `mobile/src/features/settings/`, `mobile/src/shared/theme/themePreference.ts` |
| **App: rediseño** (menú lateral, fondo `#111112`, acento `#66A3FF`, botones flotantes, menús de opciones en el centro, campo de chat flotante) | **Probado en el simulador** | `odd/tasks/mobile-redesign.md` |
| Infraestructura AWS de la app (`infra/app`) | **Aparcada** | — |

Seguimiento tarea a tarea, con las peticiones literales del autor: `odd/tasks/mobile-app.md` (app), `odd/tasks/mobile-redesign.md` (rediseño y retoques) y `odd/tasks/aws-migration.md` (backend). La app tiene 298 tests (`cd mobile && npx jest`) y el backend 199 (`cd backend && uv run pytest`).

### Datos que hacen falta para arrancar

- **Cognito**: User Pool `eu-south-2_zDVGNZqXf`, app client `qdn8v5n4hlmui6ga7kagtpj7b`, perfil `[default]`.
- **Usuario**: `2627_cristopher.marrasquin@iticbcn.cat`. La contraseña la conoce el autor; no se guarda en el repositorio.
- **`backend/.env.local`** (no está en git): valores de Cognito, `PUBLIC_BASE_URL` y `AGENT_HOST=0.0.0.0`. `DEEPSEEK_API_KEY` se toma de la variable de entorno del sistema.
- **`mobile/.env.local`** (no está en git): `EXPO_PUBLIC_*`; plantilla en `mobile/.env.example`.
- **`infra/auth/terraform.tfstate`** (no está en git): **no borrar**; es lo que permite a Terraform gestionar Cognito.

### Arrancar en local con la app

```bash
open -a Docker && open -a Ollama                    # Postgres va en Docker; Ollama calcula los embeddings
docker compose up -d --wait db
cd backend && set -a && source .env.local && set +a
uv run python -m scripts.migrate
uv run uvicorn entrypoints.api.main:local_app --factory --host 0.0.0.0 --port 8000   # API
uv run python -m entrypoints.agent.app                                                # agente, :8080 (el chat lo necesita)
cd ../mobile && npx expo start                      # i = simulador de iOS
```

**Al cambiar de red, la IP del Mac cambia** (`ipconfig getifaddr en0`) y hay que actualizarla en dos sitios:
- `mobile/.env.local`: `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_AGENT_URL`;
- `backend/.env.local`: `PUBLIC_BASE_URL` (es la URL a la que la app sube los PDFs; con `127.0.0.1` el móvil se la mandaría a sí mismo). Reiniciar la API después.

La API y el agente tienen que escuchar en `0.0.0.0`, no solo en `127.0.0.1`, para que el móvil o el simulador lleguen a ellos: la API con `--host 0.0.0.0` y el agente con `AGENT_HOST=0.0.0.0` en `backend/.env.local`.

## Decisiones tomadas (no reabrir sin motivo)

- **Local primero, AWS después.** Solo Cognito está desplegado. El código de AWS se eliminó (2026-11-12) porque el despliegue se hará desde cero; el anterior queda en el tag `aws-adapters`.
- **Terraform** para la infraestructura (no CDK). Región de Cognito: `eu-south-2`.
- **Modelos**: DeepSeek (`deepseek-flash`); embeddings Ollama `embeddinggemma-2:270m` (512 d). Los embeddings de un modelo no sirven con otro.
- **Troceador propio** (ni LangChain ni semchunk, probados y descartados).
- **Monorepo**: backend, app, infraestructura y documentación en el mismo repositorio.
- **Ningún cambio en AWS sin permiso explícito** del autor (despliegues, recursos, llamadas de pago).
- **App** (detalle en `docs/app/README.md`): solo login con `fetch` directo a Cognito; estética sobria con acento `#66A3FF` (el estudiante puede elegir otro de 5 en Ajustes) e iconos SF Symbols (Geist); `StyleSheet` + tokens; cada proyecto con menú lateral (Nuevo chat, Chats, Documentos, Estudio, Recientes, Ajustes) y la app abre en el último proyecto; resumen, flashcards y test como tarjetas en el chat; Markdown con `react-native-marked`.
- **Límite de PDF: 30 MB** y 20 documentos por proyecto.
- **Un chat se crea con su primer mensaje** y toma como título sus primeros 60 caracteres; se puede renombrar después (`PATCH /conversations/{id}`) y entonces sube al principio de la lista. «Nuevo chat» no deja nada guardado si no se escribe.
- **Menús de opciones** («⋯» o mantener pulsado) de chats, documentos, proyectos, flashcards y tests: alerta en el centro con «Renombrar», «Eliminar» y «Cancelar».
- **Entrega**: commits por funcionalidad directamente en `migration`, sin PRs (proyecto personal; la cadena de ramas se fusionó y se borró el 2026-11-10).

## Si se retoma

Nada está a medias: todo está en `migration` y subido a GitHub. Por orden de interés:

1. **Conjunto de evaluación** (ver «Más adelante»): es lo que da números para la memoria; necesita PDFs reales del autor.
2. **AWS desde cero** (ver «Más adelante»).
3. **Avisos abiertos de la app** (abajo).
4. **Limpieza de tipado del backend**: basedpyright marca 1 error y 119 avisos en `backend/entrypoints/api/app.py`, sin fallos de comportamiento.

## Avisos abiertos de la app

- Al superar los 20 documentos, el mensaje de error llega del servidor en inglés.
- Mientras un PDF se procesa, la lista se refresca cada 3 s incluso con la app en segundo plano (falta conectar `focusManager` de TanStack Query con `AppState`).
- Si se pierde la conexión y caduca el token, la renovación falla y la app cierra la sesión (lo pide la especificación, pero es estricto).
- Renombrar un documento permite quitarle el `.pdf`; no rompe nada (el archivo se guarda por id) y el autor lo deja así de momento.
- Con el teclado abierto, el campo de escribir del chat queda algo más alto de lo justo (mantiene el margen de la barra de inicio).

## Más adelante

- **Conjunto de evaluación** (necesita PDFs reales del autor): 20–30 preguntas, comparando búsqueda semántica, híbrida e híbrida + reranker. Las métricas ya existen (`backend/evaluation/retrieval.py`).
- **Ollama en el PC de escritorio** (GPU de 16 GB): la ingesta pasa el 98 % del tiempo calculando embeddings (33 s para 367 fragmentos en el M2); basta con apuntar `OLLAMA_URL` al PC, con el mismo modelo.
- **AWS desde cero** (adaptadores, `infra/app`, despliegue y evaluación completa). El intento anterior está en el tag `aws-adapters`; lecciones que conviene no olvidar:
  - el autorizador JWT de AgentCore debe usar `allowed_audience` = id del app client (los ID tokens de Cognito no traen `client_id`);
  - el agente ya no tiene modo «sin verificar» (`AUTH_VALIDATED_UPSTREAM` se quitó el 2026-11-12): siempre valida el token contra las claves JWKS de Cognito, así que en AWS necesita salida a internet o repensar ese punto;
  - el reranker de Bedrock no existe en `eu-south-2`: elegir región para `infra/app`;
  - avisos abiertos de los verificadores en `odd/tasks/aws-migration.md` (L9, L10, L13, L14).

## Notas para quien retome la sesión

- **Simulador de iOS**: el runtime de iOS 27.2 ya está instalado. Con los datos del móvil compartidos, macOS pausa descargas grandes (red marcada como cara); hacerlas con wifi.
- **Agente en local**: un token caducado o inválido no devuelve `401`, sino `200` con un evento `error` de código `unauthenticated`; la app renueva el token una vez también en ese caso.
- **Expo SDK 58**: el `fetch` global es el de `expo/fetch`, que no acepta archivos como `{ uri, name, type }` en un `FormData`; se usa `File` de `expo-file-system`.
- La revisión nativa de Gentle AI (`gentle-ai review`) está activada; el autor ha elegido omitirla en cada cambio. Para los comandos `review status` hace falta `--untracked-scope=exclude` con el hash de inventario, porque `.atl/` no está en git.
