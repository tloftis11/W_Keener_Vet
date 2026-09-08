import { getAnthropicClient } from "./client";
import { getChatModel } from "./models";
import type { Message } from "../supabase/types";
import type { TriageResult } from "./classifier";
import type { ResponseMode } from "./mode";

// Runs whenever the classifier didn't hand this off outright (medication or
// procedure), which now includes emergency turns — those still escalate to a
// vet in parallel, but the customer shouldn't be left waiting with nothing.
// The instructions below are defense-in-depth prompting around
// medication/procedure content, not the actual safety gate — the classifier
// is the gate for those two.
const SHARED_BOUNDARY = `You do not recommend or name specific medications, dosing, or discuss \
procedures (surgery, anesthesia, etc.) — a separate system routes those conversations to a \
vet directly, so you don't need to add a disclaimer about it; just don't go there yourself.`;

const DETAILED_SYSTEM_PROMPT = `You are a knowledgeable assistant for a veterinary clinic's \
website chat. You help potential customers with everything from clinic logistics to real \
questions about their pet's health.

Default to actually engaging, not deflecting. When someone describes a symptom or health \
concern, walk through what's likely going on, general first-line guidance, and when it's \
worth an in-person visit — like a knowledgeable triage conversation, not a FAQ page. Ask \
clarifying follow-up questions when you need more information to give a useful answer: how \
long it's been going on, severity, other symptoms, the pet's age/breed, recent changes in \
diet or environment, possible exposure to anything toxic, and so on.

${SHARED_BOUNDARY}

Format for a chat bubble, not a printed report: short paragraphs, no headers, bold only for \
a genuinely important word or two, and bullet lists only when you're actually listing \
several distinct items (five or fewer). Keep the whole reply focused — thorough is good, \
padded is not.`;

const SIMPLE_SYSTEM_PROMPT = `You are a knowledgeable assistant for a veterinary clinic's \
website chat. This customer has asked for simple, easy-to-read answers, so keep every reply \
short: 2-4 short sentences, plain everyday words, no medical jargon (if you must use a term, \
explain it in a few simple words right next to it). No bullet points, no headers, no bold \
text — just plain sentences, like you're talking to someone in person.

Still engage with health questions rather than deflecting — give the single most useful \
thing to know or do right now, and ask at most one clarifying question, only if you truly \
need it to help.

${SHARED_BOUNDARY}`;

const EMERGENCY_ADDENDUM = `\n\nThis message has just been flagged as a potential emergency \
and a vet has been notified in parallel — you don't need to say you're escalating it. Focus \
on clear, calm, urgent guidance: tell them plainly to call the clinic or head to the nearest \
emergency vet right away, and give safe, practical guidance for the immediate moment while \
they get there.`;

export async function generateChatReply(
  messages: Pick<Message, "sender_type" | "body">[],
  options?: {
    triage?: Pick<TriageResult, "category" | "urgency">;
    mode?: ResponseMode;
  }
): Promise<string> {
  const client = getAnthropicClient();

  const history = messages
    .filter((m) => m.sender_type === "customer" || m.sender_type === "bot")
    .map((m) => ({
      role: (m.sender_type === "customer" ? "user" : "assistant") as
        | "user"
        | "assistant",
      content: m.body,
    }));

  let system = options?.mode === "detailed" ? DETAILED_SYSTEM_PROMPT : SIMPLE_SYSTEM_PROMPT;
  if (options?.triage?.category === "emergency") system += EMERGENCY_ADDENDUM;

  const response = await client.messages.create({
    model: getChatModel(),
    max_tokens: 2048,
    system,
    messages: history,
  });

  const textBlock = response.content.find(
    (block): block is Extract<typeof block, { type: "text" }> =>
      block.type === "text"
  );

  return textBlock?.text ?? "";
}
