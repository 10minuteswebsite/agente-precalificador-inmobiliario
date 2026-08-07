import { createOpenAiStructuredGenerator } from "./openai-structured-generator.js";

const previewSchema = { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false };
const feedbackSchema = { type: "object", properties: { summary: { type: "string" }, solution: { type: "string" }, application: { type: "string" }, rules_addition: { type: "string" } }, required: ["summary", "solution", "application", "rules_addition"], additionalProperties: false };

export function createOpenAiAgentPreviewGenerator(options = {}) {
  const generate = createOpenAiStructuredGenerator(options);
  return {
    async reply(input) {
      return generate({
        name: "agent_preview_turn",
        schema: previewSchema,
        instructions: [
          "Responde como el agente configurado, en una conversación de prueba aislada.",
          "Usa Agent DNA como configuración de negocio y solo el conocimiento proporcionado.",
          "Sé natural, breve y responde directamente al último mensaje.",
          input.conversation_action === "start" ? "Un saludo breve es apropiado en este primer turno." : "Es una conversación en curso: no vuelvas a saludar ni repitas el nombre sin necesidad.",
        ].join("\n"),
        input,
      });
    },
    async feedback(input) {
      return generate({
        name: "agent_preview_feedback",
        schema: feedbackSchema,
        instructions: [
          "Analiza el feedback del creador sobre una prueba de su agente.",
          "Entrega una solución concreta que el sistema pueda aplicar, no una lista de tareas para el cliente.",
          "solution debe explicar la respuesta o comportamiento corregido. application debe decir exactamente qué cambio se aplicará al ADN.",
          "Si faltan datos verificables, no pidas al cliente que investigue: propone una respuesta segura que el agente pueda usar mientras tanto.",
          "No inventes datos del negocio. rules_addition debe ser una regla breve que pueda añadirse al ADN; si no hace falta una regla, déjalo vacío.",
        ].join("\n"),
        input,
      });
    },
  };
}
