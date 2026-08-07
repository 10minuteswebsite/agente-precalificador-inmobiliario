import test from "node:test";
import assert from "node:assert/strict";
import { createHttpReviewNotifier } from "../src/adapters/notifications/http-review-notifier.js";

test("review notifier posts the review payload to its configured adapter", async () => {
  let request;
  const notifier = createHttpReviewNotifier({ endpoint: "https://internal.example/reviews", token: "secret", fetchImpl: async (...args) => {
    request = args;
    return { ok: true, json: async () => ({ accepted: true }) };
  } });
  await notifier.notify({ review: { id: "r-1" } });
  assert.equal(request[0], "https://internal.example/reviews");
  assert.equal(request[1].headers.authorization, "Bearer secret");
  assert.deepEqual(JSON.parse(request[1].body), { review: { id: "r-1" } });
});
