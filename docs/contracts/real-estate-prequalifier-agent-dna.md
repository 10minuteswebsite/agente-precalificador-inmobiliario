# Contrato: Agent DNA del precalificador inmobiliario

**Versión:** 1
**Estado:** Implementado

## Resultado

Permite que cada organización configure su propio precalificador como un agente del Enrutador. El contrato expresa comportamiento y reglas en datos estructurados; el prompt ejecutable es un artefacto derivado y no la fuente de verdad.

El sistema aporta por defecto una base autónoma para compradores: inversionista internacional,
inversionista local, nuevo comprador y comprador local. Incluye preguntas mínimas, criterios y
límites de conversación; el cliente no tiene que definir qué significa precalificar. Las preguntas
y campos configurados por el cliente se agregan como extensiones y no reemplazan esta base.

Los agentes genéricos existentes conservan compatibilidad. La validación especializada se activa únicamente cuando `kind` es `real_estate_prequalifier`.

## Estructura

| Campo | Responsabilidad |
|---|---|
| `schema_version` | Versión del contrato; inicialmente `1`. |
| `kind` | Tipo de agente: `real_estate_prequalifier`. |
| `identity` | Nombre del negocio y tono conversacional. |
| `channels` | Solo `whatsapp` en el primer incremento. |
| `services` | Servicios configurados por la organización. |
| `investment_types` | Tipos de comprador/operación habilitados para este precalificador. |
| `common_questions` | Preguntas compartidas entre perfiles. |
| `profiles` | Identificación, preguntas condicionales y criterios explicables por perfil. |
| `markets` | Mercados y zonas configurables, sin prometer inventario. |
| `policies` | Temas permitidos, prohibiciones y límites de recomendación. |
| `reporting` | Informe diario por correo con todos los leads. |
| `question_mode` | `automatic` usa la base autónoma; `semi_automatic` usa esa base con un límite definido; `manual` la reemplaza por preguntas del cliente. |
| `max_questions` | Límite máximo de preguntas únicas por conversación; por defecto `7` y configurable entre `1` y `50` en modo semi-automático. |
| `scheduling` | Acción opcional devuelta al Enrutador cuando el súper poder `scheduler` está habilitado; el módulo no ejecuta citas. |

La base inicial atiende compradores. Alquiler y otros servicios requieren un alcance comercial
explícito y una evolución de contrato; no se activan implícitamente.

Los tipos disponibles son: comprador internacional, comprador local, primera vivienda, nueva
construcción, propiedad de reventa, propiedad para inversión, propiedad de lujo, compra de terrenos,
compra de contado y compra financiada. El agente solo debe identificar los tipos seleccionados por
el cliente.

## Preguntas

Cada pregunta requiere:

- identificador único;
- texto conversacional;
- propósito explícito;
- carácter obligatorio u opcional;
- sensibilidad estándar o sensible;
- tipo de respuesta;
- condición opcional referida a otra respuesta conocida.

Las preguntas sensibles sin propósito se rechazan. Las condiciones no pueden referirse a campos inexistentes.

El agente aporta las preguntas mínimas por defecto en modo `automatic` y `semi_automatic`. En modo `semi_automatic`, `max_questions` restringe cuántas preguntas de esa base puede hacer. En modo `manual`, las
preguntas del cliente en `common_questions` o en el perfil correspondiente sustituyen esa base;
se exige al menos una. `max_questions` evita conversaciones infinitas: si se alcanza el límite con
datos requeridos pendientes, el caso pasa a revisión humana.

## Criterios de precalificación

La IA propondrá los criterios al crear el agente. Cada criterio debe indicar el dato evaluado, la comparación, el valor, si es indispensable y una explicación comprensible. No se permite evaluar un dato que el agente no haya sido configurado para conocer.

La calificación orienta la conversación y el siguiente paso; nunca equivale a aprobación hipotecaria ni permite recomendar bancos, prestamistas o productos financieros.

## Informe diario

- Canal: correo electrónico.
- Frecuencia: diaria.
- Alcance: todos los leads procesados.
- Hora inicial recomendada: `08:00` en la zona horaria de la organización.
- Sin informe vacío por defecto.

Cada lead incluye en el correo el análisis, limitaciones, siguiente acción, respuestas estructuradas
de precalificación y campos personalizados capturados. No se envía el transcript completo.

Los destinatarios se validan como correos y se eliminan duplicados. La entrega está implementada mediante Resend o un adaptador HTTP reemplazable, y permanece inactiva hasta configurar credenciales y remitente.

## Fallos

Las configuraciones inválidas producen errores con prefijo `invalid_agent_configuration:`. La API de agentes responde `422` y no persiste una configuración parcial.

## Seguridad y aislamiento

El Agent DNA permanece dentro de la fila `agents` que ya está aislada por `tenant_id` y políticas RLS. El contrato no acepta credenciales ni referencias cruzadas a otras organizaciones. Las pruebas usan únicamente identidades y correos sintéticos.

## Evolución

Voz, chat web y agendamiento se añadirán mediante contratos y adaptadores separados. Un cambio incompatible requerirá una nueva `schema_version` y una ruta explícita de migración.
