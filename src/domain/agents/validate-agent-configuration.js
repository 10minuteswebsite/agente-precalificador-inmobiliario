import { withDefaultRealEstatePrequalifier } from "./default-real-estate-prequalifier.js";
import { REAL_ESTATE_INVESTMENT_TYPES } from "./default-real-estate-prequalifier.js";

const PREQUALIFIER_KIND = "real_estate_prequalifier";
const REQUIREMENTS = new Set(["required", "optional"]);
const SENSITIVITY = new Set(["standard", "sensitive"]);
const ANSWER_TYPES = new Set(["text", "boolean", "number", "currency", "choice"]);
const OPERATORS = new Set(["equals", "in", "gte", "lte"]);

function fail(code) {
  throw new Error(`invalid_agent_configuration:${code}`);
}

function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value;
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value.trim();
}

function list(value, code, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) fail(code);
  return value;
}

function unique(items, field, code) {
  const values = items.map((item) => item[field]);
  if (new Set(values).size !== values.length) fail(code);
}

function validateComparisonValue(operator, value, code) {
  if (operator === "in" && (!Array.isArray(value) || value.length === 0)) fail(code);
  if ((operator === "gte" || operator === "lte") && (typeof value !== "number" || !Number.isFinite(value))) fail(code);
}

function validateQuestion(raw) {
  const question = object(raw, "question_must_be_object");
  const normalized = {
    id: text(question.id, "question_id_required"),
    prompt: text(question.prompt, "question_prompt_required"),
    purpose: text(question.purpose, "question_purpose_required"),
    requirement: text(question.requirement, "question_requirement_required"),
    sensitivity: text(question.sensitivity, "question_sensitivity_required"),
    answer_type: text(question.answer_type, "question_answer_type_required"),
  };
  if (!REQUIREMENTS.has(normalized.requirement)) fail("question_requirement_invalid");
  if (!SENSITIVITY.has(normalized.sensitivity)) fail("question_sensitivity_invalid");
  if (!ANSWER_TYPES.has(normalized.answer_type)) fail("question_answer_type_invalid");
  if (normalized.answer_type === "choice") {
    normalized.options = list(question.options, "question_options_required").map((item) => text(item, "question_option_invalid"));
  }
  if (question.when !== undefined) {
    const when = object(question.when, "question_condition_invalid");
    normalized.when = {
      field: text(when.field, "question_condition_field_required"),
      operator: text(when.operator, "question_condition_operator_required"),
      value: when.value,
    };
    if (!OPERATORS.has(normalized.when.operator)) fail("question_condition_operator_invalid");
    if (when.value === undefined) fail("question_condition_value_required");
    validateComparisonValue(normalized.when.operator, normalized.when.value, "question_condition_value_invalid");
  }
  return normalized;
}

function validateCriterion(raw, questionIds) {
  const criterion = object(raw, "criterion_must_be_object");
  const normalized = {
    id: text(criterion.id, "criterion_id_required"),
    field: text(criterion.field, "criterion_field_required"),
    operator: text(criterion.operator, "criterion_operator_required"),
    value: criterion.value,
    explanation: text(criterion.explanation, "criterion_explanation_required"),
    required: criterion.required === true,
  };
  if (!questionIds.has(normalized.field)) fail("criterion_field_unknown");
  if (!OPERATORS.has(normalized.operator)) fail("criterion_operator_invalid");
  if (criterion.value === undefined) fail("criterion_value_required");
  validateComparisonValue(normalized.operator, normalized.value, "criterion_value_invalid");
  return normalized;
}

function validateProfile(raw, commonQuestions) {
  const profile = object(raw, "profile_must_be_object");
  const questions = list(profile.questions, "profile_questions_required", { allowEmpty: true }).map(validateQuestion);
  unique(questions, "id", "question_ids_must_be_unique");
  const availableIds = new Set([...commonQuestions.map((item) => item.id), ...questions.map((item) => item.id)]);
  for (const question of questions) {
    if (question.when && !availableIds.has(question.when.field)) fail("question_condition_field_unknown");
  }
  const criteria = list(profile.qualification?.criteria, "qualification_criteria_required", { allowEmpty: true })
    .map((item) => validateCriterion(item, availableIds));
  unique(criteria, "id", "criterion_ids_must_be_unique");
  return {
    id: text(profile.id, "profile_id_required"),
    label: text(profile.label, "profile_label_required"),
    identification_signals: list(profile.identification_signals, "profile_identification_signals_required")
      .map((item) => text(item, "profile_identification_signal_invalid")),
    questions,
    qualification: {
      explanation: text(profile.qualification?.explanation, "qualification_explanation_required"),
      criteria,
    },
  };
}

function validateReporting(raw) {
  const reporting = object(raw, "reporting_required");
  const recipients = list(reporting.recipients, "reporting_recipients_required")
    .map((item) => text(item, "reporting_recipient_invalid").toLowerCase());
  if (recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fail("reporting_recipient_invalid");
  const localTime = text(reporting.local_time, "reporting_local_time_required");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) fail("reporting_local_time_invalid");
  const timezone = text(reporting.timezone, "reporting_timezone_required");
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { fail("reporting_timezone_invalid"); }
  if (reporting.channel !== "email" || reporting.cadence !== "daily") fail("reporting_delivery_invalid");
  if (reporting.include_all_leads !== true) fail("reporting_must_include_all_leads");
  return {
    channel: "email",
    cadence: "daily",
    recipients: [...new Set(recipients)],
    local_time: localTime,
    timezone,
    include_all_leads: true,
    skip_empty: reporting.skip_empty !== false,
  };
}

export function validateAgentConfiguration(configuration = {}) {
  const rawConfig = object(configuration, "must_be_object");
  if (rawConfig.kind !== PREQUALIFIER_KIND) return structuredClone(rawConfig);
  const config = object(withDefaultRealEstatePrequalifier(rawConfig), "must_be_object");
  if (config.schema_version !== 1) fail("schema_version_unsupported");
  if (!Array.isArray(config.channels) || config.channels.length !== 1 || config.channels[0] !== "whatsapp") fail("channels_must_be_whatsapp_only");

  const commonQuestions = list(config.common_questions, "common_questions_required", { allowEmpty: true }).map(validateQuestion);
  unique(commonQuestions, "id", "question_ids_must_be_unique");
  const commonQuestionIds = new Set(commonQuestions.map((item) => item.id));
  for (const question of commonQuestions) {
    if (question.when && !commonQuestionIds.has(question.when.field)) fail("question_condition_field_unknown");
  }
  const profiles = list(config.profiles, "profiles_required").map((item) => validateProfile(item, commonQuestions));
  unique(profiles, "id", "profile_ids_must_be_unique");

  const allQuestionIds = [...commonQuestions, ...profiles.flatMap((profile) => profile.questions)].map((item) => item.id);
  if (new Set(allQuestionIds).size !== allQuestionIds.length) fail("question_ids_must_be_unique");

  const policies = object(config.policies, "policies_required");
  const questionMode = ["manual", "semi_automatic"].includes(config.question_mode) ? config.question_mode : "automatic";
  const maxQuestions = config.max_questions === undefined ? 7 : config.max_questions;
  if (!Number.isInteger(maxQuestions) || maxQuestions < 1 || maxQuestions > 50) fail("max_questions_invalid");
  if (questionMode === "manual" && commonQuestions.length === 0 && profiles.every((profile) => profile.questions.length === 0)) fail("manual_questions_required");
  const investmentTypes = list(config.investment_types, "investment_types_required").map((item) => text(item, "investment_type_invalid"));
  const knownInvestmentTypes = new Set(REAL_ESTATE_INVESTMENT_TYPES.map((item) => item.id));
  if (investmentTypes.some((item) => !knownInvestmentTypes.has(item))) fail("investment_type_invalid");
  if (new Set(investmentTypes).size !== investmentTypes.length) fail("investment_types_must_be_unique");
  return {
    schema_version: 1,
    kind: PREQUALIFIER_KIND,
    identity: {
      business_name: text(config.identity?.business_name, "identity_business_name_required"),
      tone: text(config.identity?.tone, "identity_tone_required"),
    },
    channels: ["whatsapp"],
    services: list(config.services, "services_required").map((item) => text(item, "service_invalid")),
    common_questions: commonQuestions,
    profiles,
    markets: list(config.markets, "markets_required", { allowEmpty: true }).map((market) => ({
      id: text(market?.id, "market_id_required"),
      label: text(market?.label, "market_label_required"),
      zones: list(market?.zones, "market_zones_required").map((zone) => text(zone, "market_zone_invalid")),
    })),
    policies: {
      allowed_topics: list(policies.allowed_topics, "allowed_topics_required").map((item) => text(item, "allowed_topic_invalid")),
      prohibited_topics: list(policies.prohibited_topics, "prohibited_topics_required").map((item) => text(item, "prohibited_topic_invalid")),
      require_profile_before_recommendations: policies.require_profile_before_recommendations === true,
    },
    max_questions: maxQuestions,
    question_mode: questionMode,
    investment_types: investmentTypes,
    reporting: validateReporting(config.reporting),
    scheduling: {
      mode: "external_adapter",
      status: "pending_integration",
    },
  };
}

export { PREQUALIFIER_KIND };
