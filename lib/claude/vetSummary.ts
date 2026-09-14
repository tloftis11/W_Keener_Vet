import { getAnthropicClient } from "./client";
import { getVetSummaryModel } from "./models";
import type { WebSearchResult } from "../search/tavily";

// Extracts facts about ONE specific, already-identified business from web
// search results — not a general Q&A call. The whole point of this feature
// is to avoid ever putting a fabricated fact in front of a worried pet
// owner, so the prompt is deliberately strict: only what's stated in the
// provided text, "not listed" otherwise, and bail out entirely if the
// search results don't clearly seem to be about this exact business.
const BASE_SYSTEM_PROMPT = `You extract factual information about ONE specific business from web \
search results. You are not answering a question — you are strictly summarizing what is \
already written in the provided search results about this exact business.

Rules:
- Only use information explicitly stated in the provided search result text. Never use \
outside knowledge about this business, similarly-named businesses, or veterinary clinics \
in general.
- If a fact (phone, hours, website, services) is not stated in the provided text, leave \
that field null — never guess or infer.
- If the search results appear to be about a different business (wrong location, wrong \
name, or you can't tell), set "confident" to false and leave every field null.
- Keep "notes" to one short factual sentence, or null if there's nothing worth adding \
beyond phone/hours/website.
- Write "notes" in plain, direct language, no em dashes.`;

const EMERGENCY_ADDENDUM = `\n\nThis lookup is for a potential pet emergency, so also determine \
"emergencyCareConfirmed": set it to "yes" only if the search results explicitly state this \
location offers 24-hour, after-hours, or emergency veterinary care; set it to "no" if they \
explicitly state the opposite (e.g. daytime-only hours, "we are not an emergency facility", \
or they explicitly refer customers elsewhere for emergencies); otherwise set it to "unclear". \
Do not infer this from the business name or category alone — only from what the text actually \
says.`;

export interface VetSummaryResult {
  confident: boolean;
  phone: string | null;
  website: string | null;
  hours: string | null;
  notes: string | null;
  sourceUrls: string[];
  emergencyCareConfirmed: "yes" | "no" | "unclear" | null;
}

export async function summarizeVetInfo(
  business: { name: string; address: string | null },
  searchResults: WebSearchResult[],
  opts: { isEmergency?: boolean } = {}
): Promise<VetSummaryResult> {
  const empty: VetSummaryResult = {
    confident: false,
    phone: null,
    website: null,
    hours: null,
    notes: null,
    sourceUrls: [],
    emergencyCareConfirmed: null,
  };
  if (searchResults.length === 0) return empty;

  const client = getAnthropicClient();

  const sourcesText = searchResults
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join("\n\n");

  const userMessage = `Business: ${business.name}${business.address ? `\nAddress: ${business.address}` : ""}

Search results:
${sourcesText}`;

  const systemPrompt = opts.isEmergency
    ? BASE_SYSTEM_PROMPT + EMERGENCY_ADDENDUM
    : BASE_SYSTEM_PROMPT;

  const response = await client.messages.create({
    model: getVetSummaryModel(),
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        name: "vet_summary",
        description: "Report extracted facts about this specific business.",
        input_schema: {
          type: "object",
          properties: {
            confident: {
              type: "boolean",
              description: "Whether the search results are clearly about this exact business.",
            },
            phone: { type: "string", description: "Empty string if not stated." },
            website: { type: "string", description: "Empty string if not stated." },
            hours: { type: "string", description: "Empty string if not stated." },
            notes: { type: "string", description: "Empty string if nothing worth adding." },
            emergencyCareConfirmed: {
              type: "string",
              enum: ["yes", "no", "unclear"],
              description: "Only meaningful when asked about explicitly — see instructions.",
            },
            sourceIndexes: {
              type: "array",
              items: { type: "number" },
              description: "Which [n] sources (1-indexed) the extracted facts came from.",
            },
          },
          required: [
            "confident",
            "phone",
            "website",
            "hours",
            "notes",
            "emergencyCareConfirmed",
            "sourceIndexes",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "vet_summary" },
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );
  if (!toolUse) return empty;

  const input = toolUse.input as {
    confident?: boolean;
    phone?: string;
    website?: string;
    hours?: string;
    notes?: string;
    emergencyCareConfirmed?: "yes" | "no" | "unclear";
    sourceIndexes?: number[];
  };

  if (!input.confident) return empty;

  const sourceUrls = (input.sourceIndexes ?? [])
    .map((i) => searchResults[i - 1]?.url)
    .filter((url): url is string => Boolean(url));

  return {
    confident: true,
    phone: input.phone || null,
    website: input.website || null,
    hours: input.hours || null,
    notes: input.notes || null,
    sourceUrls,
    emergencyCareConfirmed: opts.isEmergency ? (input.emergencyCareConfirmed ?? "unclear") : null,
  };
}
