function changesForPhoneNumber(entry, phoneNumberId) {
  return (entry?.changes ?? []).filter((change) => change?.value?.metadata?.phone_number_id === phoneNumberId);
}

export function scopeMetaPayloadToPhoneNumber(payload, phoneNumberId) {
  if (!phoneNumberId) return payload;
  const entries = (payload?.entry ?? [])
    .map((entry) => ({ ...entry, changes: changesForPhoneNumber(entry, phoneNumberId) }))
    .filter((entry) => entry.changes.length > 0);
  return { ...payload, entry: entries };
}

export function hasMessageForPhoneNumber(payload, phoneNumberId) {
  return Boolean(phoneNumberId && payload?.entry?.some((entry) =>
    changesForPhoneNumber(entry, phoneNumberId).some((change) => (change.value.messages ?? []).length > 0),
  ));
}
