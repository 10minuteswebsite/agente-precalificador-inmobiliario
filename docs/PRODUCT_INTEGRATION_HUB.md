# Integración Hub — Súper Formularios

## Contrato

| Campo | Valor |
| --- | --- |
| Producto | Súper Formularios |
| Hub slug | `super-formularios` |
| Hub | `https://hub.lasolucionweb.net` |
| Dominio | `https://formularios.lasolucionweb.net` |
| Callback | `https://formularios.lasolucionweb.net/auth/hub?app=super-formularios` |
| Cliente Hub | `SUPER_FORMULARIOS_HUB_CLIENT_ID` |
| Secreto Hub | `SUPER_FORMULARIOS_HUB_CLIENT_SECRET` |

## Alcance aditivo

El puente vive fuera de `src/domain`, `src/application/router-integration-v1.js`
y `src/prequalifier/index.js`. No cambia Agent DNA, prompts, criterios,
estados, eventos, aislamiento, idempotencia ni persistencia operativa.

La ruta `/auth/hub` recibe el código de un solo uso, verifica que el parámetro
`app` sea exactamente `super-formularios`, lo canjea desde el servidor contra el
Hub y crea o reutiliza el usuario Supabase mediante el vínculo estable
`hub_user_id` y `auth0_sub`. El navegador nunca recibe el secreto del Hub.

La sesión local usa un access token Supabase en cookie `HttpOnly`, `Secure`,
`SameSite=Lax`, con una hora de vida. El adaptador de autenticación existente
continúa aceptando `Authorization: Bearer`; adicionalmente acepta esa cookie
para las rutas que ya existen. El logout elimina ambas cookies.

## Configuración requerida

Los valores reales deben cargarse únicamente en el proveedor de despliegue:

- `HUB_BASE_URL`
- `PRODUCT_BASE_URL`
- `SUPER_FORMULARIOS_HUB_CLIENT_ID`
- `SUPER_FORMULARIOS_HUB_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Nunca registrar estos valores en Git, URL, logs o mensajes.

## Verificación pendiente

Antes de publicar se debe disponer del DNS y despliegue de
`formularios.lasolucionweb.net`, registrar la integración equivalente en el
Hub y probar código válido, expirado, reutilizado, de otro producto, sesión
local y logout. La concesión permanente de usuarios existentes pertenece al
Hub y debe ejecutarse de forma idempotente y auditable.
