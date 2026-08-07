import { responseText } from "../../ports/message-sender.js";
import { normalizeCustomFieldValues } from "../leads/normalize-custom-field-values.js";

const STATUSES = new Set(["collecting", "prequalified", "not_ready", "human_review"]);
const URGENCY = new Set(["low", "medium", "high"]);
const NEXT_ACTIONS = {
  collecting: new Set(["continue_qualification", "human_handoff"]),
  prequalified: new Set(["request_appointment"]),
  not_ready: new Set(["nurture", "human_handoff"]),
  human_review: new Set(["human_handoff"]),
};

function fail(code) {
  throw new Error(`invalid_prequalifier_response:${code}`);
}

function cleanText(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value.trim();
}

function cleanTextList(value, code) {
  if (!Array.isArray(value)) fail(code);
  return value.map((item) => cleanText(item, code));
}

function configuredQuestionIds(agentDna) {
  return new Set([
    ...(agentDna.common_questions ?? []).map((question) => question.id),
    ...(agentDna.profiles ?? []).flatMap((profile) => (profile.questions ?? []).map((question) => question.id)),
  ]);
}

function comparisonMatches(operator, actual, expected) {
  if (operator === "equals") return actual === expected;
  if (operator === "in") return Array.isArray(expected) && expected.includes(actual);
  if (operator === "gte") return typeof actual === "number" && actual >= expected;
  if (operator === "lte") return typeof actual === "number" && actual <= expected;
  return false;
}

function questionApplies(question, answers) {
  if (!question.when) return true;
  return comparisonMatches(question.when.operator, answers[question.when.field]?.value, question.when.value);
}

function qualificationRequirements(agentDna, activeProfileId, answers) {
  const profile = (agentDna.profiles ?? []).find((item) => item.id === activeProfileId);
  const questions = [...(agentDna.common_questions ?? []), ...(profile?.questions ?? [])];
  const missingRequired = questions
    .filter((question) => question.requirement === "required" && questionApplies(question, answers) && answers[question.id] === undefined)
    .map((question) => question.id);
  const failedRequiredCriteria = (profile?.qualification?.criteria ?? [])
    .filter((criterion) => criterion.required && !comparisonMatches(criterion.operator, answers[criterion.field]?.value, criterion.value))
    .map((criterion) => criterion.id);
  return { missingRequired, failedRequiredCriteria };
}

function normalizeAnswers(raw, allowedIds, previousAnswers) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("answers_required");
  const answers = { ...(previousAnswers ?? {}) };
  for (const [questionId, answer] of Object.entries(raw)) {
    if (!allowedIds.has(questionId)) fail("answer_question_unknown");
    if (!answer || typeof answer !== "object" || Array.isArray(answer) || answer.value === undefined) fail("answer_invalid");
    const confidence = answer.confidence ?? 1;
    if (typeof confidence !== "number" || confidence < 0 || confidence > 1) fail("answer_confidence_invalid");
    answers[questionId] = { value: answer.value, confidence };
  }
  return answers;
}

function deriveEvents({ conversationId, previousStatus, state }) {
  const base = { schema_version: 1, conversation_id: conversationId, qualification_revision: state.revision };
  const events = [{ ...base, type: "qualification.updated", idempotency_key: `qualification:${conversationId}:${state.revision}` }];
  if (state.assessment.status === "prequalified" && previousStatus !== "prequalified") {
    events.push({ ...base, type: "lead.prequalified", idempotency_key: `prequalified:${conversationId}:${state.revision}` });
    events.push({ ...base, type: "appointment.requested", idempotency_key: `appointment:${conversationId}:${state.revision}` });
  }
  return events;
}

export function normalizeAgentResponse({ agentDna, output, currentState = {}, conversationId } = {}) {
  const text = responseText(output);
  if (!text) throw new Error("agent_empty_response");
  const configuredCustomFields = agentDna?.custom_fields ?? [];
  const customFieldValues = configuredCustomFields.length
    ? normalizeCustomFieldValues({ fields: configuredCustomFields, values: output?.custom_fields ?? [], previous: currentState.custom_field_values ?? {} })
    : null;
  if (agentDna?.kind !== "real_estate_prequalifier") return customFieldValues ? { text, custom_field_values: customFieldValues } : { text };
  if (typeof conversationId !== "string" || !conversationId) fail("conversation_id_required");
  const raw = output?.qualification_state;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("state_required");
  if (raw.schema_version !== 1) fail("schema_version_unsupported");

  const profileIds = new Set((agentDna.profiles ?? []).map((profile) => profile.id));
  const activeProfileId = raw.active_profile_id ?? currentState.active_profile_id ?? null;
  if (activeProfileId !== null && !profileIds.has(activeProfileId)) fail("profile_unknown");
  const questionIds = configuredQuestionIds(agentDna);
  const answers = normalizeAnswers(raw.answers, questionIds, currentState.answers);
  const reportedMissing = raw.missing_question_ids ?? [];
  if (!Array.isArray(reportedMissing) || reportedMissing.some((id) => !questionIds.has(id))) fail("missing_question_unknown");

  const assessment = raw.assessment;
  if (!assessment || typeof assessment !== "object" || Array.isArray(assessment)) fail("assessment_required");
  const status = cleanText(assessment.status, "assessment_status_required");
  if (!STATUSES.has(status)) fail("assessment_status_invalid");
  const urgency = cleanText(assessment.urgency, "assessment_urgency_required");
  if (!URGENCY.has(urgency)) fail("assessment_urgency_invalid");
  const nextAction = cleanText(raw.next_action, "next_action_required");
  if (!NEXT_ACTIONS[status].has(nextAction)) fail("next_action_invalid_for_status");
  if (status === "prequalified" && !activeProfileId) fail("prequalified_profile_required");
  const requirements = qualificationRequirements(agentDna, activeProfileId, answers);
  if (status === "prequalified" && requirements.missingRequired.length) fail("prequalified_required_answers_missing");
  if (status === "prequalified" && requirements.failedRequiredCriteria.length) fail("prequalified_required_criteria_failed");
  const missing = [...new Set([...reportedMissing, ...requirements.missingRequired])].filter((id) => answers[id] === undefined);
  const previousAnswerIds = new Set(Object.keys(currentState.answers ?? {}));
  const newAnswerCount = Object.keys(answers).filter((id) => !previousAnswerIds.has(id)).length;
  const currentQuestionId = missing[0] ?? null;
  const previousQuestionId = currentState.last_question_id ?? null;
  const attempts = { ...(currentState.question_attempts ?? {}) };
  if (currentQuestionId && currentQuestionId === previousQuestionId && newAnswerCount === 0) attempts[currentQuestionId] = (attempts[currentQuestionId] ?? 0) + 1;
  else if (currentQuestionId) attempts[currentQuestionId] = 0;
  const maxQuestions = Number.isInteger(agentDna.max_questions) ? agentDna.max_questions : 7;
  const questionCount = Object.keys(answers).length;
  let finalStatus = status;
  let finalNextAction = nextAction;
  const reasons = cleanTextList(assessment.reasons ?? [], "assessment_reason_invalid");
  const limitations = cleanTextList(assessment.limitations ?? [], "assessment_limitation_invalid");
  let finalText = text;
  if (status === "collecting" && questionCount >= maxQuestions && missing.length) {
    finalStatus = "human_review";
    finalNextAction = "human_handoff";
    limitations.push(`Se alcanzó el máximo de ${maxQuestions} preguntas sin completar todos los datos requeridos.`);
    finalText = `${finalText} Para no hacerte repetir preguntas, dejaré este caso listo para revisión del asesor inmobiliario.`;
  } else if (currentQuestionId && (attempts[currentQuestionId] ?? 0) >= 2) {
    finalStatus = "human_review";
    finalNextAction = "human_handoff";
    limitations.push("No fue posible confirmar un dato después de dos intentos de aclaración.");
    finalText = "Para no hacerte repetir la misma pregunta, dejaré este dato pendiente para que lo confirme un asesor inmobiliario.";
  }

  const state = {
    schema_version: 1,
    revision: Number.isInteger(currentState.revision) ? currentState.revision + 1 : 1,
    active_profile_id: activeProfileId,
    answers,
    missing_question_ids: missing,
    assessment: {
      status: finalStatus,
      urgency,
      reasons,
      limitations,
    },
    next_action: finalNextAction,
    last_question_id: currentQuestionId,
    question_attempts: attempts,
    question_count: questionCount,
    max_questions: maxQuestions,
  };
  return {
    text: finalText,
    ...(output?.interactive ? { interactive: output.interactive } : {}),
    ...(customFieldValues ? { custom_field_values: customFieldValues } : {}),
    qualification_state: state,
    events: deriveEvents({ conversationId, previousStatus: currentState.assessment?.status, state }),
  };
}
