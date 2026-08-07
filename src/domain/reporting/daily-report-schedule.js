function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function dailyReportWindow(reporting, now = new Date()) {
  const parts = localParts(now, reporting.timezone);
  const reportDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localTime = `${parts.hour}:${parts.minute}`;
  return { report_date: reportDate, due: localTime >= reporting.local_time, local_time: localTime };
}
