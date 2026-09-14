// Web search fallback for when Geoapify's structured data is too thin (no
// phone, no website) to be useful — used only to ground an LLM summary in
// real search content, never as a substitute for the structured lookup.
const TAVILY_URL = "https://api.tavily.com/search";

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export async function searchWeb(query: string, maxResults = 5): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Missing TAVILY_API_KEY env var");

  let res: Response;
  try {
    res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: WebSearchResult[] };
  return data.results ?? [];
}
