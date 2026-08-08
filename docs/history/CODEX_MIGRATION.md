# Contexto recuperado de Codex

## Negocio

El producto es un precalificador inmobiliario para compradores. Debe conversar de forma sutil y
amigable, identificar el perfil, conocer objetivo, plazo, forma de pago, presupuesto, preparación y
limitaciones, y sugerir la cita con el asesor cuando la precalificación esté lista. No ofrece aprobación
financiera ni recomienda bancos, prestamistas, productos financieros, propiedades o zonas específicas
sin conocer el perfil.

## Perfiles base

La base autónoma contempla comprador internacional, inversionista local, nuevo comprador/primera vivienda
y comprador local. Las preguntas y criterios se encuentran en el Agent DNA, no en conversaciones ni en
prompts aislados.

## Decisiones relevantes

- El módulo es un súper poder del Enrutador, no un agente controlador independiente.
- Cada cliente puede configurar su propia versión.
- Hay modo automático con base profesional, modo semi-automático con límite y modo manual que reemplaza
  las preguntas autónomas.
- El límite evita conversaciones infinitas; los bucles de aclaración pasan a revisión humana.
- WhatsApp puede usar botones/listas con texto como respaldo; la agenda se integra después como otro súper poder.
- Los leads y conversaciones pertenecen al Enrutador/Supabase; GitHub nunca guarda datos operativos.
- El informe diario por correo contiene respuestas estructuradas, análisis, limitaciones y siguiente acción.

## Problemas encontrados y soluciones

- La conversación repetía “Perfecto, Mario”: se reforzaron las reglas de no repetición y se añadió estado
  de pregunta pendiente.
- Una respuesta ambigua podía repetir la misma aclaración indefinidamente: se añadieron intentos,
  límite de preguntas y derivación a revisión humana.
- Agentes antiguos no mostraban las opciones del precalificador al editarse: el Enrutador normaliza
  el súper poder por `kind` cuando falta la capacidad histórica.

## Alternativas rechazadas

- Guardar leads o conversaciones en el repositorio.
- Hacer que el precalificador sustituya al conversador principal.
- Crear una memoria separada para WhatsApp, voz u otro canal.
- Tratar preguntas del cliente como reemplazo implícito en modo automático.

## Pendiente

El siguiente incremento es el adaptador versionado entre este repositorio y el Enrutador, con manifiesto,
errores, autenticación, aislamiento e idempotencia comprobables. El agendamiento sigue siendo externo.
