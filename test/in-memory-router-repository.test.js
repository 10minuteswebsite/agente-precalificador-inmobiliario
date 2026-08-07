import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryRouterRepository } from "../src/adapters/persistence/in-memory-router-repository.js";

test("repository is idempotent for provider messages", async () => {
  const repository = createInMemoryRouterRepository();
  await repository.saveMessage({ provider_message_id: "m-1", body: "hola" });
  await repository.saveMessage({ provider_message_id: "m-1", body: "duplicado" });

  assert.equal((await repository.hasMessage("m-1")), true);
  assert.equal(repository.snapshot().messages.length, 1);
  assert.equal(repository.snapshot().messages[0].body, "hola");
});

test("repository keeps one conversation per lead and campaign lookup", async () => {
  const repository = createInMemoryRouterRepository({ leads: [{ id: "l-1", phone: "+1" }] });
  const conversation = { id: "c-1", lead_id: "l-1", campaign_id: "camp-1" };
  await repository.saveConversation(conversation);

  assert.deepEqual(await repository.findConversation("l-1", "camp-1"), conversation);
  assert.equal(await repository.findConversation("l-1", "camp-2"), null);
});

test("repository updates qualification state without replacing the conversation", async () => {
  const repository = createInMemoryRouterRepository({ conversations: [{ id: "c-1", lead_id: "l-1", campaign_id: "camp-1", qualification_state: {} }] });
  await repository.updateConversation("c-1", { qualification_state: { schema_version: 1, revision: 1 } });
  assert.equal(repository.snapshot().conversations[0].qualification_state.revision, 1);
});
