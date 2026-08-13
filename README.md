# Agente Precalificador Inmobiliario

Núcleo independiente del súper poder de precalificación inmobiliaria utilizado por el proyecto
[agente-enrutador](https://github.com/10minuteswebsite/agente-enrutador).

## Responsabilidad

Este repositorio es la fuente de verdad del Agent DNA, perfiles, preguntas, criterios, límites
conversacionales, estados de calificación, informes y adaptadores específicos del precalificador.
El Enrutador selecciona y configura este agente; no duplica su lógica de negocio.

El punto de entrada público es `src/prequalifier/index.js`. Los consumidores deben usar
`createPrequalifierModule()` y no importar directamente módulos internos.

El paquete ya está preparado para publicación pública (`npm pack --dry-run`); la publicación
real requiere una cuenta y una decisión operativa sobre el registro de paquetes.

## Modos de operación

- `automatic`: usa la base autónoma de compradores y un máximo inicial de 7 preguntas.
- `semi_automatic`: usa la base autónoma con un límite configurable de preguntas.
- `manual`: las preguntas definidas por el cliente sustituyen la base autónoma.
- `investment_types`: restringe las categorías de comprador/operación habilitadas.

## Contrato con el Enrutador

El Enrutador mantiene la conversación como controlador principal. Este repositorio es un súper
poder aditivo: devuelve estado de precalificación y eventos para que el conversador los integre,
pero no responde ni envía mensajes directamente. El contrato completo está en
[`docs/contracts/router-integration-v1.md`](docs/contracts/router-integration-v1.md).

## Límites

Este repositorio no almacena leads, conversaciones, credenciales ni secretos. Los datos operativos
continúan en Supabase, aislados por organización, campaña, conversación y lead. WhatsApp, correo,
agendamiento y otros proveedores se consumen mediante puertos y adaptadores.

## Relación con el Enrutador

El contrato de integración está documentado en `docs/contracts/real-estate-prequalifier-agent-dna.md`.
La migración inicial conserva copias compatibles en el Enrutador para no interrumpir agentes existentes.
La siguiente evolución reemplazará esas copias por una dependencia/versionado de este repositorio.

## Verificación

```bash
npm test
```

La configuración y los prompts deben derivarse del Agent DNA; ningún prompt es fuente de verdad.

## Publicación

La publicación se ejecuta desde `.github/workflows/publish.yml` al crear una etiqueta `vX.Y.Z` que
coincida exactamente con la versión de `package.json`. El flujo ejecuta `npm test` y `npm run pack:check` antes de publicar
con provenance y acceso público, y solo acepta commits contenidos en `main`. Antes de usarlo, un administrador debe configurar el trusted publisher
de npm para este repositorio y verificar que la etiqueta coincida con `package.json`.

Cada Pull Request y cada push a `main` ejecutan además `.github/workflows/test.yml` para comprobar
la suite y el contenido público sin publicar el paquete.
