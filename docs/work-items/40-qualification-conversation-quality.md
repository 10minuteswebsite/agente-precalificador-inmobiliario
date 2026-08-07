# TODO-040 · Calidad conversacional del precalificador

## Objetivo

Hacer que el precalificador inmobiliario converse de forma natural, sin repeticiones ni bucles,
con un límite configurable de preguntas y un informe diario que entregue al cliente todo lo
capturado.

## Decisiones

- El Agent DNA conserva la base autónoma de preguntas; `common_questions` y las preguntas del
  perfil permiten agregar preguntas propias del cliente.
- `question_mode` ofrece modo automático (base autónoma) o manual (las preguntas del cliente sustituyen la base).
- `max_questions` es configurable entre 1 y 50; el valor por defecto es 7.
- El estado guarda la pregunta pendiente, intentos de aclaración y conteo de preguntas únicas.
- Dos intentos sin progreso llevan el caso a `human_review`; alcanzar el máximo con datos faltantes
  hace lo mismo para evitar conversaciones infinitas.
- El informe diario incluye respuestas estructuradas, análisis, limitaciones y campos personalizados.
- WhatsApp admite respuestas interactivas mediante botones (hasta 3) o listas (hasta 10); el texto
  sigue siendo el respaldo compatible.
- El súper poder permite seleccionar los tipos de comprador/operación que atenderá el agente.

## Verificación

- Pruebas unitarias cubren el límite, la detección de repetición y el contenido del informe.
- La normalización de Meta acepta `button_reply` y `list_reply` y conserva su identificador.
