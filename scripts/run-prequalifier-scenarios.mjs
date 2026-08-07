import { validateAgentConfiguration } from "../src/domain/agents/validate-agent-configuration.js";
import { normalizeCustomFields } from "../src/domain/leads/normalize-custom-fields.js";
import { normalizeAgentResponse } from "../src/domain/qualification/normalize-prequalifier-response.js";

const agent = validateAgentConfiguration({
  schema_version: 1,
  kind: "real_estate_prequalifier",
  identity: { business_name: "QA Precalificador Inmobiliario", tone: "cálido, sutil y amigable" },
  services: ["property_purchase"],
  markets: [],
  policies: {
    allowed_topics: ["proceso general de compra", "down payment", "opciones generales de financiamiento"],
    prohibited_topics: ["aprobar financiamiento", "recomendar bancos, prestamistas o productos financieros"],
    require_profile_before_recommendations: true,
  },
  reporting: { channel: "email", cadence: "daily", recipients: ["qa@example.test"], local_time: "08:00", timezone: "America/New_York", include_all_leads: true },
});
agent.custom_fields = normalizeCustomFields([{ id: "preferred_area", label: "Zona de preferencia", type: "text" }]);

function answerFor(question) {
  if (question.answer_type === "choice") return question.options[0];
  if (question.answer_type === "boolean") return true;
  if (question.answer_type === "number") return 650;
  if (question.answer_type === "currency") return 300000;
  return "dato de prueba";
}

function answersFor(profileId, creditScore = 650) {
  const profile = agent.profiles.find((item) => item.id === profileId);
  const questions = [...agent.common_questions, ...profile.questions];
  return Object.fromEntries(questions.map((question) => [question.id, { value: question.id.includes("credit_score") ? creditScore : answerFor(question), confidence: 1 }]));
}

function run(profileId, creditScore = 650) {
  const result = normalizeAgentResponse({
    agentDna: agent,
    conversationId: `qa-${profileId}`,
    output: {
      text: "Gracias. Con esta información podemos pasar al siguiente paso.",
      qualification_state: { schema_version: 1, active_profile_id: profileId, answers: answersFor(profileId, creditScore), missing_question_ids: [], assessment: { status: "prequalified", urgency: "medium", reasons: ["Información mínima completa"], limitations: [] }, next_action: "request_appointment" },
      custom_fields: [{ field_id: "preferred_area", value: "Brickell", confidence: 0.95, consent_given: false }],
    },
  });
  return { profileId, status: result.qualification_state.assessment.status, nextAction: result.qualification_state.next_action, events: result.events.map((event) => event.type), customField: result.custom_field_values.preferred_area.value };
}

const scenarios = ["international_investor", "local_investor", "first_time_buyer", "local_buyer"].map((profileId) => run(profileId));
let rejectedLowScore = false;
try { run("local_investor", 580); } catch (error) { rejectedLowScore = error.message === "invalid_prequalifier_response:prequalified_required_criteria_failed"; }
if (scenarios.some((scenario) => scenario.status !== "prequalified" || scenario.nextAction !== "request_appointment" || !scenario.events.includes("appointment.requested") || scenario.customField !== "Brickell") || !rejectedLowScore) process.exitCode = 1;
console.log(JSON.stringify({ agent: agent.identity.business_name, scenarios, low_score_rejected: rejectedLowScore, ok: scenarios.length === 4 && rejectedLowScore }, null, 2));
