/** Groups campaign conversations by the lead identity shown in the dashboard. */
export function groupLeadConversations(items = []) {
  const groups = new Map();
  for (const item of items) {
    const key = item.leads?.phone ?? `conversation:${item.id}`;
    if (!groups.has(key)) groups.set(key, { lead: item.leads ?? {}, conversations: [] });
    groups.get(key).conversations.push(item);
  }
  return [...groups.values()];
}
