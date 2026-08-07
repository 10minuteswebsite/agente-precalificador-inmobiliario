import test from "node:test";
import assert from "node:assert/strict";
import { dailyReportWindow } from "../src/domain/reporting/daily-report-schedule.js";

test("evaluates the configured local report time across time zones", () => {
  const reporting = { timezone: "America/New_York", local_time: "08:00" };
  assert.equal(dailyReportWindow(reporting, new Date("2026-08-01T11:59:00Z")).due, false);
  const due = dailyReportWindow(reporting, new Date("2026-08-01T12:00:00Z"));
  assert.equal(due.due, true);
  assert.equal(due.report_date, "2026-08-01");
});
