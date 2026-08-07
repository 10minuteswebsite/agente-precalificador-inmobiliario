import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { parseBody, sendJson } from "../src/application/http.js";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MODALITIES = new Set(["phone", "video"]);

function validateWindow(window) {
  if (!window || !Array.isArray(window.weekdays) || !window.weekdays.length || !window.weekdays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)) throw new Error("scheduler_availability_invalid");
  if (!TIME.test(window.start) || !TIME.test(window.end) || window.start >= window.end) throw new Error("scheduler_availability_invalid");
  if (!MODALITIES.has(window.modality)) throw new Error("scheduler_modality_invalid");
  return { weekdays: [...new Set(window.weekdays)].sort(), start: window.start, end: window.end, modality: window.modality };
}

function normalize(body) {
  if (!body.tenant_id || typeof body.tenant_id !== "string") throw new Error("tenant_id_required");
  if (!body.business_time_zone || typeof body.business_time_zone !== "string") throw new Error("business_time_zone_required");
  if (!Array.isArray(body.services) || !body.services.length) throw new Error("scheduler_services_required");
  const services = body.services.map((service) => {
    if (!service?.id || !service?.name || !Number.isInteger(service.duration_minutes) || service.duration_minutes < 5 || service.duration_minutes > 1440) throw new Error("scheduler_service_invalid");
    return { id: String(service.id), name: String(service.name), duration_minutes: service.duration_minutes, questions: Array.isArray(service.questions) ? service.questions : [] };
  });
  if (!Array.isArray(body.availability) || !body.availability.length) throw new Error("scheduler_availability_required");
  const availability = body.availability.map(validateWindow);
  return {
    tenant_id: body.tenant_id,
    calendar_id: typeof body.calendar_id === "string" && body.calendar_id.trim() ? body.calendar_id.trim() : "primary",
    business_time_zone: body.business_time_zone,
    services,
    availability,
    policies: {
      slot_interval_minutes: Number.isInteger(body.slot_interval_minutes) ? body.slot_interval_minutes : 15,
      min_notice_minutes: Number.isInteger(body.min_notice_minutes) ? body.min_notice_minutes : 0,
      booking_horizon_days: Number.isInteger(body.booking_horizon_days) ? body.booking_horizon_days : 60,
      change_cutoff_hours: Number.isInteger(body.change_cutoff_hours) ? body.change_cutoff_hours : 24,
      buffer_before_minutes: Number.isInteger(body.buffer_before_minutes) ? body.buffer_before_minutes : 0,
      buffer_after_minutes: Number.isInteger(body.buffer_after_minutes) ? body.buffer_after_minutes : 0,
      reminder_minutes_before: Array.isArray(body.reminder_minutes_before) ? body.reminder_minutes_before.filter((value) => Number.isInteger(value) && value > 0) : [1440, 60],
    },
  };
}

function present(row) {
  if (!row) return null;
  return {
    tenant_id: row.tenant_id,
    calendar_id: row.calendar_id,
    business_time_zone: row.business_time_zone,
    services: row.services ?? [],
    availability: row.availability ?? [],
    ...(row.policies ?? {}),
  };
}

export default async function schedulerConfig(request, response) {
  if (!["GET", "PUT"].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const client = createUserApiClient(request);
    await requireUser(client);
    if (request.method === "GET") {
      const tenantId = request.query?.tenant_id;
      if (!tenantId) return sendJson(response, 422, { error: "tenant_id_required" });
      const { data, error } = await client.from("scheduler_configurations").select("*").eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      return sendJson(response, 200, { configuration: present(data) });
    }
    const normalized = normalize(parseBody(request));
    const { policies, ...row } = normalized;
    const { data, error } = await client.from("scheduler_configurations").upsert({ ...row, policies, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" }).select("*").single();
    if (error) throw error;
    return sendJson(response, 200, { configuration: present(data) });
  } catch (error) {
    const message = String(error?.message ?? "request_failed");
    const status = message === "authentication_required" ? 401 : message === "email_not_verified" ? 403 : message.endsWith("_required") || message.startsWith("scheduler_") ? 422 : 500;
    return sendJson(response, status, { error: status === 500 ? "scheduler_config_failed" : message });
  }
}
