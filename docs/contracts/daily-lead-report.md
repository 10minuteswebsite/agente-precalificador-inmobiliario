# Contrato: informe diario de leads

**Estado:** Implementado; credenciales y remitente pendientes de configuración

## Resultado

Cada agente precalificador puede enviar un informe diario a los correos configurados. Incluye todos los leads procesados en el período, ordena primero los urgentes y resume estado, perfil, razones, limitaciones y siguiente acción. También incluye los campos estructurados capturados (etiqueta, valor, confianza, consentimiento y origen cuando exista), sin copiar respuestas financieras completas ni el transcript.

## Ejecución

`GET /api/jobs/daily-lead-reports` requiere `Authorization: Bearer <CRON_SECRET>`. El endpoint evalúa la hora local de cada agente, reclama un registro único y entrega el correo mediante un adaptador reemplazable.

La tarea está programada cada hora en `vercel.json` para respetar la hora local configurada por cada agente. [Vercel envía automáticamente `CRON_SECRET` en el encabezado](https://vercel.com/docs/cron-jobs/manage-cron-jobs) cuando la tarea se configura en producción. La programación horaria requiere Vercel Pro o Enterprise; Hobby admite solamente una ejecución diaria.

## Proveedor de correo

Con `RESEND_API_KEY` y `REPORT_FROM_EMAIL`, el sistema envía directamente por Resend y transmite la clave de idempotencia al proveedor. `EMAIL_SENDER_URL` continúa disponible como alternativa reemplazable. El remitente debe pertenecer a un dominio verificado antes de enviar a destinatarios reales.

Referencia oficial: [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email).

## Fiabilidad

- un registro único por agente y fecha local;
- períodos continuos desde el último informe completado;
- clave de idempotencia para el proveedor de correo;
- informes vacíos omitidos por defecto;
- fallo del proveedor registrado para reintento;
- una ejecución concurrente no genera dos correos.

## Persistencia

La migración `0009_daily_lead_reports.sql` crea el registro de entrega con aislamiento por organización y acceso de lectura mediante RLS.

## Datos capturados y privacidad

Los campos se leen únicamente de `conversations.custom_field_values`, ya normalizados y limitados
por el contrato de campos del agente. El informe no reconstruye mensajes ni añade datos de otra
conversación. Los destinatarios son los configurados por el propietario del agente; por eso los
campos sensibles requieren el consentimiento que exige su configuración y el correo muestra ese
estado como metadato. Si una versión antigua no contiene campos, se muestra una indicación vacía
sin fallar el envío.
