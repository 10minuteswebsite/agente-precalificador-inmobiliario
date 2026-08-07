# Agente Precalificador Inmobiliario

Núcleo independiente del súper poder de precalificación inmobiliaria utilizado por el proyecto
[agente-enrutador](https://github.com/10minuteswebsite/agente-enrutador).

## Responsabilidad

Este repositorio es la fuente de verdad del Agent DNA, perfiles, preguntas, criterios, límites
conversacionales, estados de calificación, informes y adaptadores específicos del precalificador.
El Enrutador selecciona y configura este agente; no duplica su lógica de negocio.

## Modos de operación

- `automatic`: usa la base autónoma de compradores y un máximo inicial de 7 preguntas.
- `manual`: las preguntas definidas por el cliente sustituyen la base autónoma.
- `investment_types`: restringe las categorías de comprador/operación habilitadas.

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
