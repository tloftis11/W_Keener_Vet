// Shared escalation categories — used by the classifier's structured output
// and by acknowledgments.ts to pick the right handoff message. Keeping this
// list in one place keeps the two in sync.
//
// Deliberately narrow: the bot should default to actually engaging with
// health/symptom questions (asking clarifying questions, giving general
// guidance) rather than deflecting everything that sounds medical. Only
// medication/procedure content and potential emergencies escalate.
export const ESCALATION_CATEGORIES = ["medication", "procedure", "emergency"] as const;

export type EscalationCategory = (typeof ESCALATION_CATEGORIES)[number];

export const CATEGORY_OR_NONE = ["none", ...ESCALATION_CATEGORIES] as const;
export type CategoryOrNone = (typeof CATEGORY_OR_NONE)[number];

export const URGENCY_OR_NONE = ["none", "routine", "urgent"] as const;
export type UrgencyOrNone = (typeof URGENCY_OR_NONE)[number];
