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
- Adaptador versionado `createRouterIntegrationV1` (TODO-041) con manifiesto
  (`module-manifest.json`), contrato de errores (`docs/contracts/error-contract.md`),
  aislamiento por scopes, idempotencia y pruebas de contrato.
- Fachada pública `createPrequalifierModule` en `src/prequalifier/index.js`; el consumo nuevo debe
  pasar por ella y no por imports internos.
- `package.json` exporta únicamente la fachada raíz y el manifiesto; los archivos internos no forman
  parte del contrato público.

## Decisiones y límites

- GitHub contiene código, contratos y memoria; Supabase contiene leads y conversaciones.
- Los prompts son derivados del Agent DNA, no fuente de verdad.
- No se aprueba financiamiento ni se recomiendan bancos, productos financieros, propiedades o zonas
  sin perfil suficiente.
- No se debe duplicar memoria por canal ni mezclar organizaciones, campañas o conversaciones.

## Pendiente inmediato

TODO-042: revisar PR #6 y su consumidor coordinado en `agente-enrutador` PR #7. La fachada pública
ya está publicada en este branch; el Router deja de importar rutas internas cuando ambos cambios
se integren.

## Verificación conocida

`npm test` pasa 219 pruebas (200 preexistentes + 19 del contrato/fachada). Repite la verificación
después de cualquier cambio; no asumas que un entorno externo está disponible.
