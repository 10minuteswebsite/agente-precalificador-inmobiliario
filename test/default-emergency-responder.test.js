import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultEmergencyResponder } from "../src/application/create-default-emergency-responder.js";

test("default emergency responder is empathetic and uses only the first name", async () => {
  const responder = createDefaultEmergencyResponder();
  const text = await responder.respond({ lead: { first_name: "Ana" }, inbound: { message: { text: "Hola" } } });
  assert.equal(text, "Hola Ana, gracias por escribirnos. Quiero ayudarte. ¿Podrías contarme brevemente qué información necesitas?");
  assert.equal(text.includes("undefined"), false);
});
