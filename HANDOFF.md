# Handoff operativo

## Resultado del proyecto

Este repositorio contiene el módulo de precalificación inmobiliaria que el Enrutador usa como súper
poder por handoff. Devuelve estado estructurado, análisis y eventos; el conversador del Enrutador
sigue siendo responsable del turno y la agenda externa de crear citas.

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
- El contrato Router v1 admite `scheduler_available`. Cuando está activo, el módulo puede devolver
  una acción `scheduling` estrictamente validada; el Enrutador conserva la ejecución externa y la
  confirmación de citas.

## Decisiones y límites

- GitHub contiene código, contratos y memoria; Supabase contiene leads y conversaciones.
- Los prompts son derivados del Agent DNA, no fuente de verdad.
- No se aprueba financiamiento ni se recomiendan bancos, productos financieros, propiedades o zonas
  sin perfil suficiente.
- No se debe duplicar memoria por canal ni mezclar organizaciones, campañas o conversaciones.

## Pendiente inmediato

TODO-042 está completado: PR #6 se integró en `main` como `bf9c99e` y el consumidor coordinado
PR #7 se integró en `agente-enrutador` como `43cb68d`. El Router ya consume la fachada pública;
no se deben añadir imports internos nuevos.

El siguiente incremento es TODO-044: conectar el runner del Enrutador con la acción aditiva de
agenda. La activación productiva sigue separada y explícitamente deshabilitada hasta una
verificación real del entorno.

## Verificación conocida

`npm test` pasa 222 pruebas, incluida la salida aditiva de agenda y su rechazo cuando no está
habilitada. Repite la verificación
después de cualquier cambio; no asumas que un entorno externo está disponible.
