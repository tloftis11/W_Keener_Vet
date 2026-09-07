import { getAnthropicClient } from "./client";
import { getClassifierModel } from "./models";
import {
  CATEGORY_OR_NONE,
  URGENCY_OR_NONE,
  type CategoryOrNone,
  type UrgencyOrNone,
} from "./categories";
import type { Message } from "../supabase/types";

// `type`, not `interface` — this gets stored as-is into a jsonb column typed
// as Record<string, unknown>, and interfaces aren't structurally assignable
// to that (see the note in lib/supabase/types.ts).
export type TriageResult = {
  escalate: boolean;
  urgency: UrgencyOrNone;
  category: CategoryOrNone;
  reason: string;
};

const SYSTEM_PROMPT = `You are a triage classifier for a veterinary clinic's customer chat. \
You do not talk to the customer and you do not give advice. Your only job is to read the \
conversation so far and decide whether a vet needs to be pulled in.

The assistant should default to actually engaging with pet health and symptom questions —
asking clarifying questions, discussing likely causes, general care guidance, and when it's
worth an in-person visit. Do NOT escalate just because a question sounds medical or is about
a symptom. Escalate (escalate: true) only for:

- medication: the customer is asking what to give, dosing, prescriptions, refills, or drug
  interactions — anything where a specific medication or amount would need to be named
- procedure: surgery, anesthesia, or any other clinical procedure
- emergency: symptoms suggesting a potential emergency that needs urgent/ER-level attention —
  difficulty breathing, seizure, collapse, suspected toxin/poison ingestion, severe bleeding
  or trauma, bloated/distended abdomen, unable to urinate, prolonged vomiting/diarrhea,
  extreme lethargy, or similar

If a message touches more than one of these, prefer "emergency" over the others — urgency of
care matters more than the topic. Do NOT escalate for general symptom questions, "is this
normal", suspected (non-emergency) conditions, husbandry/care questions, or clinic logistics —
the assistant handles those directly, asking follow-up questions if it needs more information.

Consider the ENTIRE conversation, not just the latest message — risk signals often accumulate
across turns (e.g. a vague symptom followed later by a mention of a possible toxin).

If escalating, also set urgency:
- "urgent": time-sensitive / possible emergency, should be seen at the top of the vet's queue
  (this should match category "emergency")
- "routine": needs a vet but is not time-critical (typically "medication" or "procedure")

If not escalating, set urgency to "none" and category to "none".

Always call the triage_result tool with your decision. Keep "reason" to one short sentence.`;

export async function classifyConversation(
  messages: Pick<Message, "sender_type" | "body">[]
): Promise<TriageResult> {
  const client = getAnthropicClient();

  const transcript = messages
    .filter((m) => m.sender_type === "customer" || m.sender_type === "bot")
    .map((m) => `${m.sender_type === "customer" ? "Customer" : "Assistant"}: ${m.body}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: getClassifierModel(),
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: transcript }],
    tools: [
      {
        name: "triage_result",
        description: "Report the triage decision for this conversation.",
        input_schema: {
          type: "object",
          properties: {
            escalate: {
              type: "boolean",
              description: "Whether this conversation must be handed off to a vet.",
            },
            urgency: {
              type: "string",
              enum: [...URGENCY_OR_NONE],
            },
            category: {
              type: "string",
              enum: [...CATEGORY_OR_NONE],
            },
            reason: {
              type: "string",
              description: "One short sentence explaining the decision.",
            },
          },
          required: ["escalate", "urgency", "category", "reason"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "triage_result" },
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> =>
      block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Classifier did not return a triage_result tool call");
  }

  const input = toolUse.input as Partial<TriageResult>;
  const escalate = Boolean(input.escalate);
  const validCategory = CATEGORY_OR_NONE.includes(input.category as CategoryOrNone)
    ? (input.category as CategoryOrNone)
    : null;

  return {
    escalate,
    urgency: URGENCY_OR_NONE.includes(input.urgency as UrgencyOrNone)
      ? (input.urgency as UrgencyOrNone)
      : "none",
    // If escalate came back true with a missing/invalid category (shouldn't
    // happen given the enum constraint, but defensively), fail toward the
    // stricter hand-off rather than the one where the bot still responds.
    category: validCategory ?? (escalate ? "procedure" : "none"),
    reason: input.reason || "",
  };
}
