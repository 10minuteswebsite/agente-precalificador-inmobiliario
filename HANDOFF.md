# Handoff operativo

## Resultado del proyecto

Este repositorio contiene el módulo de precalificación inmobiliaria que el Enrutador usa como súper
poder aditivo. Devuelve estado estructurado, análisis y eventos; el conversador del Enrutador sigue
siendo responsable del turno y la agenda externa de crear citas.

## Terminado

- Agent DNA versionado con perfiles compradores, preguntas, criterios y políticas.
- Modos automático, semi-automático y manual; modo manual reemplaza la base autónoma.
- Límite configurable de preguntas, control de bucles y revisión humana segura.
- Tipos de comprador/operación configurables.
- Estado de calificación, eventos idempotentes, informes diarios y adaptadores Meta/correo.
- Contrato de integración con el Enrutador en `docs/contracts/router-integration-v1.md`.
- Extracción inicial desde el Enrutador publicada en este repositorio.

## Decisiones y límites

- GitHub contiene código, contratos y memoria; Supabase contiene leads y conversaciones.
- Los prompts son derivados del Agent DNA, no fuente de verdad.
- No se aprueba financiamiento ni se recomiendan bancos, productos financieros, propiedades o zonas
  sin perfil suficiente.
- No se debe duplicar memoria por canal ni mezclar organizaciones, campañas o conversaciones.

## Pendiente inmediato

Conectar este repositorio al Enrutador mediante un adaptador versionado, autenticado e idempotente.
Antes de habilitarlo en producción deben pasar las pruebas de manifiesto, errores, aislamiento y
reintentos descritas en `docs/contracts/router-integration-v1.md`.

## Verificación conocida

La extracción independiente pasó 200 pruebas con `npm test`. Repite la verificación después de
cualquier cambio; no asumas que un entorno externo está disponible.
