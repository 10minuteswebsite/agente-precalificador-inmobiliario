const COMMON_QUESTIONS = [
  { id: "purchase_goal", prompt: "¿Qué te gustaría lograr con esta compra?", purpose: "Identificar si busca vivienda o inversión.", requirement: "required", sensitivity: "standard", answer_type: "choice", options: ["primary_residence", "first_home", "investment", "international_investment"] },
  { id: "purchase_timeline", prompt: "¿En qué plazo te gustaría comprar?", purpose: "Conocer la urgencia y el momento adecuado para acompañar al lead.", requirement: "required", sensitivity: "standard", answer_type: "choice", options: ["0_3_months", "3_6_months", "6_12_months", "exploring"] },
  { id: "payment_method", prompt: "¿Estás pensando comprar de contado o con financiamiento?", purpose: "Orientar las siguientes preguntas sin recomendar productos financieros.", requirement: "required", sensitivity: "standard", answer_type: "choice", options: ["cash", "financing", "not_sure"] },
  { id: "budget", prompt: "¿Qué presupuesto aproximado te gustaría manejar?", purpose: "Entender el rango de búsqueda sin prometer propiedades ni aprobación financiera.", requirement: "required", sensitivity: "sensitive", answer_type: "currency" },
];

const PROFILE_QUESTIONS = {
  international_investor: [
    { id: "country_of_residence", prompt: "¿En qué país resides actualmente?", purpose: "Entender el contexto del comprador internacional.", requirement: "required", sensitivity: "standard", answer_type: "text" },
    { id: "us_entry_status", prompt: "¿Tienes visa o autorización vigente para entrar a Estados Unidos?", purpose: "Orientar la conversación internacional sin solicitar números de documentos.", requirement: "required", sensitivity: "sensitive", answer_type: "choice", options: ["valid_visa", "visa_waiver", "other", "not_sure", "prefer_not_to_say"] },
    { id: "prior_us_purchase", prompt: "¿Has comprado antes una propiedad en Estados Unidos?", purpose: "Conocer experiencia previa del inversionista.", requirement: "optional", sensitivity: "standard", answer_type: "boolean" },
    { id: "international_investment_goal", prompt: "¿Qué objetivo principal tienes con la inversión?", purpose: "Entender si busca proteger o aumentar patrimonio.", requirement: "required", sensitivity: "standard", answer_type: "text" },
    { id: "international_down_payment_amount", prompt: "¿Qué capital aproximado tienes disponible para el down payment?", purpose: "Estimar preparación de compra sin aprobar financiamiento.", requirement: "required", sensitivity: "sensitive", answer_type: "currency" },
    { id: "international_down_payment_percent", prompt: "Si financias, ¿qué porcentaje aproximado podrías destinar al down payment?", purpose: "Identificar una limitación habitual del comprador internacional sin recomendar un producto financiero.", requirement: "optional", sensitivity: "sensitive", answer_type: "number" },
  ],
  local_investor: [
    { id: "local_investor_immigration_status", prompt: "¿Cómo describirías tu situación migratoria para este proceso?", purpose: "Orientar qué información general puede ser relevante sin dar asesoría legal.", requirement: "required", sensitivity: "sensitive", answer_type: "choice", options: ["citizen", "permanent_resident", "work_authorized", "other", "prefer_not_to_say"] },
    { id: "local_investor_credit_score", prompt: "¿Conoces aproximadamente tu score de crédito?", purpose: "Estimar preparación general sin sustituir una precalificación bancaria.", requirement: "required", sensitivity: "sensitive", answer_type: "number" },
    { id: "local_investor_bank_preapproval", prompt: "¿Ya cuentas con una precalificación bancaria?", purpose: "Conocer si existe un siguiente paso financiero iniciado.", requirement: "required", sensitivity: "standard", answer_type: "boolean" },
    { id: "local_investment_goal", prompt: "¿Qué objetivo principal tienes con la inversión?", purpose: "Entender si busca proteger o aumentar patrimonio.", requirement: "required", sensitivity: "standard", answer_type: "text" },
    { id: "local_investor_down_payment_amount", prompt: "¿Qué capital aproximado tienes disponible para el down payment?", purpose: "Estimar preparación sin aprobar financiamiento.", requirement: "required", sensitivity: "sensitive", answer_type: "currency" },
  ],
  first_time_buyer: [
    { id: "currently_renting", prompt: "¿Actualmente vives alquilado?", purpose: "Confirmar si busca comprar su primera vivienda.", requirement: "required", sensitivity: "standard", answer_type: "boolean" },
    { id: "first_time_monthly_rent", prompt: "¿Cuánto pagas aproximadamente de renta al mes?", purpose: "Comparar el punto de partida del comprador sin prometer una mensualidad.", requirement: "required", sensitivity: "sensitive", answer_type: "currency" },
    { id: "first_time_comfortable_monthly_payment", prompt: "¿Con qué mensualidad te sentirías cómodo?", purpose: "Entender una preferencia de presupuesto del comprador.", requirement: "required", sensitivity: "sensitive", answer_type: "currency" },
    { id: "first_time_immigration_status", prompt: "¿Cómo describirías tu situación migratoria para este proceso?", purpose: "Orientar información general sin dar asesoría legal.", requirement: "required", sensitivity: "sensitive", answer_type: "choice", options: ["citizen", "permanent_resident", "work_authorized", "other", "prefer_not_to_say"] },
    { id: "first_time_credit_score", prompt: "¿Conoces aproximadamente tu score de crédito?", purpose: "Estimar preparación general sin sustituir una precalificación bancaria.", requirement: "required", sensitivity: "sensitive", answer_type: "number" },
    { id: "first_time_bank_preapproval", prompt: "¿Ya cuentas con una precalificación bancaria?", purpose: "Conocer si existe un siguiente paso financiero iniciado.", requirement: "required", sensitivity: "standard", answer_type: "boolean" },
    { id: "first_time_down_payment_amount", prompt: "¿Qué capital aproximado tienes disponible para el down payment?", purpose: "Estimar preparación sin aprobar financiamiento.", requirement: "required", sensitivity: "sensitive", answer_type: "currency" },
  ],
  local_buyer: [
    { id: "local_buyer_immigration_status", prompt: "¿Cómo describirías tu situación migratoria para este proceso?", purpose: "Orientar información general sin dar asesoría legal.", requirement: "required", sensitivity: "sensitive", answer_type: "choice", options: ["citizen", "permanent_resident", "work_authorized", "other", "prefer_not_to_say"] },
    { id: "local_buyer_credit_score", prompt: "¿Conoces aproximadamente tu score de crédito?", purpose: "Estimar preparación general sin sustituir una precalificación bancaria.", requirement: "required", sensitivity: "sensitive", answer_type: "number" },
    { id: "local_buyer_bank_preapproval", prompt: "¿Ya cuentas con una precalificación bancaria?", purpose: "Conocer si existe un siguiente paso financiero iniciado.", requirement: "required", sensitivity: "standard", answer_type: "boolean" },
    { id: "local_buyer_down_payment_amount", prompt: "¿Qué capital aproximado tienes disponible para el down payment?", purpose: "Estimar preparación sin aprobar financiamiento.", requirement: "required", sensitivity: "sensitive", answer_type: "currency" },
    { id: "local_buyer_comfortable_monthly_payment", prompt: "¿Con qué mensualidad te sentirías cómodo?", purpose: "Entender una preferencia de presupuesto del comprador.", requirement: "required", sensitivity: "sensitive", answer_type: "currency" },
  ],
};

function qualification(criteria, explanation) {
  return { explanation, criteria };
}

const DEFAULT_PROFILES = [
  { id: "international_investor", label: "Inversionista internacional", identification_signals: ["reside fuera de Estados Unidos", "quiere invertir o proteger patrimonio en Estados Unidos"], questions: PROFILE_QUESTIONS.international_investor, qualification: qualification([{ id: "international_goal_known", field: "international_investment_goal", operator: "in", value: ["patrimony", "growth", "rental", "other"], explanation: "Se conoce el objetivo de inversión.", required: false }], "Combina objetivo, preparación de capital y contexto internacional.") },
  { id: "local_investor", label: "Inversionista local", identification_signals: ["vive en Estados Unidos y busca invertir", "quiere proteger o aumentar su patrimonio"], questions: PROFILE_QUESTIONS.local_investor, qualification: qualification([{ id: "local_investor_credit_score_minimum", field: "local_investor_credit_score", operator: "gte", value: 600, explanation: "El score declarado supera aproximadamente 600 puntos.", required: true }], "Combina preparación financiera declarada y objetivo de inversión.") },
  { id: "first_time_buyer", label: "Nuevo comprador", identification_signals: ["vive alquilado", "quiere comprar su primera vivienda", "quiere dejar de pagar renta"], questions: PROFILE_QUESTIONS.first_time_buyer, qualification: qualification([{ id: "first_time_credit_score_minimum", field: "first_time_credit_score", operator: "gte", value: 600, explanation: "El score declarado supera aproximadamente 600 puntos.", required: true }], "Combina intención de primera vivienda, renta actual y preparación declarada.") },
  { id: "local_buyer", label: "Comprador local", identification_signals: ["quiere comprar una vivienda para vivir", "reside localmente"], questions: PROFILE_QUESTIONS.local_buyer, qualification: qualification([{ id: "local_buyer_credit_score_minimum", field: "local_buyer_credit_score", operator: "gte", value: 600, explanation: "El score declarado supera aproximadamente 600 puntos.", required: true }], "Combina preparación declarada, presupuesto y mensualidad cómoda.") },
];

const DEFAULT_POLICIES = {
  allowed_topics: ["proceso general de compra", "down payment", "opciones generales de financiamiento", "compradores locales e internacionales"],
  prohibited_topics: ["aprobar financiamiento", "recomendar bancos, prestamistas o productos financieros", "recomendar propiedades o zonas antes de conocer el perfil", "dar asesoría legal, fiscal o financiera especializada"],
  require_profile_before_recommendations: true,
};

export const REAL_ESTATE_INVESTMENT_TYPES = Object.freeze([
  { id: "international_buyer", label: "Comprador internacional" },
  { id: "local_buyer", label: "Comprador local" },
  { id: "first_time_buyer", label: "Primera vivienda" },
  { id: "new_construction", label: "Nueva construcción" },
  { id: "resale_property", label: "Propiedad de reventa" },
  { id: "investment_property", label: "Propiedad para inversión" },
  { id: "luxury_property", label: "Propiedad de lujo" },
  { id: "land_purchase", label: "Compra de terrenos" },
  { id: "cash_buyer", label: "Compra de contado" },
  { id: "financed_buyer", label: "Compra financiada" },
]);

function mergeById(defaultItems, configuredItems = []) {
  const configuredIds = new Set(configuredItems.map((item) => item?.id));
  return [...configuredItems, ...defaultItems.filter((item) => !configuredIds.has(item.id))];
}

function mergeProfile(defaultProfile, configuredProfile) {
  if (!configuredProfile) return structuredClone(defaultProfile);
  return {
    ...structuredClone(defaultProfile),
    ...configuredProfile,
    questions: mergeById(defaultProfile.questions, configuredProfile.questions ?? []),
    qualification: {
      ...structuredClone(defaultProfile.qualification),
      ...(configuredProfile.qualification ?? {}),
      criteria: mergeById(defaultProfile.qualification.criteria, configuredProfile.qualification?.criteria ?? []),
    },
  };
}

export function withDefaultRealEstatePrequalifier(configuration = {}) {
  const questionMode = ["manual", "semi_automatic"].includes(configuration.question_mode) ? configuration.question_mode : "automatic";
  const configuredProfiles = Array.isArray(configuration.profiles) ? configuration.profiles : [];
  const configuredById = new Map(configuredProfiles.map((profile) => [profile?.id, profile]));
  const configuredQuestionIds = new Set([
    ...(configuration.common_questions ?? []).map((question) => question?.id),
    ...configuredProfiles.flatMap((profile) => (profile?.questions ?? []).map((question) => question?.id)),
  ]);
  const profiles = DEFAULT_PROFILES.map((profile) => mergeProfile({
    ...profile,
    questions: questionMode === "manual" ? [] : profile.questions.filter((question) => !configuredQuestionIds.has(question.id)),
    qualification: questionMode === "manual" ? { explanation: "La calificación se basa en las preguntas definidas por el cliente.", criteria: [] } : profile.qualification,
  }, configuredById.get(profile.id)));
  const defaultIds = new Set(DEFAULT_PROFILES.map((profile) => profile.id));
  return {
    ...structuredClone(configuration),
    channels: configuration.channels ?? ["whatsapp"],
    services: configuration.services ?? ["property_purchase"],
    common_questions: questionMode === "manual" ? [...(configuration.common_questions ?? [])] : mergeById(COMMON_QUESTIONS.filter((question) => !configuredQuestionIds.has(question.id)), configuration.common_questions ?? []),
    profiles: [...profiles, ...configuredProfiles.filter((profile) => !defaultIds.has(profile?.id))],
    policies: { ...structuredClone(DEFAULT_POLICIES), ...(configuration.policies ?? {}) },
    question_mode: questionMode,
    max_questions: configuration.max_questions ?? 7,
    investment_types: configuration.investment_types ?? REAL_ESTATE_INVESTMENT_TYPES.map((item) => item.id),
  };
}

export const DEFAULT_REAL_ESTATE_PROFILES = Object.freeze(DEFAULT_PROFILES.map((profile) => structuredClone(profile)));
export const DEFAULT_REAL_ESTATE_COMMON_QUESTIONS = Object.freeze(COMMON_QUESTIONS.map((question) => structuredClone(question)));
