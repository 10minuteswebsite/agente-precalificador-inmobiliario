export function createDefaultEmergencyResponder() {
  return {
    async respond({ lead, inbound }) {
      const firstName = lead?.first_name ? ` ${lead.first_name}` : "";
      const text = inbound?.message?.text?.trim();
      if (text) return `Hola${firstName}, gracias por escribirnos. Quiero ayudarte. ¿Podrías contarme brevemente qué información necesitas?`;
      return `Hola${firstName}, gracias por escribirnos. ¿En qué podemos ayudarte?`;
    },
  };
}
