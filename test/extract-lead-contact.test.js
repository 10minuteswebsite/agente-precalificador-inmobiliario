import test from "node:test";
import assert from "node:assert/strict";
import { extractLeadContact } from "../src/application/extract-lead-contact.js";

test("extracts and normalizes a lead email without exposing other text", () => {
  assert.deepEqual(extractLeadContact("Carlos Prueba, CARLOS.PRUEBA@EXAMPLE.COM"), { email: "carlos.prueba@example.com" });
  assert.deepEqual(extractLeadContact("Solo una pregunta"), {});
});
