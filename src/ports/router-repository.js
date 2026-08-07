/**
 * Persistence contract for the router adapter.
 * Supabase and the local repository implement the same operations.
 */
export const routerRepositoryOperations = Object.freeze([
  "findLeadByPhone",
  "findAgent",
  "saveLead",
  "updateLead",
  "findConversation",
  "listConversationsForLead",
  "saveConversation",
  "updateConversation",
  "hasMessage",
  "saveMessage",
  "saveManualReview",
]);
