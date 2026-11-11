# App móvil: plan y contrato con el backend

Plan de la app Expo nueva (sustituye a `mobile/`) y contrato que debe cumplir con el backend. Todo lo de aquí está decidido con el autor (sesión del 2026-11-10); para cambiarlo, actualizar este documento primero.

> **En una frase:** app de un solo usuario con login de Cognito, organizada por proyectos (chats, documentos y flashcards), con estética cálida de acento naranja, que habla con la API REST y con el agente por SSE. Pasar de local a AWS es **solo cambiar variables de entorno**.

## Decisiones

| Tema | Decisión |
|---|---|
| Alcance de la autenticación | **Solo login.** Sin registro ni "olvidé mi contraseña" (Cognito tiene un único usuario). |
| Cliente de Cognito | **`fetch` directo** a la API de Cognito (sin Amplify). |
| Navegación | Expo Router, **pila** sin menú lateral ni pestañas inferiores. |
| Datos del servidor | **TanStack Query** (caché, reintentos, sondeo del estado). |
| Estado del cliente | **Zustand** solo para sesión y tema. |
| Tipos de la API | Generados del OpenAPI de FastAPI con **`openapi-typescript`**. |
| Estilos | **`StyleSheet` + tokens** en TypeScript (sin NativeWind). |
| Componentes | **Atomic design** y separación contenedor / presentación. |
| Streaming del chat | `fetch` de **`expo/fetch`** (`response.body.getReader()`) + parser SSE propio. |
| Markdown | **`react-native-marked`** (requiere `react-native-svg`), con las citas `[n]` como botones. |
| Tokens de sesión | **`expo-secure-store`** (nunca AsyncStorage). |
| Tests | `jest-expo` + React Native Testing Library. ESLint + Prettier. TypeScript `strict`. |
| Repositorio | Monorepo: la app vive en `mobile/`. |

## Pantallas

```
Login
└─ Proyectos (pantalla inicial)             ⚙ Ajustes en la cabecera
   └─ Proyecto   [ Chats | Documentos | Estudio ]
      ├─ Chats       lista + nuevo chat
      │  └─ Chat     mensajes con citas [n] + tarjetas del agente
      │              ├─ Resumen    → se lee en la propia tarjeta
      │              ├─ Flashcards → "Estudiar"
      │              └─ Test       → "Hacer test" → resultado
      ├─ Documentos  lista + subir PDF (procesando / listo / error)
      └─ Estudio     [ Flashcards | Tests ] de todos los documentos + crear
                     ├─ Flashcards → dar la vuelta a cada tarjeta
                     └─ Test → una pregunta cada vez → nota y explicaciones
Ajustes: nombre (perfil), tema claro/oscuro, cerrar sesión
```

- **Todo cuelga del proyecto**: el backend no tiene chats sin proyecto ni listas globales.
- **Estudio del proyecto**: la API da los mazos y los tests por documento (`GET /documents/{id}/flashcard-decks` y `/quizzes`), así que la pestaña junta los de cada documento listo. Si llega a pesar, se añaden listas por proyecto al backend. Se crean desde la propia pestaña (documento, tema opcional y de 1 a 30) o desde el chat; no se pueden borrar porque la API no lo permite.
- **Resumen, flashcards y test también se crean desde el chat**: el agente tiene las herramientas `create_summary`, `create_flashcards` y `create_quiz`, y la app los muestra como tarjetas.

## Estética

Inspirada en la web de Donkey Republic (valores sacados de su CSS): un único color fuerte que guía la vista, fondos cálidos y mucho aire.

| Token | Claro | Oscuro (propuesta) | Uso |
|---|---|---|---|
| `accent` | `#FF6400` | `#FF6400` | **Solo acciones**: enviar, subir, estudiar, empezar test |
| `onAccent` | `#1E1814` | `#1E1814` | Texto sobre el acento |
| `accentSoft` | `#FAAD45` | `#FAAD45` | Apoyo: insignias, progreso |
| `background` | `#F6F4F1` | `#1E1814` | Fondo de pantalla |
| `surface` | `#FFF2EA` | `#2A231E` | Tarjetas, burbujas |
| `text` | `#1E1814` | `#F6F4F1` | Texto principal |

- **Contraste**: texto blanco sobre `#FF6400` da ~3:1, por debajo del 4,5:1 de WCAG AA. Sobre el acento va texto oscuro (`#1E1814`, ~6:1).
- **Tipografía**: **Geist** para todo. Títulos grandes y en negrita; texto de apoyo corto.
- **Formas**: radios de 8 a 24 px, tarjetas suaves y sin bordes duros.

## Estructura del código

```
mobile/src/
├─ app/                      rutas de Expo Router; solo componen pantallas
│  ├─ (auth)/login.tsx
│  └─ (app)/
│     ├─ index.tsx           Proyectos
│     ├─ settings.tsx
│     └─ projects/[projectId]/
│        ├─ index.tsx        Chats | Documentos | Estudio
│        ├─ chats/[conversationId].tsx
│        ├─ decks/[deckId].tsx
│        └─ quizzes/[quizId].tsx
├─ features/                 una carpeta por funcionalidad (api, hooks, componentes)
│  ├─ auth/  projects/  documents/  chat/  study/
└─ shared/
   ├─ api/                   cliente HTTP, tipos generados, parser SSE
   ├─ ui/                    átomos y moléculas
   ├─ theme/                 tokens y useTheme
   └─ config/env.ts          lectura y validación de EXPO_PUBLIC_*
```

## Contrato con el backend

### Configuración

| Variable | Local | AWS |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://<IP del Mac>:8000` | URL de API Gateway |
| `EXPO_PUBLIC_AGENT_URL` | `http://<IP del Mac>:8080/invocations` | URL de AgentCore (pendiente) |
| `EXPO_PUBLIC_COGNITO_REGION` | `eu-south-2` | igual |
| `EXPO_PUBLIC_COGNITO_CLIENT_ID` | id del app client | igual |

- En un móvil físico, la **IP del Mac en la red local**, nunca `127.0.0.1`. En el emulador de Android, `10.0.2.2`.
- El id del app client no es secreto (el cliente no tiene *client secret*), así que puede ir en `EXPO_PUBLIC_*`.

### Login con Cognito

1. **Entrar**: `POST https://cognito-idp.<región>.amazonaws.com/` con cabeceras `Content-Type: application/x-amz-json-1.1` y `X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth`, y cuerpo `{"AuthFlow": "USER_PASSWORD_AUTH", "ClientId": "...", "AuthParameters": {"USERNAME": "...", "PASSWORD": "..."}}`. Devuelve `IdToken`, `AccessToken` y `RefreshToken`. Es el mismo flujo que `backend/scripts/get_token.py`.
2. **Cada petición** a la API y al agente lleva `Authorization: Bearer <IdToken>` (el **ID token**, no el access token).
3. **Renovar**: con un `401`, la app pide un token nuevo con `"AuthFlow": "REFRESH_TOKEN_AUTH"` y `{"REFRESH_TOKEN": "..."}`, y repite la petición **una vez**. Si la renovación falla, cierra la sesión y vuelve al login.
4. Los tokens se guardan en `expo-secure-store`.

### Subir un PDF

1. `POST /projects/{id}/documents` con `{"name": "x.pdf", "size_bytes": n}`. Responde `{"document": ..., "upload": {"url", "fields"}}`.
2. `POST` multipart a `upload.url` con **todos** los `fields` tal cual y el archivo **el último**, en el campo `file`. Así sirve igual para `/local-uploads` en local y para S3 en AWS.
3. Consultar `GET /documents/{id}` hasta que `status` sea `ready` o `failed` (`pending` → `processing` → `ready`).

Límites: 30 MB por PDF y 20 documentos por proyecto (`409` al superarlo).

### Generaciones en segundo plano

Resumen, flashcards y test se crean con `202` y `status: "pending"`. La app consulta su `GET` (`/summaries/{id}`, `/flashcard-decks/{id}`, `/quizzes/{id}`) hasta `ready` o `failed`, con `refetchInterval` de TanStack Query. Pedirlos sobre un documento que no está listo devuelve `409`.

### Chat

**Petición**: `POST EXPO_PUBLIC_AGENT_URL` con `{"conversation_id": "<uuid>", "message": "..."}` y el ID token. Antes, el chat se crea con `POST /projects/{id}/conversations`. La app lo crea al enviar el primer mensaje, con sus primeros 60 caracteres como título.

**Respuesta**: SSE, un evento JSON por mensaje:

| Evento | Qué hace la app |
|---|---|
| `{"type": "token", "data": "..."}` | Añade texto a la burbuja |
| `{"type": "sources", "data": [{"n", "document_id", "document_name", "page"}]}` | Guarda las citas `[n]` |
| `{"type": "artifact", "kind": "summary" \| "flashcards" \| "quiz", "id": "..."}` | Pinta la tarjeta y sondea su contenido |
| `{"type": "end", "message_id": "..."}` | Cierra el mensaje |
| `{"type": "error", "code": "...", "message": "..."}` | Muestra el aviso; ese turno no se guarda |

**Token rechazado**: en local el agente responde `200` con un único evento `error` de código `unauthenticated`; AgentCore responde `401`. En los dos casos la app renueva el token y repite el turno **una vez**.

**Historial**: `GET /conversations/{id}/messages` trae `sources`, `summary_id`, `flashcard_deck_id` y `quiz_id`, así que las tarjetas se pintan igual al reabrir un chat.

**Markdown**: el agente solo usa **negrita** y listas cortas. `[n]` se convierte en un botón que muestra el documento y la página de la cita.

## Reglas para pasar a AWS sin tocar la app

- [ ] Ninguna URL escrita en el código: todo sale de `EXPO_PUBLIC_*`.
- [ ] Siempre el **ID token** de Cognito en `Authorization`.
- [ ] Subida genérica: todos los `fields` y el archivo el último.
- [ ] El parser SSE no depende de detalles del servidor local.
- [ ] **Pendiente al retomar AWS**: la URL de AgentCore es distinta y puede requerir una cabecera de sesión.

## Orden de trabajo

1. Limpiar el repositorio: borrar `src/`, sustituir `mobile/` por el proyecto nuevo y reescribir el `README.md` raíz.
2. Esqueleto: Expo Router, tokens y tema, cliente de API con tipos generados, login con Cognito.
3. Proyectos.
4. Documentos (subida y estados).
5. Chat (streaming, citas y tarjetas).
6. Flashcards y tests.
7. Ajustes.
