import test from "node:test";
import assert from "node:assert/strict";
import { capabilityIds, deriveAgentOrchestration, normalizeAgentCapabilities } from "../src/domain/agents/normalize-agent-capabilities.js";

test("normalizes legacy capability ids into versioned modules", () => {
  assert.deepEqual(normalizeAgentCapabilities(["conversational"]), [{ id: "conversational", version: "1.0", config: {} }]);
});

test("preserves capability versions and configuration", () => {
  assert.deepEqual(capabilityIds([{ id: "scheduler", version: "2.1", config: { calendar: "google" } }]), ["conversational", "scheduler"]);
});

test("always keeps conversation as the controlling capability", () => {
  assert.deepEqual(capabilityIds(["real_estate_prequalifier", "scheduler"]), ["conversational", "real_estate_prequalifier", "scheduler"]);
});

test("exposes additive superpowers separately from the conversational controller", () => {
  assert.deepEqual(deriveAgentOrchestration(["scheduler", "real_estate_prequalifier"]), {
    controller: "conversational",
    strategy: "additive",
    superpowers: ["scheduler", "real_estate_prequalifier"],
  });
});

test("rejects duplicate capabilities", () => {
  assert.throws(() => normalizeAgentCapabilities(["courses", "courses"]), /duplicate_agent_capability/);
});
