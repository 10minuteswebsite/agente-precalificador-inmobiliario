/** Provider-neutral contract for sending an agent response to a lead. */
export const messageSenderOperations = Object.freeze(["sendText", "sendInteractive", "sendTemplate"]);

export function responseText(response) {
  if (typeof response === "string") return response.trim();
  if (response && typeof response.text === "string") return response.text.trim();
  if (response && typeof response.message === "string") return response.message.trim();
  return "";
}
