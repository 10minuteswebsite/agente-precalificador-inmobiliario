import test from "node:test";
import assert from "node:assert/strict";
import { validateAgentConfiguration } from "../src/domain/agents/validate-agent-configuration.js";

function validConfiguration() {
  return {
    schema_version: 1,
    kind: "real_estate_prequalifier",
    identity: { business_name: "Inmobiliaria Ejemplo", tone: "cálido y profesional" },
    channels: ["whatsapp"],
    services: ["property_purchase", "rental_handoff"],
    common_questions: [
      { id: "purchase_timeline", prompt: "¿Cuándo te gustaría comprar?", purpose: "Conocer la urgencia", requirement: "required", sensitivity: "standard", answer_type: "choice", options: ["0-3 meses", "3-6 meses", "más adelante"] },
      { id: "payment_method", prompt: "¿Comprarías de contado o con financiamiento?", purpose: "Elegir la ruta correcta", requirement: "required", sensitivity: "standard", answer_type: "choice", options: ["contado", "financiamiento"] },
    ],
    profiles: [{
      id: "international_investor",
      label: "Inversionista internacional",
      identification_signals: ["Reside fuera de Estados Unidos", "Busca proteger o aumentar patrimonio"],
      questions: [
        { id: "country_of_residence", prompt: "¿En qué país resides?", purpose: "Comprender el contexto internacional", requirement: "required", sensitivity: "standard", answer_type: "text" },
        { id: "down_payment_capital", prompt: "¿Qué capital aproximado destinarías al inicial?", purpose: "Orientar la viabilidad sin aprobar financiamiento", requirement: "required", sensitivity: "sensitive", answer_type: "currency", when: { field: "payment_method", operator: "equals", value: "financiamiento" } },
      ],
      qualification: {
        explanation: "La IA combina intención, plazo y preparación financiera sin emitir una aprobación hipotecaria.",
        criteria: [
          { id: "timeline_ready", field: "purchase_timeline", operator: "in", value: ["0-3 meses", "3-6 meses"], explanation: "Existe intención dentro de un plazo accionable.", required: true },
          { id: "capital_known", field: "down_payment_capital", operator: "gte", value: 0, explanation: "El prospecto puede expresar un capital aproximado cuando busca financiamiento.", required: false },
        ],
      },
    }],
    markets: [{ id: "south_florida", label: "Sur de Florida", zones: ["Miami-Dade", "Broward"] }],
    policies: {
      allowed_topics: ["proceso general de compra", "down payment general"],
      prohibited_topics: ["recomendar bancos", "aprobar financiamiento"],
      require_profile_before_recommendations: true,
    },
    reporting: {
      channel: "email", cadence: "daily", recipients: ["realtor@example.test"],
      local_time: "08:00", timezone: "America/New_York", include_all_leads: true, skip_empty: true,
    },
  };
}

test("validates and normalizes a versioned real-estate prequalifier DNA", () => {
  const result = validateAgentConfiguration(validConfiguration());
  assert.equal(result.kind, "real_estate_prequalifier");
  assert.deepEqual(result.channels, ["whatsapp"]);
  assert.equal(result.reporting.local_time, "08:00");
  assert.equal(result.scheduling.status, "pending_integration");
});

test("manual mode uses client questions instead of the autonomous baseline", () => {
  const config = validConfiguration();
  config.question_mode = "manual";
  config.common_questions = [{ id: "preferred_area", prompt: "¿Qué zona prefieres?", purpose: "Conocer la zona", requirement: "required", sensitivity: "standard", answer_type: "text" }];
  config.profiles = [{ ...config.profiles[0], questions: [], qualification: { explanation: "Pregunta manual", criteria: [] } }];
  const result = validateAgentConfiguration(config);
  assert.equal(result.question_mode, "manual");
  assert.equal(result.max_questions, 7);
  assert.deepEqual(result.common_questions.map((question) => question.id), ["preferred_area"]);
  assert.deepEqual(result.profiles[0].questions, []);
});

test("semi-automatic mode keeps the professional baseline and honors the limit", () => {
  const config = validConfiguration();
  config.question_mode = "semi_automatic";
  config.max_questions = 3;
  const result = validateAgentConfiguration(config);
  assert.equal(result.question_mode, "semi_automatic");
  assert.equal(result.max_questions, 3);
  assert.ok(result.common_questions.length > 0);
});

test("normalizes the selected real-estate investment types", () => {
  const config = validConfiguration();
  config.investment_types = ["new_construction", "resale_property"];
  const result = validateAgentConfiguration(config);
  assert.deepEqual(result.investment_types, ["new_construction", "resale_property"]);
  config.investment_types = ["seller_only"];
  assert.throws(() => validateAgentConfiguration(config), /investment_type_invalid/);
});

test("keeps legacy generic Agent DNA compatible", () => {
  const legacy = { personality: "cercana", context: "negocio existente" };
  assert.deepEqual(validateAgentConfiguration(legacy), legacy);
});

test("preserves the structured generic Agent DNA fields", () => {
  const dna = {
    identity: "Eres Ana, asistente del negocio.",
    mission: "Ayudar y orientar hacia el siguiente paso.",
    capabilities: ["conversational"],
    context: "Talleres y reservas.",
    personality: "Cercana y profesional.",
    rules: "No inventes precios ni confirmes pagos.",
    knowledge: "Información vigente del negocio.",
  };
  assert.deepEqual(validateAgentConfiguration(dna), dna);
});

test("rejects a condition that references an unknown answer", () => {
  const config = validConfiguration();
  config.profiles[0].questions[1].when.field = "unknown_question";
  assert.throws(() => validateAgentConfiguration(config), /question_condition_field_unknown/);
});

test("rejects qualification criteria without explainable source data", () => {
  const config = validConfiguration();
  config.profiles[0].qualification.criteria[0].field = "credit_score";
  assert.throws(() => validateAgentConfiguration(config), /criterion_field_unknown/);
});

test("rejects malformed numeric thresholds and choice lists", () => {
  const config = validConfiguration();
  config.profiles[0].qualification.criteria[1].value = "thirty percent";
  assert.throws(() => validateAgentConfiguration(config), /criterion_value_invalid/);
  config.profiles[0].qualification.criteria[1].value = 0;
  config.profiles[0].qualification.criteria[0].value = [];
  assert.throws(() => validateAgentConfiguration(config), /criterion_value_invalid/);
});

test("requires a purpose for sensitive questions", () => {
  const config = validConfiguration();
  config.profiles[0].questions[1].purpose = "";
  assert.throws(() => validateAgentConfiguration(config), /question_purpose_required/);
});

test("requires a valid daily email report that includes every lead", () => {
  const config = validConfiguration();
  config.reporting.include_all_leads = false;
  assert.throws(() => validateAgentConfiguration(config), /reporting_must_include_all_leads/);
  config.reporting.include_all_leads = true;
  config.reporting.timezone = "Mars/Olympus";
  assert.throws(() => validateAgentConfiguration(config), /reporting_timezone_invalid/);
});

test("keeps the first increment limited to WhatsApp", () => {
  const config = validConfiguration();
  config.channels.push("voice");
  assert.throws(() => validateAgentConfiguration(config), /channels_must_be_whatsapp_only/);
});
