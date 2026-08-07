import test from "node:test";
import assert from "node:assert/strict";
import { groupLeadConversations } from "../src/domain/leads/group-lead-conversations.js";

test("groups campaigns under one lead without merging conversation data", () => {
  const groups = groupLeadConversations([
    { id: "c1", leads: { phone: "+1", first_name: "Ana" }, campaigns: { name: "A" }, summary: "Resumen A" },
    { id: "c2", leads: { phone: "+1", first_name: "Ana" }, campaigns: { name: "B" }, summary: "Resumen B" },
    { id: "c3", leads: { phone: "+2", first_name: "Luis" }, campaigns: { name: "C" }, summary: "Resumen C" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].lead.phone, "+1");
  assert.deepEqual(groups[0].conversations.map((item) => item.summary), ["Resumen A", "Resumen B"]);
});
