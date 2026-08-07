import { createOpenAiStructuredGenerator } from "./openai-structured-generator.js";

export function createOpenAiConversationSummarizer(options = {}) {
  const generate = createOpenAiStructuredGenerator(options);
  return {
    async update({ current_summary = "", note = "", message = null } = {}) {
      const observedMessage = typeof message === "string" ? message : message?.text ?? "";
      const compactInput = observedMessage && note.trim() === observedMessage.trim()
        ? note
        : [note, observedMessage].filter(Boolean).join("\n");
      const result = await generate({
        name: "lead_summary_update",
        schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"], additionalProperties: false },
        instructions: "Escribe un resumen narrativo breve y útil, en español y en 3 a 5 frases (máximo 100 palabras). Explica quién es el lead si se sabe, qué busca o le preocupa, los datos concretos que importan y el siguiente paso. No copies la conversación ni hagas una lista de mensajes. Conserva explícitamente preguntas médicas o sensibles, como una consulta sobre cáncer, pero intégralas en una sola frase. No inventes datos.",
        input: { current_summary, note: compactInput },
      });
      return result.summary;
    },
  };
}
