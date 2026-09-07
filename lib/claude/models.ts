// Model choice is env-driven so it can be swapped without code changes.
// Defaults: Haiku for the classifier (fast/cheap — it runs on every single
// customer turn) and Opus for the customer-facing conversational reply,
// matching what the current API key is normally used with. Override either
// independently via env once you've tested cheaper/faster options.
export function getClassifierModel(): string {
  return process.env.CLASSIFIER_MODEL || "claude-haiku-4-5-20251001";
}

export function getChatModel(): string {
  return process.env.CHAT_MODEL || "claude-opus-5";
}
