# Continuar el trabajo

1. Lee este archivo y `HANDOFF.md`.
2. Lee `docs/CURRENT_STATE.md`, luego solo la sección activa de `TODO.md`.
3. Revisa `git status`, la rama actual y los commits recientes.
4. Carga únicamente el contrato, work item, código y pruebas necesarios para el siguiente paso.
5. Usa GitHub como fuente de verdad y registra decisiones, cambios y verificación en el repositorio.

La frontera pública con el Enrutador es `src/application/router-integration-v1.js`
(`createRouterIntegrationV1`), descrita en `module-manifest.json` y en
`docs/contracts/router-integration-v1.md` + `error-contract.md`. No alteres esa firma sin evolución
de contrato (`schema_version`).

Para consumo nuevo usa la fachada `src/prequalifier/index.js` (`createPrequalifierModule`); la ruta
de aplicación se conserva como compatibilidad interna de v1.

No dependas de conversaciones anteriores. Para trabajo sustancial, sigue las reglas canónicas del
arquitecto indicadas en `opencode.json`.
