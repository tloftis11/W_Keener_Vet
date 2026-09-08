// Shared between the server (lib/claude/chat.ts, the API route) and the
// client (ChatWidget's toggle) — kept in its own file since ChatWidget can
// only safely import types, not anything that pulls in the Anthropic SDK.
export const RESPONSE_MODES = ["simple", "detailed"] as const;
export type ResponseMode = (typeof RESPONSE_MODES)[number];
export const DEFAULT_RESPONSE_MODE: ResponseMode = "simple";

export function parseResponseMode(value: unknown): ResponseMode {
  return RESPONSE_MODES.includes(value as ResponseMode)
    ? (value as ResponseMode)
    : DEFAULT_RESPONSE_MODE;
}
