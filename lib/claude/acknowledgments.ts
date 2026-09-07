// Deterministic templates, not another model call — fast, free, and
// consistent. Only medication and procedure are hard gates where the bot
// doesn't respond at all; emergency escalates in parallel with a real bot
// reply, so it gets a short supplementary note instead (see
// EMERGENCY_FOLLOW_UP_NOTE below).
const HARD_GATE_TEMPLATES: Record<"medication" | "procedure", string> = {
  medication:
    "Since this involves specific medication or dosing, I've sent it to one of our vets to review — they'll reply here as soon as they can. Feel free to add any more details in the meantime.",
  procedure:
    "Questions about procedures need to come from one of our vets directly, so I've sent this to them — they'll respond here as soon as they can.",
};

export function getHardGateMessage(category: "medication" | "procedure"): string {
  return HARD_GATE_TEMPLATES[category];
}

export const EMERGENCY_FOLLOW_UP_NOTE =
  "I've also flagged this for one of our vets right away — they'll follow up here as soon as they can.";
