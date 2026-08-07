import test from "node:test";
import assert from "node:assert/strict";
import { assignManualReview } from "../src/domain/review/assign-manual-review.js";

test("requires confirmation before irreversible assignment", () => {
  const result = assignManualReview({ id: "review-1", status: "open" }, "camp-1");
  assert.deepEqual(result, { status: "confirmation_required", campaign_id: "camp-1" });
});

test("assigns once and rejects reassignment", () => {
  const assigned = assignManualReview({ id: "review-1", status: "open" }, "camp-1", true);
  assert.equal(assigned.status, "assigned");
  assert.equal(assignManualReview(assigned, "camp-2", true).reason, "review_already_assigned");
});
